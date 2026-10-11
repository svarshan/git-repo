"""MoOLVa 3.0.5 — local per-venue technology cards with approval history.

NOT a certified e-signature solution. Printed names, approval timestamps and
manual ink-signature blanks are separate. Draft values are never legal norms.
"""
from __future__ import annotations

import base64
import copy
import io
import json
import re
import sqlite3
import tempfile
import zipfile
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from storage import now
from ttk_catalog305 import by_code,cards_list,catalog

MANDATORY = (
  ("source_reference","Подтверждённый источник рецептуры"),
  ("scope","Область применения"),
  ("raw_requirements","Требования к сырью"),
  ("technology","Процесс приготовления"),
  ("presentation","Подача и оформление"),
  ("storage","Сроки и условия хранения/реализации"),
  ("quality","Органолептические показатели качества"),
  ("safety","Показатели безопасности и контроль"),
  ("nutrition_basis","Метод и источник определения пищевой ценности"),
)
ALLOWED_KIND={"TK","TTK"}
REQUIRED_CHECKS=("recipe_checked","technology_checked","safety_checked",
                 "nutrition_checked","source_checked")


def migrate(store):
    with store.connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS easy305_technology_cards(
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
           catalog_code TEXT NOT NULL, kind TEXT NOT NULL,
           title TEXT NOT NULL, category TEXT NOT NULL,
           content_json TEXT NOT NULL,
           status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved')),
           version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
           authored_by TEXT NOT NULL DEFAULT '',
           checked_by TEXT NOT NULL DEFAULT '',
           approved_by TEXT NOT NULL DEFAULT '',
           approved_at TEXT NOT NULL DEFAULT '',
           created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
           UNIQUE(venue_id,catalog_code)
        );
        CREATE INDEX IF NOT EXISTS idx305_venue ON easy305_technology_cards(venue_id,title);
        CREATE TABLE IF NOT EXISTS easy305_card_revisions(
           card_id INTEGER NOT NULL REFERENCES easy305_technology_cards(id) ON DELETE CASCADE,
           version INTEGER NOT NULL, status TEXT NOT NULL,
           payload TEXT NOT NULL, changed_at TEXT NOT NULL, changed_by TEXT NOT NULL,
           PRIMARY KEY(card_id,version)
        );
        """)


def _text(value,label,maxlen=2000,required=False):
    if not isinstance(value,str):
        raise ValueError("Некорректное поле «"+label+"»")
    value=value.strip()
    if len(value)>maxlen or (required and not value):
        raise ValueError("Укажите корректное значение «"+label+"»")
    return value


def _number(value,label,zero=False):
    if isinstance(value,bool):
        raise ValueError("Проверьте «"+label+"»")
    try:
        x=Decimal(str(value).replace(",",".")) 
        if not x.is_finite() or x<0 or (not zero and x<=0) or x>Decimal("1000000"):
            raise ValueError()
        return float(x)
    except (ValueError,TypeError,InvalidOperation) as exc:
        raise ValueError("Проверьте «"+label+"»") from exc


def _check_venue(store,vid):
    try:vid=int(vid)
    except (ValueError,TypeError) as exc:raise ValueError("Выберите предприятие") from exc
    venue=store.get_venue(vid)
    if venue is None:raise ValueError("Предприятие не найдено")
    return vid,venue


def _validate_content(data):
    if not isinstance(data,dict):
        raise ValueError("Некорректная форма технологической карты")
    result=copy.deepcopy(data)
    result["title"]=_text(result.get("title"),"Наименование блюда",180,True)
    result["category"]=_text(result.get("category","Другое"),"Категория",100,True)
    kind=_text(result.get("kind","TK"),"Тип документа",3,True)
    if kind not in ALLOWED_KIND:raise ValueError("Тип карты должен быть ТК или ТТК")
    result["kind"]=kind
    for key,label in MANDATORY:
        result[key]=_text(result.get(key,""),label,4000)
    for key in ("author_note","allergen_note"):
        result[key]=_text(result.get(key,""),key,1000)
    items=result.get("ingredients")
    if not isinstance(items,list) or not 1<=len(items)<=80:
        raise ValueError("Добавьте от 1 до 80 ингредиентов")
    normalized=[]
    for i,item in enumerate(items):
        if not isinstance(item,dict):raise ValueError("Ошибка ингредиента")
        name=_text(item.get("name"),"Наименование ингредиента",180,True)
        gross=_number(item.get("gross_g"),"Брутто (г) для "+name)
        net=_number(item.get("net_g"),"Нетто (г) для "+name)
        if net>gross:
            raise ValueError("Нетто не может превышать брутто для "+name)
        normalized.append({"name":name,"gross_g":gross,"net_g":net,
                           "verified":bool(item.get("verified",False))})
    result["ingredients"]=normalized
    result["output_g"]=_number(result.get("output_g"),"Выход блюда")
    result["output_is_estimate"]=bool(result.get("output_is_estimate",True))
    allergens=result.get("allergens",[])
    if not isinstance(allergens,list) or len(allergens)>40:
        raise ValueError("Проверьте сведения об аллергенах")
    result["allergens"]=[_text(x,"Аллерген",160,True) for x in allergens]
    nut=result.get("nutrition",{})
    if not isinstance(nut,dict):raise ValueError("Не заполнена пищевая ценность")
    clean={}
    for key in ("protein_g","fat_g","carb_g","kcal"):
        value=nut.get(key)
        clean[key]=None if value in (None,"") else _number(value,key,zero=True)
    result["nutrition"]=clean
    result["nutrition_per"]=_text(result.get("nutrition_per","на порцию"),"Расчёт КБЖУ",40,True)
    checks=result.get("checks",{})
    if not isinstance(checks,dict):raise ValueError("Проверка карты заполнена неверно")
    result["checks"]={key:bool(checks.get(key,False)) for key in REQUIRED_CHECKS}
    result["prepared_by"]=_text(result.get("prepared_by",""),"Составитель",150)
    result["checked_by"]=_text(result.get("checked_by",""),"Проверил",150)
    result["source_reference"]=_text(result.get("source_reference",""),"Источник рецептуры",800)
    result["revision_reason"]=_text(result.get("revision_reason",""),"Основание изменений",500)
    return result


def _approval_problems(data):
    errs=[]
    for key,label in MANDATORY:
        text=data.get(key,"")
        if not text or text.startswith("Авторская проектная") or "требует подтверждения" in text.casefold() or "уточнить" in text.casefold():
            errs.append(label)
    if data.get("output_is_estimate"):
        errs.append("Подтвердить фактический выход блюда")
    if not all(x.get("verified") for x in data["ingredients"]):
        errs.append("Проверить и подтвердить массы всех ингредиентов")
    if any(v is None for v in data["nutrition"].values()):
        errs.append("Заполнить проверенное КБЖУ")
    for key in REQUIRED_CHECKS:
        if not data["checks"].get(key,False):errs.append("Подтвердить "+key)
    if not data.get("prepared_by"):errs.append("Составитель")
    if not data.get("checked_by"):errs.append("Проверяющий")
    if not data.get("allergen_note"):
        errs.append("Проверить наличие аллергенов и источник данных")
    return errs


def _row(row):
    data=json.loads(row["content_json"])
    return {"id":row["id"],"catalog_code":row["catalog_code"],
            "title":row["title"],"category":row["category"],
            "kind":row["kind"],"status":row["status"],
            "version":row["version"],"authored_by":row["authored_by"],
            "checked_by":row["checked_by"],"approved_by":row["approved_by"],
            "approved_at":row["approved_at"],
            "created_at":row["created_at"],"updated_at":row["updated_at"],
            "data":data,"problems":_approval_problems(data)}


def user_cards(store,vid,query="",limit=300,start=0):
    vid,_=_check_venue(store,vid)
    query=_text(query,"Поиск",120)
    try:limit,start=int(limit),int(start)
    except (ValueError,TypeError) as exc:raise ValueError("Некорректная страница") from exc
    if limit<1 or limit>300 or start<0:raise ValueError("Некорректная страница")
    with store.connect() as db:
        rows=db.execute("""
          SELECT * FROM easy305_technology_cards
          WHERE venue_id=? AND (?='' OR title LIKE ?)
          ORDER BY CASE status WHEN 'draft' THEN 0 ELSE 1 END,title
          LIMIT ? OFFSET ?
        """,(vid,query,"%"+query+"%",limit,start)).fetchall()
        total=db.execute("SELECT COUNT(*) FROM easy305_technology_cards WHERE venue_id=?",(vid,)).fetchone()[0]
    return {"total":total,"items":[_row(row) for row in rows]}


def import_card(store,vid,code,actor):
    vid,_=_check_venue(store,vid)
    data=by_code(code)
    data.update({"prepared_by":str(actor.get("display_name") or ""),
                 "checked_by":"","source_reference":"",
                 "nutrition_per":"на порцию",
                 "allergen_note":"",
                 "author_note":"","revision_reason":"",
                 "checks":{key:False for key in REQUIRED_CHECKS}})
    normalized=_validate_content(data)
    stamp=now()
    with store.connect() as db:
        previous=db.execute("SELECT id FROM easy305_technology_cards WHERE venue_id=? AND catalog_code=?",
                            (vid,code)).fetchone()
        if previous:return card(store,vid,previous["id"])
        cur=db.execute("""
          INSERT INTO easy305_technology_cards(
            venue_id,catalog_code,kind,title,category,content_json,status,
            authored_by,created_at,updated_at
          ) VALUES(?,?,?,?,?,?,'draft',?,?,?)
        """,(vid,code,normalized["kind"],normalized["title"],
             normalized["category"],json.dumps(normalized,ensure_ascii=False),
             normalized["prepared_by"],stamp,stamp))
        store._audit(db,vid,"ttk305_catalog_import",
                     {"card_id":cur.lastrowid,"catalog_code":code,
                      "author":normalized["prepared_by"],"draft":True})
        new_id=cur.lastrowid
    return card(store,vid,new_id)


def new_card(store,vid,actor):
    vid,_=_check_venue(store,vid)
    # New cards are NOT auto-imported into inventory production; no stock changes.
    code="CUSTOM-"+datetime.now().strftime("%Y%m%d%H%M%S%f")
    data=by_code(catalog()[0]["catalog_code"])
    data["catalog_code"]=code
    data["title"]="Новое блюдо (переименуйте)"
    data["category"]="Моё блюдо"
    data["prepared_by"]=actor.get("display_name") or ""
    data["source_reference"]=""
    data["allergen_note"]=""
    data["checks"]={key:False for key in REQUIRED_CHECKS}
    with store.connect() as db:
        stamp=now()
        cur=db.execute("""
        INSERT INTO easy305_technology_cards
        (venue_id,catalog_code,kind,title,category,content_json,status,authored_by,created_at,updated_at)
        VALUES(?,?,?,?,?,?,'draft',?,?,?)
        """,(vid,code,data["kind"],data["title"],data["category"],
             json.dumps(_validate_content(data),ensure_ascii=False),
             data["prepared_by"],stamp,stamp))
        store._audit(db,vid,"ttk305_new_card",{"card_id":cur.lastrowid})
        ident=cur.lastrowid
    return card(store,vid,ident)


def card(store,vid,card_id):
    vid,_=_check_venue(store,vid)
    with store.connect() as db:
        row=db.execute("SELECT * FROM easy305_technology_cards WHERE venue_id=? AND id=?",
                       (vid,int(card_id))).fetchone()
    if row is None:raise ValueError("Технологическая карта не найдена")
    return _row(row)


def save(store,vid,card_id,data,actor):
    vid,_=_check_venue(store,vid)
    updated=_validate_content(data)
    with store.connect() as db:
        old=db.execute("SELECT * FROM easy305_technology_cards WHERE venue_id=? AND id=?",
                       (vid,int(card_id))).fetchone()
        if old is None:raise ValueError("Технологическая карта не найдена")
        old_data=json.loads(old["content_json"])
        if old_data==updated:
            return _row(old)
        stamp=now()
        previous_version=int(old["version"])
        revision=previous_version+1
        db.execute("""
          INSERT OR IGNORE INTO easy305_card_revisions(
             card_id,version,status,payload,changed_at,changed_by
          ) VALUES(?,?,?,?,?,?)
        """,(int(card_id),previous_version,old["status"],old["content_json"],
             old["updated_at"],actor.get("display_name") or ""))
        db.execute("""
          UPDATE easy305_technology_cards SET
             kind=?,title=?,category=?,content_json=?,status='draft',version=?,
             authored_by=?,checked_by=?,approved_by='',approved_at='',updated_at=?
          WHERE id=? AND venue_id=?
        """,(updated["kind"],updated["title"],updated["category"],
             json.dumps(updated,ensure_ascii=False),revision,
             updated.get("prepared_by") or "",updated.get("checked_by") or "",
             stamp,int(card_id),vid))
        store._audit(db,vid,"ttk305_card_updated",
                     {"card_id":int(card_id),"version":revision,
                      "previous_was_approved":old["status"]=="approved"})
    return card(store,vid,card_id)


def approve(store,vid,card_id,actor,confirmed):
    vid,venue=_check_venue(store,vid)
    if actor.get("role") not in ("super","director"):
        raise ValueError("Утверждение доступно руководителю или уполномоченному в системе лицу")
    if confirmed is not True:
        raise ValueError("Подтвердите личную проверку карты перед утверждением")
    with store.connect() as db:
        row=db.execute("SELECT * FROM easy305_technology_cards WHERE venue_id=? AND id=?",
                       (vid,int(card_id))).fetchone()
        if row is None:raise ValueError("Технологическая карта не найдена")
        if row["status"]=="approved":
            raise ValueError("Карта уже утверждена. Изменения требуют новой версии.")
        data=json.loads(row["content_json"])
        problems=_approval_problems(data)
        if problems:
            raise ValueError("Перед утверждением исправьте: "+ "; ".join(problems[:6]))
        stamped=now()
        approver=_text(actor.get("display_name") or "","ФИО утверждающего",150,True)
        db.execute("""
          UPDATE easy305_technology_cards SET status='approved',approved_by=?,
            approved_at=?,updated_at=? WHERE id=? AND venue_id=? AND status='draft'
        """,(approver,stamped,stamped,int(card_id),vid))
        db.execute("""
          INSERT INTO easy305_card_revisions(card_id,version,status,payload,changed_at,changed_by)
          VALUES(?,?,?,?,?,?)
        """,(int(card_id),row["version"],"approved",row["content_json"],stamped,approver))
        store._audit(db,vid,"ttk305_card_approved",
            {"card_id":int(card_id),"version":row["version"],
             "by":approver,"approved_at":stamped,
             "signature_status":"no_signature_generated"})
    return card(store,vid,card_id)


def revisions(store,vid,card_id):
    vid,_=_check_venue(store,vid)
    card(store,vid,card_id)
    with store.connect() as db:
        rows=db.execute("""
          SELECT version,status,changed_at,changed_by
          FROM easy305_card_revisions WHERE card_id=? ORDER BY version DESC
        """,(int(card_id),)).fetchall()
    return {"items":[dict(x) for x in rows]}


def export(store,vid,ids,fmt="pdf"):
    from ttk_export305 import as_docx,as_pdf
    vid,venue=_check_venue(store,vid)
    if fmt not in ("pdf","docx","both"):
        raise ValueError("Выберите формат PDF, Word или оба")
    if not isinstance(ids,list) or not 1<=len(ids)<=50:
        raise ValueError("За один раз можно выгрузить от 1 до 50 карт")
    if len(set(map(str,ids)))!=len(ids):
        raise ValueError("Уберите дубли выбранных карт")
    cards=[card(store,vid,int(cid)) for cid in ids]
    zipbuffer=io.BytesIO()
    with tempfile.TemporaryDirectory(prefix="ttk305_") as folder:
        with zipfile.ZipFile(zipbuffer,"w",zipfile.ZIP_DEFLATED,compresslevel=5) as archive:
            summary=["MoOLVa 3.0.5 — технологические карты",
                     "Предприятие: "+venue["venue_name"],
                     "Дата выгрузки: "+date.today().isoformat(),
                     "Черновики НЕ ЯВЛЯЮТСЯ утверждёнными картами.",
                     "ФИО в документе не заменяет собственноручную или квалифицированную электронную подпись.",
                     "Утверждённые в приложении карты должны быть оформлены согласно регламенту предприятия.",
                     "Выгружено: "+str(len(cards)),""]
            for pos,item in enumerate(cards,1):
                safe=re.sub(r'[<>:"/\\|?*\x00-\x1f]',"_",item["title"]).strip()[:54]
                base=f"{pos:02d}_{item['kind']}_{item['id']}_v{item['version']}_{safe}"
                for ext,renderer in (("pdf",as_pdf),("docx",as_docx)):
                    if fmt not in (ext,"both"):continue
                    dest=Path(folder)/(base+"."+ext)
                    renderer(dest,venue,item)
                    if not dest.exists() or dest.stat().st_size<1000:
                        raise RuntimeError("Не удалось сформировать "+ext+" для "+item["title"])
                    archive.write(dest,dest.name)
                summary.append(item["title"]+" | "+item["status"]+
                               " | версия "+str(item["version"])+" | "+item["approved_at"])
            archive.writestr("00_Состав_карт.txt","\n".join(summary).encode("utf-8"))
    blob=zipbuffer.getvalue()
    if len(blob)>32*1024*1024:
        raise ValueError("Архив слишком велик. Экспортируйте меньше карт за один раз.")
    return {"mime":"application/zip","filename":"MoOLVa_ТК_ТТК_"+date.today().isoformat()+"_"+fmt+".zip",
            "zip_b64":base64.b64encode(blob).decode("ascii"),
            "count":len(cards),"approved":sum(x["status"]=="approved" for x in cards),
            "drafts":sum(x["status"]=="draft" for x in cards),
            "warning":"Проекты помечены. Рукописные подписи при выгрузке остаются пустыми."}
