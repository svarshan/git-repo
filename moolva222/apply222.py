"""Apply MoOLVa 2.2.2 guided enterprise onboarding onto reviewed Native 2.2.1 sources."""
from pathlib import Path
import sys, shutil

root=Path(sys.argv[1]).resolve()
src=Path(__file__).resolve().parent
if not (root/'web19_bridge.py').is_file(): raise SystemExit("Wrong source directory")

def edit(path,needle,replacement):
    p=root/path
    s=p.read_text(encoding="utf-8")
    if needle not in s: raise RuntimeError("Source changed unexpectedly: "+str(path)+" :: "+needle[:70])
    p.write_text(s.replace(needle,replacement,1),encoding="utf-8")

(root/'tests').mkdir(parents=True,exist_ok=True)
shutil.copy2(src/'onboarding222.py',root/'onboarding222.py')
shutil.copy2(src/'test_onboarding222.py',root/'tests'/'test_onboarding222.py')

edit(Path('web19_bridge.py'),'import smart22\n','import smart22\nimport onboarding222\nfrom staff_store import list_employees\n')
edit(Path('web19_bridge.py'),'        smart22.migrate(self.store)\n','        smart22.migrate(self.store)\n        onboarding222.migrate(self.store)\n')
edit(Path('web19_bridge.py'),'        schedules = list_schedules19(self.store, vid)\n','        schedules = onboarding222.enrich(self.store, vid, list_schedules19(self.store, vid))\n')
edit(Path('web19_bridge.py'),"'schedules':schedules,'templates':templates,",
     "'schedules':schedules,'templates':templates,'employees222':"+
     "[{'id':e['id'],'name':e['full_name'],'position':e['position_name']} for e in list_employees(self.store,vid)],")
edit(Path('web19_bridge.py'),"        if action == 'create_venue':\n",
     "        if action == 'onboarding_preview':\n"+
     "            return onboarding222.recommendations(required(b.get('kind'),'Тип предприятия'))\n"+
     "        if action == 'create_venue_guided':\n"+
     "            return onboarding222.create(self.store,b.get('setup'))\n"+
     "        if action == 'create_venue':\n")
edit(Path('web19_bridge.py'),"        if action == 'save_schedule':\n",
     "        if action == 'save_schedule':\n"+
     "            if b.get('start_on'): onboarding222.day(b['start_on'])\n")
edit(Path('web19_bridge.py'),
     "                          required(b.get('owner'),'Ответственный',150),b.get('active',True))\n            return {'saved':True}",
     "                          required(b.get('owner'),'Ответственный',150),b.get('active',True))\n"+
     "            if b.get('start_on'): onboarding222.set_start(self.store,vid,b['journal_key'],b['start_on'],b.get('owner'))\n"+
     "            return {'saved':True}")

edit(Path('accounts203.py'),
     "'create_venue','delete_venue','account_settings','technical_settings'",
     "'create_venue','create_venue_guided','onboarding_preview','delete_venue','account_settings','technical_settings'")

html=root/'web19'/'index.html'
s=html.read_text(encoding='utf-8')
assert 'o222-modal' not in s
wizard="""<div class="modal" id="o222-modal" role="presentation">
<div id="o222-dialog" role="dialog" aria-modal="true" aria-labelledby="o222-title">
<div id="o222-head"><div id="o222-headline"><h2 id="o222-title">Новое предприятие</h2><button class="btn" id="o222-close" type="button" aria-label="Закрыть">✕</button></div><div id="o222-progress"></div></div>
<div id="o222-content" aria-live="polite"></div>
<div id="o222-foot"><button type="button" class="btn" id="o222-back">← Назад</button><span id="o222-note" class="fine">Шаг 1 из 6</span><button type="button" class="btn primary" id="o222-next">Далее →</button></div>
</div></div>"""
assert '</body>' in s
s=s.replace('</body>',wizard+'\n<style>'+ (src/'css222.css').read_text(encoding='utf-8') +'</style>\n<script>'+
            (src/'ui222.js').read_text(encoding='utf-8')+'</script></body>',1)
s=s.replace('Создать предприятие →','Создать предприятие по шагам →')
s=s.replace('MoOLVa ХАССП Easy 2.2.1','MoOLVa ХАССП Easy 2.2.2')
s=s.replace("clock:$('schedule-time').value,owner:$('schedule-owner').value,weekday",
            "clock:$('schedule-time').value,owner:$('schedule-owner').value,start_on:$('schedule-start').value,weekday")
s=s.replace("<div class=\"formfield\"><label>Ответственный *</label><input id=\"schedule-owner\" placeholder=\"ФИО ответственного за заполнение\"></div>",
            "<div class=\"formfield\"><label>Дата начала графика "+
            "<button class=\"tip\" type=\"button\" title=\"Плановая дата начала; не фактическая проверка\">?</button></label>"+
            "<input type=\"date\" id=\"schedule-start\"></div><div class=\"formfield\"><label>Ответственный *</label>"+
            "<input id=\"schedule-owner\" list=\"schedule-staff-options\" placeholder=\"ФИО ответственного за заполнение\">"+
            "<datalist id=\"schedule-staff-options\"></datalist></div>")
s=s.replace("$('schedule-owner').value=s?.owner||'';",
            "$('schedule-owner').value=s?.owner||'';"+
            "$('schedule-start').value=s?.start_on||(new Date()).toISOString().slice(0,10);"+
            "$('schedule-staff-options').innerHTML=(state.employees222||[]).map(x=>"+
            "'<option value=\"'+esc(x.name)+'\"></option>').join('');")
html.write_text(s,encoding='utf-8')

for part in ("native221/Desktop/MainWindow.xaml.cs","native221/Desktop/MainWindow.xaml",
             "native221/Desktop/MoOLVaDesktop.csproj","native221/Desktop/app.manifest",
             "scripts/native_windows_e2e221.py","web19_bridge.py"):
    f=root/part;content=f.read_text(encoding="utf-8")
    f.write_text(content.replace("2.2.1","2.2.2"),encoding="utf-8")
lic=root/'LICENSE_RU.txt'
if lic.exists():
    content=lic.read_text(encoding="utf-8")
    lic.write_text(content.replace('MoOLVa ХАССП Easy 2.0.4','MoOLVa ХАССП Easy 2.2.2'),encoding="utf-8")
print("MoOLVa 2.2.2 patch applied")
