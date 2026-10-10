"""Guided HACCP onboarding 2.2.2. Plans and personnel, not fabricated measurements."""
import json
import re
from datetime import date, datetime
from catalog import TYPES, CATALOG, defaults_for_type, applicability
from storage import now
from easy19_core import migrate19, _period_slot, _advance_slot
from staff_store import migrate_staff, list_employees

DAILY={"hygiene","fridge","warehouse","brakerage","perishable","incoming","heat",
       "hot","cleaning","fryer","sample","child_menu","transport","delivery_temp","thaw"}
PERIODS={"daily","weekly","monthly","yearly"}

def day(value):
    try:
        if not isinstance(value,str) or len(value)!=10 or date.fromisoformat(value).isoformat()!=value: raise ValueError()
        return value
    except (ValueError,TypeError): raise ValueError("Укажите корректную дату начала ГГГГ-ММ-ДД")

def recommendations(kind):
    if kind not in TYPES: raise ValueError("Выберите тип предприятия")
    venue={"kind":kind,"flags":defaults_for_type(kind)}
    return {"journals":[{"code":t.code,"name":t.title,"recommended":bool(applicability(t,venue)[0]),
                         "cadence":"daily" if t.code in DAILY else "weekly"}
                        for t in CATALOG.values()]}

def migrate(store):
    migrate19(store); migrate_staff(store)
    with store.connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS easy222_schedule_starts(
          venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
          journal_key TEXT NOT NULL, start_on TEXT NOT NULL,
          employee_id INTEGER REFERENCES employees(id),
          PRIMARY KEY(venue_id,journal_key))""")

def text(v,label,limit=200,required=False):
    if not isinstance(v,str) or len(v.strip())>limit or (required and not v.strip()):
        raise ValueError("Проверьте поле «"+label+"»")
    return v.strip()

def validate(payload):
    if not isinstance(payload,dict) or not isinstance(payload.get("details"),dict):
        raise ValueError("Некорректные реквизиты")
    keys=("venue_name","legal_name","kind","inn","ogrn","address","legal_address",
          "director","responsible","phone","email")
    raw=payload["details"]
    if set(raw)-set(keys): raise ValueError("Неизвестное поле предприятия")
    d={k:text(raw.get(k,""),k,400 if k in ("address","legal_address") else 200,
              k in ("venue_name","kind")) for k in keys}
    if d["kind"] not in TYPES: raise ValueError("Неизвестный тип заведения")
    if d["inn"] and not re.fullmatch(r"\d{10}|\d{12}",d["inn"]): raise ValueError("ИНН: 10 или 12 цифр")
    if d["ogrn"] and not re.fullmatch(r"\d{13}|\d{15}",d["ogrn"]): raise ValueError("ОГРН: 13 или 15 цифр")
    employees=payload.get("employees",[])
    if not isinstance(employees,list) or len(employees)>100: raise ValueError("Неверный список сотрудников")
    ppl=[]
    for x in employees:
        if not isinstance(x,dict): raise ValueError("Неверный сотрудник")
        ppl.append({"name":text(x.get("name",""),"ФИО",180,True),
                    "position":text(x.get("position",""),"Должность",160,True)})
    names={x["name"] for x in ppl}
    if len(names)!=len(ppl): raise ValueError("Повторяется ФИО сотрудника")
    journals=payload.get("journals",[])
    if not isinstance(journals,list) or len(journals)>len(CATALOG): raise ValueError("Неверный список журналов")
    result=[];seen=set()
    for j in journals:
        if not isinstance(j,dict): raise ValueError("Проверьте параметры журнала")
        code=j.get("code")
        if not isinstance(code,str) or code not in CATALOG or code in seen:
            raise ValueError("Неизвестный либо повторный журнал")
        seen.add(code)
        cadence=j.get("cadence")
        if cadence not in PERIODS: raise ValueError("Укажите периодичность")
        clock=j.get("clock")
        if not isinstance(clock,str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d",clock):
            raise ValueError("Укажите время ЧЧ:ММ")
        start=day(j.get("start_on"))
        employee=j.get("employee","")
        if not isinstance(employee,str) or (employee and employee not in names):
            raise ValueError("Сотрудник должен быть из списка")
        owner=employee or text(j.get("owner",""),"Ответственный",150,True)
        dstart=date.fromisoformat(start)
        result.append({"code":code,"cadence":cadence,"clock":clock,"start_on":start,
                       "weekday":dstart.weekday(),"monthday":dstart.day,"annual_month":dstart.month,
                       "employee":employee,"owner":owner})
    return d,ppl,result

def create(store,payload):
    d,people,journals=validate(payload)
    migrate(store);stamp=now()
    # Atomic transaction ensures incomplete enterprises cannot be created by a partial failure.
    with store.connect() as db:
        cur=db.execute("""INSERT INTO venues(venue_name,legal_name,kind,inn,ogrn,address,legal_address,
             director,responsible,phone,email,flags,extra,updated_at)
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
             (d["venue_name"],d["legal_name"],d["kind"],d["inn"],d["ogrn"],d["address"],
              d["legal_address"],d["director"],d["responsible"],d["phone"],d["email"],
              json.dumps(defaults_for_type(d["kind"]),ensure_ascii=False),"{}",stamp))
        vid=cur.lastrowid;ids={}
        for p in people:
            rec=db.execute("""INSERT INTO employees(venue_id,full_name,position_code,position_name,
               department,qualification,phone,notes,updated_at) VALUES(?,?,?,?,?,?,?,?,?)""",
               (vid,p["name"],"",p["position"],"","","","",stamp))
            ids[p["name"]]=rec.lastrowid
        for j in journals:
            key="legacy:"+j["code"]
            db.execute("""INSERT INTO easy19_schedules
                (venue_id,journal_key,title,cadence,weekday,monthday,annual_month,clock,owner,active,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
                (vid,key,CATALOG[j["code"]].title,j["cadence"],j["weekday"],j["monthday"],
                 j["annual_month"],j["clock"],j["owner"],1,stamp,stamp))
            db.execute("INSERT INTO easy222_schedule_starts VALUES(?,?,?,?)",
                       (vid,key,j["start_on"],ids.get(j["employee"])))
            db.execute("""INSERT INTO manual_selection(venue_id,template_code,selected) VALUES(?,?,1)
                ON CONFLICT(venue_id,template_code) DO UPDATE SET selected=1""",(vid,j["code"]))
        store._audit(db,vid,"venue_222_guided_created",{"employees":len(people),"journals":len(journals)})
    return {"venue":vid,"employees":len(people),"schedules":len(journals)}

def enrich(store,vid,schedules):
    migrate(store)
    with store.connect() as db:
        starts={r["journal_key"]:dict(r) for r in db.execute(
            "SELECT journal_key,start_on,employee_id FROM easy222_schedule_starts WHERE venue_id=?",(vid,))}
    for s in schedules:
        rec=starts.get(s["journal_key"])
        if not rec: continue
        s["start_on"]=rec["start_on"];s["employee_id"]=rec["employee_id"]
        start=datetime.combine(date.fromisoformat(rec["start_on"]),datetime.strptime(s["clock"],"%H:%M").time())
        if s["due"]<start:
            candidate=_period_slot(s,start)
            while candidate<start:candidate=_advance_slot(s,candidate)
            s["due"]=candidate;s["stage"]="Запланировано"
    return schedules

def set_start(store,vid,key,value,owner=""):
    value=day(value);migrate(store)
    with store.connect() as db:
        if not db.execute("SELECT 1 FROM easy19_schedules WHERE venue_id=? AND journal_key=?",(vid,key)).fetchone():
            raise ValueError("График предприятия не найден")
        employee=db.execute("SELECT id FROM employees WHERE venue_id=? AND active=1 AND full_name=?",
                            (vid,str(owner or "").strip())).fetchone()
        db.execute("""INSERT INTO easy222_schedule_starts(venue_id,journal_key,start_on,employee_id)
           VALUES(?,?,?,?) ON CONFLICT(venue_id,journal_key)
           DO UPDATE SET start_on=excluded.start_on,employee_id=excluded.employee_id""",
           (vid,key,value,employee[0] if employee else None))
        store._audit(db,vid,"schedule222_start_changed",{"journal_key":key,"start_on":value})
