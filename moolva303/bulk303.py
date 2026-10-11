"""Mass PDF export of SIX approved journal types for the current calendar month.

Never inserts entries or guesses measurements/signatures. No files are left on
the user's machine; PDFs are generated in a temporary directory, zipped and
returned as a browser-download payload. Dates use the journal observation date
when one exists, otherwise the original immutable record creation date.
"""
from __future__ import annotations

import base64
import io
import json
import tempfile
import zipfile
from dataclasses import replace
from datetime import date, datetime
from pathlib import Path

from exports import export_pdf, get_templates, safe_name
from studio_core import layout_export_spec

# Only these six codes are available via this simple, deliberately scoped screen.
JOURNALS = {
    "fridge": "Журнал температур холодильников",
    "brakerage": "Журнал бракеража готовой продукции",
    "incoming": "Журнал входного контроля сырья",
    "cleaning": "Журнал санитарной обработки",
    "hygiene": "Журнал здоровья сотрудников",
    "equipment": "Журнал контроля оборудования",
}
MAX_ARCHIVE_BYTES = 24 * 1024 * 1024


def month_bounds(instant=None):
    if instant is None:
        instant = datetime.now().astimezone()
    if not isinstance(instant, datetime):
        raise ValueError("Некорректное время формирования выгрузки")
    first = date(instant.year, instant.month, 1)
    if instant.month == 12:
        next_first = date(instant.year + 1, 1, 1)
    else:
        next_first = date(instant.year, instant.month + 1, 1)
    return first.isoformat(), next_first.isoformat()


def _validate_codes(codes):
    if not isinstance(codes, list) or not 1 <= len(codes) <= len(JOURNALS):
        raise ValueError("Выберите от одного до шести журналов")
    if not all(isinstance(v, str) for v in codes) or len(set(codes)) != len(codes):
        raise ValueError("Проверьте список выбранных журналов")
    if set(codes) - set(JOURNALS):
        raise ValueError("Нельзя выгрузить неизвестный журнал")
    # Stable order for stable ZIP contents, irrespective of checkbox click order.
    return [code for code in JOURNALS if code in codes]


def _month_records(store, venue_id, code, first, next_first):
    with store.connect() as db:
        rows = db.execute("""
            SELECT r.id, r.template_code, r.data, r.created_at,
                   r.voided_at, r.void_reason
            FROM journal_records AS r
            LEFT JOIN easy19_web_record_meta AS m
              ON m.venue_id = r.venue_id AND m.record_id = r.id
            WHERE r.venue_id = ? AND r.template_code = ?
              AND r.voided_at IS NULL
              AND COALESCE(NULLIF(m.observation_date, ''),
                           substr(r.created_at, 1, 10)) >= ?
              AND COALESCE(NULLIF(m.observation_date, ''),
                           substr(r.created_at, 1, 10)) < ?
            ORDER BY COALESCE(NULLIF(m.observation_date, ''),
                              substr(r.created_at, 1, 10)), r.id
        """, (venue_id, code, first, next_first)).fetchall()
    result = []
    for row in rows:
        data = json.loads(row["data"])
        if not isinstance(data, dict):
            raise ValueError("Повреждена запись журнала №%s" % row["id"])
        result.append({
            "id": row["id"], "template_code": row["template_code"],
            "data": data, "created_at": row["created_at"],
            "voided_at": None, "void_reason": None
        })
    return result


def export_month(store, venue_id, codes, instant=None):
    selected = _validate_codes(codes)
    venue_id = int(venue_id)
    venue = store.get_venue(venue_id)
    if venue is None:
        raise ValueError("Выберите предприятие")
    first, next_first = month_bounds(instant)
    year, month = first[:4], first[5:7]
    end_day = date.fromisoformat(next_first).toordinal() - 1
    period_end = date.fromordinal(end_day).isoformat()
    requested = {t.code: t for t in get_templates(store)}
    missing = [code for code in selected if code not in requested]
    if missing:
        raise ValueError("Не найдены шаблоны журналов: " + ", ".join(missing))

    date_text = "%s — %s" % (first, period_end)
    generation = (instant or datetime.now().astimezone()).strftime("%d.%m.%Y %H:%M")
    info = []
    buffer = io.BytesIO()
    with tempfile.TemporaryDirectory(prefix="moolva303_") as temporary:
        folder = Path(temporary)
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED,
                             compresslevel=6, allowZip64=True) as archive:
            for position, code in enumerate(selected, 1):
                template = requested[code]
                saved_records = _month_records(store, venue_id, code, first, next_first)
                layout, columns, widths = layout_export_spec(store, venue_id, template)
                if not columns:
                    raise ValueError("В журнале «%s» скрыты все графы" % template.title)
                # Zero blank rows: the "filled records" choice is NOT a blank form.
                layout = dict(layout)
                layout["blank_rows"] = 0
                name = layout.get("title") or template.title
                count = len(saved_records)
                empty_note = ("За этот период сохранённых записей нет. "
                              "Пустые строки и результаты не создавались."
                              if not count else
                              "Только действующие фактические записи; плановые и отменённые не включены.")
                note = (template.note + "\n" +
                        "Выгрузка за " + date_text + ". " +
                        "Сохранённых записей: " + str(count) + ". " + empty_note).strip()
                pdf_template = replace(template, title=name, note=note)
                filename = "%02d_%s.pdf" % (position, safe_name(JOURNALS[code]))
                output = folder / filename
                # Existing established PDF renderer preserves actual column labels,
                # official company metadata, Cyrillic fonts and page wrapping.
                export_pdf(output, venue, pdf_template, columns, saved_records,
                           staff_config={}, staff_appendix=[], ack_employees=[],
                           layout=layout, widths=widths)
                if not output.is_file() or output.stat().st_size < 500:
                    raise RuntimeError("PDF не сформирован: " + name)
                archive.write(output, filename)
                info.append({"code": code, "title": JOURNALS[code],
                             "records": count, "filename": filename})

            index = [
                "MoOLVa ХАССП Easy 3.0.3 — выгрузка сохранённых журналов",
                "Предприятие: " + str(venue.get("venue_name") or ""),
                "Период: " + date_text,
                "Сформировано: " + generation,
                "Формат: PDF, только существующие действующие записи",
                "Источник: локальная SQLite-база выбранного предприятия",
                "Дата контроля: фактическая дата наблюдения при наличии,",
                "иначе дата сохранения записи.",
                "Плановые строки, отменённые записи и вымышленные измерения",
                "в выгрузку не включаются. ФИО не является личной подписью.",
                "Отсутствующие записи не заменяются пустыми строками.",
                "",
                "СОСТАВ ВЫГРУЗКИ",
            ] + [
                "%s — %d сохранённых записей; %s" %
                (row["title"], row["records"], row["filename"])
                for row in info
            ]
            archive.writestr("О_выгрузке.txt", "\n".join(index).encode("utf-8"))

    result = buffer.getvalue()
    if len(result) > MAX_ARCHIVE_BYTES:
        raise ValueError("Архив больше 24 МБ. Выгрузите часть журналов отдельно.")
    filename = "MoOLVa_Журналы_%s_%s_PDF.zip" % (year, month)
    return {
        "filename": filename,
        "mime": "application/zip",
        "zip_b64": base64.b64encode(result).decode("ascii"),
        "journals": info,
        "count": len(info),
        "total_records": sum(row["records"] for row in info),
        "period_start": first,
        "period_end": period_end,
        "notice": "Включены только сохранённые записи. Пустые измерения и подписи не создавались."
    }
