"""MoOLVa HACCP Easy 3.0 Enterprise: on-device guidance and shift operations.

All actual readings, sign-offs and HACCP attestations require explicit human input.
This module stores plans, training acknowledgements and shift notes only.
"""
from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, date, timedelta
from pathlib import Path
from contextlib import closing

from storage import now
from easy19_core import list_schedules19, _period_slot
from mature17_core import list_equipment_events, list_documents
from enterprise23 import shift_board, employee_shifts, leadership_summary

TRAINING = (
    ("start", "Начало смены", "Откройте «Мой рабочий день», проверьте срок и ответственного за каждую задачу."),
    ("logs", "Фактические записи", "Измерение нужно выполнить прибором и записать реальное значение. Программа не подставляет результат."),
    ("storage", "Склад и партии", "Сверьте накладную, маркировку, количество, сроки годности и условия хранения."),
    ("equipment", "Контроль оборудования", "Проверьте фактическую температуру, запишите результат и сообщите об отклонении."),
    ("ttk", "Технологические карты", "Используйте утверждённую ТТК, укажите реальные ингредиенты и количество порций."),
    ("cleaning", "Санитарная обработка", "Отмечайте только фактически завершённую уборку и используемые средства."),
    ("deviation", "Отклонения", "При выходе за пределы укажите фактические действия и ответственного."),
    ("handover", "Передача смены", "Передайте следующему сотруднику нерешённые вопросы и ссылки на задачи."),
    ("documents", "Документы", "Проверьте актуальность инструкций и обязательных документов предприятия."),
    ("backup", "Резервное копирование", "Сохраняйте проверенные копии базы и периодически испытывайте восстановление."),
)

ASSISTANT = (
    (("температур", "холодиль", "морозиль", "градус"), "Откройте журнал температуры, выберите оборудование, снимите фактическое показание термометра и подтвердите запись. Если есть настроенный предел, программа проверит отклонение. Не вводите примерные значения."),
    (("прием", "приём", "постав", "парт"), "Откройте «Склад и партии». Сверьте документы поставки, наименование, дату, партию, количество и срок годности. Запишите только фактически принятое."),
    (("убор", "дезинф", "санитар", "мойк"), "Откройте журнал санитарной обработки. Сначала выполните работы по местной инструкции, затем внесите дату, ответственного и реальные сведения."),
    (("подпис", "подпись", "подтверд"), "Подтверждение вносит только ответственный сотрудник после фактического действия. Система не создаёт подписи и не подтверждает проверки автоматически."),
    (("смен", "передач"), "Откройте «Рабочий день 3.0» → «Передача смены». Укажите сотрудника, текст и нерешённые задачи. Получатель должен самостоятельно проверить сообщение."),
    (("копи", "восстанов", "обновлен", "обновлени"), "В «Диагностике» проверьте целостность базы. Создайте резервную копию через существующий центр управления, прежде чем изменять программу."),
    (("журнал", "заполн"), "В «Моих журналах» выберите нужный журнал и следуйте шагам мастера. Даты плана и ответственный могут подставляться, а измерения и подтверждения — нет."),
    (("хассп", "аудит", "проверк"), "Откройте «Проверка ХАССП». Проверьте планы, заполненные записи, сроки и отклонения. Система помогает найти пробелы, но не заменяет внутренний аудит."),
)

def migrate(store):
    with store.connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS easy30_shift_handover(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
            sender TEXT NOT NULL,
            recipient TEXT NOT NULL DEFAULT '',
            note TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_easy30_handover
          ON easy30_shift_handover(venue_id,id);
        CREATE TABLE IF NOT EXISTS easy30_training_ack(
            venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
            account_id INTEGER NOT NULL,
            module_key TEXT NOT NULL,
            acknowledged_at TEXT NOT NULL,
            PRIMARY KEY(venue_id,account_id,module_key)
        );
        CREATE TABLE IF NOT EXISTS easy30_planned_check(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
            journal_key TEXT NOT NULL,
            planned_for TEXT NOT NULL,
            responsible TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','cancelled')),
            created_at TEXT NOT NULL,
            UNIQUE(venue_id,journal_key,planned_for)
        );
        CREATE INDEX IF NOT EXISTS idx_easy30_plan
          ON easy30_planned_check(venue_id,planned_for);
        """)

def _text(value,label,limit=250,required=True):
    if not isinstance(value,str):
        raise ValueError("Некорректное поле: "+label)
    value=value.strip()
    if (required and not value) or len(value)>limit:
        raise ValueError("Проверьте поле «"+label+"»")
    return value

def _day(value):
    value=_text(value,"Дата",10)
    try:
        if date.fromisoformat(value).isoformat()!=value:raise ValueError()
    except ValueError as exc:
        raise ValueError("Введите дату в формате ГГГГ-ММ-ДД") from exc
    return value

def _check_venue(store,vid):
    vid=int(vid)
    if vid<=0:
        raise ValueError("Выберите предприятие")
    with store.connect() as db:
        if not db.execute("SELECT 1 FROM venues WHERE id=?",(vid,)).fetchone():
            raise ValueError("Предприятие не найдено")
    return vid

def dashboard(store, vid, employee=""):
    vid=_check_venue(store,vid)
    if employee:
        names={r["name"] for r in employee_shifts(store,vid)}
        if employee not in names:
            raise ValueError("Выберите сотрудника из списка предприятия")
    schedules=list_schedules19(store,vid)
    for s in schedules:
        s["completed_current_period"]=bool(
          s.get("last_completed_slot") == _period_slot(s,datetime.now()).isoformat(timespec="minutes")
        )
    board=shift_board(schedules,list_equipment_events(store,vid),[],employee)
    with store.connect() as db:
        plans=[dict(r) for r in db.execute("""
          SELECT id,journal_key,planned_for,responsible,status FROM easy30_planned_check
          WHERE venue_id=? AND planned_for BETWEEN ? AND ? AND status='planned'
          ORDER BY planned_for,id LIMIT 100
        """,(vid,date.today().isoformat(),(date.today()+timedelta(days=7)).isoformat()))]
        handovers=[dict(r) for r in db.execute("""
          SELECT id,sender,recipient,note,created_at FROM easy30_shift_handover
          WHERE venue_id=? ORDER BY id DESC LIMIT 10
        """,(vid,))]
        last_entry=db.execute("""
          SELECT MAX(created_at) FROM journal_records WHERE venue_id=? AND voided_at IS NULL
        """,(vid,)).fetchone()[0]
        open_deviations=0
        try:
            open_deviations=db.execute("""
              SELECT COUNT(*) FROM easy24_deviations WHERE venue_id=? AND status NOT IN ('closed','resolved')
            """,(vid,)).fetchone()[0]
        except sqlite3.OperationalError:
            pass
    return {"employee":employee,"tasks":board["tasks"],"overdue":board["overdue"],
            "planned":plans,"handovers":handovers,"last_record_at":last_entry,
            "open_deviations":open_deviations,
            "completed_schedules":sum(bool(s["completed_current_period"]) for s in schedules),
            "total_schedules":len(schedules),
            "notice":"Задачи и плановые записи не подтверждают факт выполнения. Измерения и подписи вносятся вручную."}

def plan_checks(store, vid, journal_key, start_day, count, responsible):
    vid=_check_venue(store,vid)
    journal_key=_text(journal_key,"Журнал",180)
    start=date.fromisoformat(_day(start_day))
    count=int(count)
    if not 1<=count<=31:raise ValueError("Можно запланировать от 1 до 31 строки")
    responsible=_text(responsible,"Ответственный",180)
    if start<date.today()-timedelta(days=1):
        raise ValueError("Нельзя создавать план в далёком прошлом")
    with store.connect() as db:
        exists=db.execute("""
          SELECT 1 FROM easy19_schedules WHERE venue_id=? AND journal_key=? AND active=1
        """,(vid,journal_key)).fetchone()
        if not exists:raise ValueError("Сначала настройте график выбранного журнала")
        made=0
        scheduled=0
        for days in range(366):
            if scheduled>=count:break
            when=start+timedelta(days=days)
            if when.weekday()>=5:continue
            scheduled+=1
            cur=db.execute("""
              INSERT OR IGNORE INTO easy30_planned_check
              (venue_id,journal_key,planned_for,responsible,created_at)
              VALUES(?,?,?,?,?)
            """,(vid,journal_key,when.isoformat(),responsible,now()))
            made+=int(cur.rowcount>0)
        if made:
            store._audit(db,vid,"enterprise30_planned",
                         {"journal_key":journal_key,"count":made,"actor":responsible})
    return {"created":made,"notice":"Созданы только плановые строки, без измерений, подписи или отметки о выполнении."}

def handover(store,vid,sender,recipient,note):
    vid=_check_venue(store,vid)
    sender=_text(sender,"Передающий смену",180)
    recipient=_text(recipient,"Получатель",180,False)
    note=_text(note,"Что передать следующей смене",2000)
    with store.connect() as db:
        cursor=db.execute("""
          INSERT INTO easy30_shift_handover(venue_id,sender,recipient,note,created_at)
          VALUES(?,?,?,?,?)
        """,(vid,sender,recipient,note,now()))
        store._audit(db,vid,"enterprise30_handover",
                     {"handover_id":cursor.lastrowid,"sender":sender})
    return {"saved":True,"id":cursor.lastrowid}

def training(store,vid,account_id):
    vid=_check_venue(store,vid)
    with store.connect() as db:
        done={r[0] for r in db.execute("""
          SELECT module_key FROM easy30_training_ack WHERE venue_id=? AND account_id=?
        """,(vid,int(account_id)))}
    return {"items":[{"key":key,"name":name,"help":helptext,"read":key in done}
                     for key,name,helptext in TRAINING],
            "note":"Отметка означает только прочтение учебного материала, не выполнение проверки."}

def training_ack(store,vid,account_id,key):
    vid=_check_venue(store,vid)
    key=_text(key,"Учебная тема",50)
    if key not in {x[0] for x in TRAINING}:raise ValueError("Учебная тема не найдена")
    with store.connect() as db:
        db.execute("""INSERT OR IGNORE INTO easy30_training_ack VALUES(?,?,?,?)""",
                   (vid,int(account_id),key,now()))
        store._audit(db,vid,"enterprise30_training_read",{"account_id":int(account_id),"module":key})
    return {"saved":True}

def assistant(question):
    question=_text(question,"Вопрос",350)
    term=question.casefold()
    answer=next((answer for aliases,answer in ASSISTANT if any(a in term for a in aliases)),None)
    if answer is None:
        answer=("Помогу найти раздел: «Мои журналы» — записи, «Склад» — товары и партии, "
                "«Документы» — инструкции, «Рабочий день 3.0» — задачи и смены. "
                "Уточните, что именно нужно заполнить.")
    return {"answer":answer,"rule_based":True,
            "disclaimer":"Справка без внешнего ИИ. Не выдаёт нормативное заключение и не создаёт фактические записи."}

def search(store,vid,query):
    vid=_check_venue(store,vid)
    query=_text(query,"Что найти",100)
    needle=query.casefold()
    results=[]
    for item in list_schedules19(store,vid):
        if needle in str(item.get("title","")).casefold():
            results.append({"type":"Журнал","title":item["title"],"destination":"journals"})
    for item in list_documents(store,vid)[:250]:
        if needle in str(item.get("title","")).casefold():
            results.append({"type":"Документ","title":item["title"],"destination":"documents"})
    for item in employee_shifts(store,vid):
        if needle in (item["name"]+" "+item["position"]).casefold():
            results.append({"type":"Сотрудник","title":item["name"],"destination":"shift"})
    return {"items":results[:50]}

def health(store,vid):
    vid=_check_venue(store,vid)
    with store.connect() as db:
        integrity=db.execute("PRAGMA quick_check").fetchone()[0]
        records=db.execute("SELECT COUNT(*) FROM journal_records WHERE venue_id=? AND voided_at IS NULL",(vid,)).fetchone()[0]
        events=db.execute("SELECT COUNT(*) FROM audit_events WHERE venue_id=?",(vid,)).fetchone()[0]
    return {"database_integrity":integrity,"records":records,"audit_events":events,
            "checked_at":now(),"data_path":str(store.path.parent),
            "notice":"Диагностика без изменений базы. Сохранность резервной копии проверяется отдельно."}
