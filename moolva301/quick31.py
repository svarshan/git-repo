"""MoOLVa 3.0.1: single-screen journal entry with reusable, non-measurement defaults.

A preset stores only equipment/zone/responsible and approved static labels.
Actual readings, results, cleaning confirmations, signatures and interventions
are NEVER copied into later entries. The server timestamps each save.
"""
from __future__ import annotations
import json
from datetime import datetime
from contextlib import closing
from mature17_core import list_forms
from exports import columns_for
from storage import now

def migrate(store):
    with store.connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS quick31_presets(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
          code TEXT NOT NULL, title TEXT NOT NULL,
          equipment TEXT NOT NULL, zone TEXT NOT NULL, responsible TEXT NOT NULL,
          fixed_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          UNIQUE(venue_id,code,title)
        );
        CREATE INDEX IF NOT EXISTS idx_quick31_venue_code ON quick31_presets(venue_id,code);
        CREATE TABLE IF NOT EXISTS quick31_saved_requests(
          venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
          request_key TEXT NOT NULL,
          record_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY(venue_id,request_key)
        );
        """)

def _required(value,name,limit=200):
    if not isinstance(value,str) or not value.strip() or len(value.strip())>limit:
        raise ValueError('Укажите «'+name+'»')
    return value.strip()

def _columns(service,vid,code):
    if not isinstance(code,str):
        raise ValueError('Выберите журнал')
    if code.startswith('form:'):
        try:form_id=int(code.split(':',1)[1])
        except ValueError as exc:raise ValueError('Некорректный код журнала') from exc
        match=next((f for f in list_forms(service.store,vid) if int(f['id'])==form_id),None)
        if match is None:raise ValueError('Журнал предприятия не найден')
        return [{'key':x['name'],'label':x['name'],'required':bool(x['required']),'type':x.get('type','text')}
                for x in match['fields']]
    template=service._templates().get(code)
    if not template:raise ValueError('Журнал предприятия не найден')
    return [{'key':key,'label':label,'required':not any(z in label.lower() for z in
            ('подпись','примечание','комментарий','дата фактической реализации')),
            'type':'text'} for key,label in columns_for(service.store,vid,template)]

def _kind(code,col):
    key=col['key']
    label=str(col['label']).lower().replace('ё','е')
    if code=='fridge':
        return {'c1':'auto_stamp','c2':'zone','c3':'equipment','c4':'reading'}.get(key,'reading')
    # A signature is not an owner name and must always be entered by a human if required.
    if any(w in label for w in ('подпис','подтвержден','согласован','утвержден')):
        return 'reading'
    if any(w in label for w in ('дата и время','дата/время','дата, время')):
        return 'auto_stamp'
    # Only examination timestamps are generated; expiry, preparation and delivery dates
    # are genuine facts, and remain editable.
    datewords=('осмотр','контрол','проверк','измерен','замер','регистрац')
    if (label=='дата' or (label.startswith('дата ') and any(t in label for t in datewords))):
        return 'auto_date'
    if label=='время' or (label.startswith('время ') and any(t in label for t in datewords)):
        return 'auto_time'
    if 'ответствен' in label and not any(x in label for x in ('подпис','подтверж')):
        return 'responsible'
    # Static descriptors only. All operational outcomes MUST remain inputs.
    if any(x in label for x in ('температур','влажност','показан','измер','результат',
           'отклонен','действи','состояни','обработк','выполнен','уборк',
           'проведено','факт','срок годност','расход','остаток','количеств',
           'масса','объем','объём','дата изготовл','дата поставк','дата прием',
           'дата прие','давлен','кислот','чистот','порци','проб','исправност',
           'осмотр','проверен','наблюден','выпуск','вывод','запись','контроль')):
        return 'reading'
    if any(x in label for x in ('оборудован','расположен','помещен','участок','отделен',
                                 'место ','цех','линия','камер','зона','пищеблок',
                                 'инвентарн','объект','предельн','допуск по карте',
                                 'предел по процедур','нормативное значение')):
        return 'fixed'
    return 'reading'

def describe(service,vid,code):
    columns=_columns(service,vid,code)
    return [{**x,'kind':_kind(code,x)} for x in columns]

def listing(service,vid,code):
    columns=describe(service,vid,code)
    with service.store.connect() as db:
        entries=[dict(x) for x in db.execute("""
            SELECT id,title,equipment,zone,responsible,fixed_json,updated_at
            FROM quick31_presets WHERE venue_id=? AND code=? ORDER BY title,id
        """,(vid,code))]
    for x in entries:
        x['fixed']=json.loads(x.pop('fixed_json'))
    return {'profiles':entries,'columns':columns,
            'explanation':'Сохраняются только постоянные реквизиты. Дата и время ставятся при записи, факты вводятся каждый раз.'}

def _get(service,vid,profile_id):
    try:profile_id=int(profile_id)
    except (TypeError,ValueError) as exc:raise ValueError('Выберите настройки журнала') from exc
    with service.store.connect() as db:
        row=db.execute("SELECT * FROM quick31_presets WHERE venue_id=? AND id=?",
                       (vid,profile_id)).fetchone()
    if row is None:raise ValueError('Настройки этого предприятия не найдены')
    return dict(row)

def save_profile(service,vid,payload):
    if not isinstance(payload,dict):raise ValueError('Некорректные настройки журнала')
    code=_required(payload.get('code'),'Журнал',80)
    cols=describe(service,vid,code)
    fixed_keys={c['key'] for c in cols if c['kind']=='fixed'}
    static=payload.get('fixed',{})
    if not isinstance(static,dict) or set(static)-fixed_keys:
        raise ValueError('Постоянные реквизиты содержат неизвестные поля')
    static_clean={}
    for key,value in static.items():
        if not isinstance(value,(str,int,float)) or len(str(value))>500:
            raise ValueError('Проверьте постоянные реквизиты')
        if str(value).strip():
            static_clean[key]=str(value).strip()
    title=_required(payload.get('title'),'Название настройки',120)
    equipment=_required(payload.get('equipment'),'Оборудование / объект',200)
    zone=_required(payload.get('zone'),'Зона / расположение',200)
    actor=_required(payload.get('responsible'),'Ответственный сотрудник',150)
    profile_id=payload.get('id')
    stamp=now()
    with service.store.connect() as db:
        if profile_id:
            old=db.execute("SELECT id FROM quick31_presets WHERE id=? AND venue_id=? AND code=?",
                           (int(profile_id),vid,code)).fetchone()
            if not old:raise ValueError('Нельзя менять чужие настройки')
            db.execute("""UPDATE quick31_presets
              SET title=?,equipment=?,zone=?,responsible=?,fixed_json=?,updated_at=?
              WHERE id=? AND venue_id=?""",(title,equipment,zone,actor,
               json.dumps(static_clean,ensure_ascii=False),stamp,int(profile_id),vid))
            result=int(profile_id)
        else:
            cursor=db.execute("""INSERT INTO quick31_presets
              (venue_id,code,title,equipment,zone,responsible,fixed_json,created_at,updated_at)
              VALUES(?,?,?,?,?,?,?,?,?)""",(vid,code,title,equipment,zone,actor,
              json.dumps(static_clean,ensure_ascii=False),stamp,stamp))
            result=cursor.lastrowid
        service.store._audit(db,vid,'quick31_profile_saved',
                            {'profile_id':result,'code':code,'actor':actor})
    return {'id':result,'saved':True}

def save_measurement(service,vid,payload,user):
    if not isinstance(payload,dict):raise ValueError('Неверные данные проверки')
    profile=_get(service,vid,payload.get('profile_id'))
    code=profile['code']
    cols=describe(service,vid,code)
    answers=payload.get('readings')
    if not isinstance(answers,dict):raise ValueError('Введите фактические показатели')
    actual_keys={c['key'] for c in cols if c['kind']=='reading'}
    if set(answers)-actual_keys:raise ValueError('Переданы неизвестные показатели')
    if payload.get('confirmed') is not True:
        raise ValueError('Подтвердите, что измерение действительно выполнено сейчас')
    readings={}
    for c in cols:
        if c['kind']!='reading':continue
        v=answers.get(c['key'],'')
        if not isinstance(v,(str,int,float)):
            raise ValueError('Некорректный факт в поле «'+c['label']+'»')
        v=str(v).strip()
        if len(v)>1000:raise ValueError('Слишком длинный результат')
        if c['required'] and not v:raise ValueError('Введите фактическое значение «'+c['label']+'»')
        readings[c['key']]=v
    # Stable metadata comes ONLY from the saved profile. Measurement fields never do.
    fixed=json.loads(profile['fixed_json'])
    stamp=datetime.now().astimezone()
    day=stamp.strftime('%Y-%m-%d')
    clock=stamp.strftime('%H:%M')
    results={}
    for c in cols:
        kind=c['kind'];key=c['key']
        if kind=='reading':results[key]=readings.get(key,'')
        elif kind=='fixed':results[key]=fixed.get(key,'')
        elif kind=='equipment':results[key]=profile['equipment']
        elif kind=='zone':results[key]=profile['zone']
        elif kind=='responsible':results[key]=profile['responsible']
        elif kind=='auto_date':results[key]=day
        elif kind=='auto_time':results[key]=clock
        elif kind=='auto_stamp':results[key]=day+' '+clock
    # Pass through the EXISTING record endpoint: validation, deviations, reminders,
    # draft clearing, audit and original exports remain intact.
    body={'venue':vid,'code':code,'photo':'','fields':results,
          'observation':{'date':day,'time':clock,'equipment':profile['equipment'],
                         'zone':profile['zone'],'owner':profile['responsible'],
                         'comment':str(payload.get('comment') or '')[:1000]},
          'confirmed':True}
    request_key=payload.get('request_key')
    if request_key:
        request_key=_required(request_key,'Ключ проверки',120)
        with service.store.connect() as db:
            old=db.execute("SELECT record_id FROM quick31_saved_requests WHERE venue_id=? AND request_key=?",
                           (vid,request_key)).fetchone()
            if old:return {'record_id':old[0],'saved':True,'duplicate':True,'deviations':[],
                           'at':day+' '+clock}
    saved=service.action('record',body,user)
    if request_key:
        with service.store.connect() as db:
            db.execute("""INSERT INTO quick31_saved_requests
                      (venue_id,request_key,record_id,created_at) VALUES(?,?,?,?)""",
                       (vid,request_key,saved['record_id'],now()))
    saved['at']=day+' '+clock
    return saved
