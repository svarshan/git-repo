"""Apply 3.0 Enterprise atop the verified 2.4/2.6 Windows source overlay.

Exact anchors guard against silently patching a different release.
"""
from pathlib import Path
import shutil
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: python moolva300/apply300.py <moolva_src>")
root=Path(sys.argv[1]).resolve()
overlay=Path(__file__).resolve().parent
bridge=root/"web19_bridge.py"
ui=root/"web19"/"index.html"
if not bridge.is_file() or not ui.is_file():
    raise SystemExit("Missing native source files")

source=bridge.read_text(encoding="utf-8")
def replace_once(value, old, new, label):
    if old not in value:
        if new in value:
            return value
        raise SystemExit("Cannot patch 3.0: "+label)
    return value.replace(old,new,1)

source=replace_once(source,
    "import intelligent24\n",
    "import intelligent24\nimport enterprise30\n",
    "Enterprise import")
source=replace_once(source,
    "        intelligent24.migrate(self.store)\n",
    "        intelligent24.migrate(self.store)\n        enterprise30.migrate(self.store)\n",
    "Enterprise migration")
anchor="        vid = self._venue(b.get('venue'))"
if anchor not in source:
    raise SystemExit("Enterprise route anchor missing")
dispatcher="""        if action.startswith('enterprise30_'):
            if user is None:
                raise ValueError('Необходимо войти в личный кабинет')
            vid30=self._venue(b.get('venue'))
            if action=='enterprise30_board':
                return enterprise30.dashboard(self.store,vid30,str(b.get('employee') or ''))
            if action=='enterprise30_training':
                return enterprise30.training(self.store,vid30,user['id'])
            if action=='enterprise30_training_ack':
                return enterprise30.training_ack(self.store,vid30,user['id'],b.get('key'))
            if action=='enterprise30_plan':
                return enterprise30.plan_checks(self.store,vid30,b.get('journal_key'),
                    b.get('start_on'),b.get('count'),b.get('owner'))
            if action=='enterprise30_handover':
                return enterprise30.handover(self.store,vid30,b.get('sender'),b.get('recipient',''),b.get('note'))
            if action=='enterprise30_assistant':
                return enterprise30.assistant(b.get('question'))
            if action=='enterprise30_search':
                return enterprise30.search(self.store,vid30,b.get('query'))
            if action=='enterprise30_health':
                return enterprise30.health(self.store,vid30)
            raise ValueError('Неизвестная функция Enterprise 3.0')
"""
source=replace_once(source,anchor,anchor+"\n"+dispatcher,"Enterprise action dispatcher")
# Version labels and app status (do not touch the storage schema itself).
source=source.replace("'version':'2.4.0'","'version':'3.0.0'")
source=source.replace("'version':'2.5.0'","'version':'3.0.0'")
source=source.replace("'2.4.0'","'3.0.0'") if "version']=='2.4.0'" in source else source
source=source.replace("'2.5.0'","'3.0.0'") if "version']=='2.5.0'" in source else source
bridge.write_text(source,encoding="utf-8")

shutil.copy2(overlay/"enterprise30.py",root/"enterprise30.py")
html=ui.read_text(encoding="utf-8")
html=html.replace("2.4.0","3.0.0").replace("2.5.0","3.0.0")
js=(overlay/"enterprise30_ui.js").read_text(encoding="utf-8")
if "enterprise30-page" not in html:
    if "</body>" not in html:
        raise SystemExit("Cannot append Enterprise workspace: missing HTML body")
    html=html.replace("</body>","<script>\n"+js+"\n</script></body>",1)
ui.write_text(html,encoding="utf-8")

project=root/"native221"/"Desktop"/"MoOLVaDesktop.csproj"
if project.is_file():
    text=project.read_text(encoding="utf-8")
    text=text.replace("<Version>2.4.0</Version>","<Version>3.0.0</Version>")
    text=text.replace("<Version>2.5.0</Version>","<Version>3.0.0</Version>")
    project.write_text(text,encoding="utf-8")
(root/".moolva_easy_version").write_text("3.0.0\n",encoding="utf-8")
print("MOOLVA_ENTERPRISE_300_PATCHED")
