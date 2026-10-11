"""Enterprise 3.0.4: all journals and a non-certifying inspection packet.

Uses the actual enterprise profile and manual applicability overrides. Exports
only existing non-voided entries; never fabricates measurements or signatures.
The selection is a review aid, never a declaration of legal compliance.
"""
from __future__ import annotations

import base64
import io
import json
import tempfile
import zipfile
from dataclasses import replace
from datetime import date, datetime, timedelta
from pathlib import Path

from catalog import Template
from exports import export_pdf, get_templates, is_selected, safe_name
from mature17_core import list_forms, list_documents
from studio_core import layout_export_spec
from studio_export import export_text_report

_MAX_SELECTED = 140
_MAX_ZIP = 64 * 1024 * 1024

REVIEW_POINTS = (
    "Утверждённая программа производственного контроля и утверждённые процедуры ХАССП.",
    "Применимость и периодичность журналов по вашему ППК, процессам и типу объекта.",
    "Реально выполненные записи контроля, результаты измерений и корректирующие действия.",
    "Технологические карты, меню, документы прослеживаемости и входного контроля.",
    "Подтверждения персонала, санитарной обработки и обслуживания оборудования.",
    "При необходимости — лабораторные протоколы, договоры и иные подтверждения.",
    "Соответствие фактических работ, дат, ответственных и подписей исходным документам.",
)


def bounds(start, end):
    """Inclusive ISO8601 dates; bounded to prevent accidentally exporting whole history."""
    if not isinstance(start, str) or not isinstance(end, str):
        raise ValueError("Укажите начало и конец периода")
    try:
        a, b = date.fromisoformat(start), date.fromisoformat(end)
    except ValueError as exc:
        raise ValueError("Дата должна иметь формат ГГГГ-ММ-ДД") from exc
    if a.isoformat() != start or b.isoformat() != end or a > b:
        raise ValueError("Проверьте даты выгрузки")
    if (b-a).days > 366:
        raise ValueError("Максимальный период выгрузки — 367 дней. Выберите меньший.")
    return a.isoformat(), (b + timedelta(days=1)).isoformat()


def current_month():
    today = date.today()
    return today.replace(day=1).isoformat(), today.isoformat()


def _templates(store, venue):
    candidates = get_templates(store)
    result = {}
    for t in candidates:
        applicable, reason = is_selected(store, venue, t)
        result[t.code] = {
            "code": t.code, "title": t.title, "group": t.group,
            "recommended": bool(applicable), "reason": str(reason),
            "basis": str(t.basis), "kind": "template",
            "user_created": t.code.startswith("custom_")
        }
    for form in list_forms(store, int(venue["id"])):
        key = "form:" + str(form["id"])
        result[key] = {
            "code": key, "title": form["title"], "group": "Мои журналы",
            "recommended": True,
            "reason": "Форма создана сотрудником этого предприятия. Применимость определяет ответственный.",
            "basis": "Пользовательская форма; нормативный статус устанавливается предприятием.",
            "kind": "form", "user_created": True,
        }
    return result


def _count_templates(db, venue_id, start, end_exclusive):
    return {x["template_code"]: int(x["n"]) for x in db.execute("""
        SELECT r.template_code, COUNT(*) n
        FROM journal_records AS r
        LEFT JOIN easy19_web_record_meta m
          ON m.venue_id=r.venue_id AND m.record_id=r.id
        WHERE r.venue_id=? AND r.voided_at IS NULL
          AND COALESCE(NULLIF(m.observation_date,''),substr(r.created_at,1,10)) >= ?
          AND COALESCE(NULLIF(m.observation_date,''),substr(r.created_at,1,10)) < ?
        GROUP BY r.template_code
    """, (venue_id,start,end_exclusive)).fetchall()}


def _count_forms(db, venue_id, start, end_exclusive):
    return {"form:"+str(x["form_id"]):int(x["n"]) for x in db.execute("""
        SELECT form_id,COUNT(*) n
        FROM easy17_journal_entries
        WHERE venue_id=? AND (voided_at='' OR voided_at IS NULL)
          AND substr(recorded_at,1,10)>=? AND substr(recorded_at,1,10)<?
        GROUP BY form_id
    """,(venue_id,start,end_exclusive)).fetchall()}


def catalog(store, venue_id, start=None, end=None):
    venue_id = int(venue_id)
    venue = store.get_venue(venue_id)
    if venue is None:
        raise ValueError("Предприятие не найдено")
    if start is None and end is None:
        start, end = current_month()
    a, until = bounds(start,end)
    candidates = _templates(store,venue)
    with store.connect() as db:
        counts = _count_templates(db,venue_id,a,until)
        counts.update(_count_forms(db,venue_id,a,until))
    items = []
    for x in candidates.values():
        item = dict(x)
        item["records"] = counts.get(item["code"],0)
        item["missing"] = bool(item["recommended"] and not item["records"])
        items.append(item)
    items.sort(key=lambda x:(not x["recommended"], x["group"].casefold(), x["title"].casefold()))
    return {
        "venue_name": venue["venue_name"],
        "venue_kind": venue["kind"],
        "start": start, "end": end,
        "items": items, "total": len(items),
        "recommended_count": sum(x["recommended"] for x in items),
        "missing_recommended": sum(x["missing"] for x in items),
        "notice": (
            "Предварительный подбор по процессам предприятия и вашим настройкам, "
            "не официальный обязательный перечень Роспотребнадзора. "
            "Состав, периодичность и применимость подтверждает ответственный за ППК/ХАССП."
        )
    }


def _records(db, venue_id, code, start, end_exclusive):
    rows=db.execute("""
        SELECT r.id,r.data,r.created_at,r.template_code
        FROM journal_records r
        LEFT JOIN easy19_web_record_meta m
          ON m.venue_id=r.venue_id AND m.record_id=r.id
        WHERE r.venue_id=? AND r.template_code=? AND r.voided_at IS NULL
          AND COALESCE(NULLIF(m.observation_date,''),substr(r.created_at,1,10))>=?
          AND COALESCE(NULLIF(m.observation_date,''),substr(r.created_at,1,10))<?
        ORDER BY COALESCE(NULLIF(m.observation_date,''),substr(r.created_at,1,10)),r.id
    """,(venue_id,code,start,end_exclusive)).fetchall()
    out=[]
    for row in rows:
        values=json.loads(row["data"])
        if not isinstance(values,dict):
            raise ValueError("Невозможно прочитать фактическую запись №%s" % row["id"])
        out.append({"id":row["id"],"data":values,
                    "created_at":row["created_at"],"template_code":row["template_code"],
                    "voided_at":None,"void_reason":None})
    return out


def _form_records(db,venue_id,form,start,until):
    rows=db.execute("""
        SELECT id,values_json,recorded_at,recorded_by
        FROM easy17_journal_entries
        WHERE venue_id=? AND form_id=? AND (voided_at='' OR voided_at IS NULL)
          AND substr(recorded_at,1,10)>=? AND substr(recorded_at,1,10)<?
        ORDER BY recorded_at,id
    """,(venue_id,form["id"],start,until)).fetchall()
    records=[]
    for row in rows:
        values=json.loads(row["values_json"])
        if not isinstance(values,dict):
            raise ValueError("Неверный формат сохранённой пользовательской записи")
        fields={"recorded_at":row["recorded_at"],"recorded_by":row["recorded_by"]}
        fields.update({("field_"+str(i)):str(values.get(f["name"],""))
                       for i,f in enumerate(form["fields"])})
        records.append({"id":row["id"],"data":fields,"created_at":row["recorded_at"],
                        "voided_at":None,"void_reason":None})
    return records


def _document_summary(store,venue_id):
    output=[]
    for doc in list_documents(store,venue_id):
        output.append({
            "title":str(doc["title"]),
            "status":str(doc.get("state","")),
            "revision":doc.get("revision",1)
        })
    return output


def export(store,venue_id,codes,start,end,inspection=False):
    venue_id=int(venue_id)
    venue=store.get_venue(venue_id)
    if venue is None:raise ValueError("Предприятие не найдено")
    start,until=bounds(start,end)
    listing=_templates(store,venue)
    if not isinstance(codes,list) or not (1 <= len(codes) <= _MAX_SELECTED):
        raise ValueError("Выберите от 1 до 140 журналов")
    if any(not isinstance(x,str) for x in codes) or len(set(codes))!=len(codes):
        raise ValueError("Некорректный список журналов")
    if set(codes)-set(listing):
        raise ValueError("Журнал удалён или недоступен предприятию. Обновите список.")
    if not isinstance(inspection,bool):raise ValueError("Некорректный режим проверки")
    templates={x.code:x for x in get_templates(store)}
    forms={"form:"+str(f["id"]):f for f in list_forms(store,venue_id)}
    # The user is allowed to export any applicable or manually selected form,
    # including a non-recommended form. The selection is never auto-attested.
    details=[]
    notes=[]
    pdf_count=0
    today=datetime.now().astimezone()
    with tempfile.TemporaryDirectory(prefix="moolva304_") as folder:
        base=Path(folder)
        target=io.BytesIO()
        with store.connect() as db, zipfile.ZipFile(target,"w",zipfile.ZIP_DEFLATED,compresslevel=5) as archive:
            for i,code in enumerate(codes,1):
                data=listing[code]
                if data["kind"]=="form":
                    form=forms[code]
                    columns=[("recorded_at","Дата и время записи"),("recorded_by","Кто внёс запись")]
                    columns.extend(("field_"+str(j),f["name"]) for j,f in enumerate(form["fields"]))
                    records=_form_records(db,venue_id,form,start,until)
                    template=Template(code,form["title"],"Мои журналы",
                                      tuple(columns),"","",
                                      data["basis"],"Форма создана работниками предприятия.")
                    layout={"blank_rows":0,"page_mode":"auto"}
                    widths=None
                else:
                    template=templates[code]
                    layout,columns,widths=layout_export_spec(store,venue_id,template)
                    layout=dict(layout)
                    layout["blank_rows"]=0
                    if not columns:
                        raise ValueError("Невозможно выгрузить «%s»: все графы скрыты" % template.title)
                    records=_records(db,venue_id,code,start,until)
                count=len(records)
                text=("За период нет сохранённых записей; результат контроля не создавался."
                      if not count else
                      "Выбраны только фактически сохранённые, не отменённые записи.")
                note=(template.note+"\\n"+f"Период: {start} — {end}. "+
                      f"Записей: {count}. "+text).strip()
                ptemplate=replace(template,note=note)
                label="%03d_%s.pdf" % (i,safe_name(template.title))
                path=base/label
                export_pdf(path,venue,ptemplate,columns,records,
                           staff_config={},staff_appendix=[],ack_employees=[],
                           layout=layout,widths=widths)
                if not path.is_file() or path.stat().st_size<500:
                    raise RuntimeError("Невозможно сформировать PDF: "+template.title)
                archive.write(path,label)
                pdf_count+=1
                details.append({"code":code,"title":template.title,"records":count,
                                "file":label,"recommended":data["recommended"],
                                "kind":data["kind"]})
                if data["recommended"] and not count:
                    notes.append("Нет сохранённых записей: "+template.title)

            index=[
                "MoOLVa ХАССП Easy 3.0.4 — состав выгрузки журналов",
                "Организация: "+(venue.get("legal_name") or "Не указана"),
                "Предприятие: "+venue["venue_name"],
                "Тип: "+venue["kind"],
                "Период: "+start+" — "+end,
                "Создано: "+today.strftime("%d.%m.%Y %H:%M"),
                "PDF-журналов: "+str(pdf_count),
                "Фактических сохранённых записей: "+str(sum(x["records"] for x in details)),
                "",
                "Список сформирован по выбранным вами формам. "
                "Наличие выгрузки не означает готовность к проверке.",
                "Рекомендуемые формы зависят от профиля объекта и настроек.",
                "Ответственный обязан подтвердить применимость по действующим ППК/ХАССП.",
                "Подписи, результаты и измерения не созданы автоматически.",
                "",
                "ЖУРНАЛЫ:"
            ]+[
                f"- {x['title']}: {x['records']} записей ({x['file']})"
                for x in details
            ]
            if inspection:
                index.extend(["","ВОПРОСЫ ДЛЯ ПРЕДВАРИТЕЛЬНОЙ САМОПРОВЕРКИ:"])
                index.extend("- "+x for x in REVIEW_POINTS)
                index.extend(["","ЗАМЕЧАНИЯ ДЛЯ ПРОВЕРКИ ОТВЕТСТВЕННЫМ:"])
                index.extend(("- "+x for x in notes) if notes else
                             ("Нет автоматически выявленных пустых рекомендованных журналов.",
                              "Это не означает соответствия всем обязательным требованиям."))
                documents=_document_summary(store,venue_id)
                index.extend(["","ДОКУМЕНТЫ, ЗАРЕГИСТРИРОВАННЫЕ В ПРИЛОЖЕНИИ:"])
                if documents:
                    for item in documents:
                        index.append("- "+item["title"]+" | состояние: "+item["status"]+
                                     " | версия: "+str(item["revision"]))
                else:
                    index.append("Документов нет в центре документов приложения. "
                                 "Проверьте наличие документов за его пределами.")
                # Inspection-cover PDF uses established Cyrillic report renderer.
                cover=base/"00_Состав_и_самопроверка.pdf"
                export_text_report(index,cover,"pdf")
                archive.write(cover,cover.name)
            archive.writestr("00_О_выгрузке.txt","\\n".join(index).encode("utf-8"))

        blob=target.getvalue()
    if len(blob)>_MAX_ZIP:
        raise ValueError("Архив превышает 64 МБ. Выберите меньший период или часть журналов.")
    name="MoOLVa_%s_%s_%s.zip" % ("Комплект_для_проверки" if inspection else "Все_журналы",
                                 start.replace("-",""),end.replace("-",""))
    return {
        "filename":name,"mime":"application/zip",
        "zip_b64":base64.b64encode(blob).decode("ascii"),
        "period_start":start,"period_end":end,
        "journals":details,"count":len(details),
        "total_records":sum(x["records"] for x in details),
        "empty_recommended":notes,"inspection":inspection,
        "notice":"Состав предварительный и требует проверки. Записи и подписи не генерируются."
    }
