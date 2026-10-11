"""3.0.5 overlay onto the tested 3.0.4 Windows native client."""
from pathlib import Path
import shutil
import sys

if len(sys.argv)!=2:raise SystemExit("Usage: python moolva305/apply305.py <moolva_src>")
root=Path(sys.argv[1]).resolve()
here=Path(__file__).resolve().parent
bridge=root/"web19_bridge.py"
page=root/"web19"/"index.html"
version=root/".moolva_easy_version"
if not bridge.exists() or not page.exists() or not version.exists():
    raise SystemExit("Existing native source is missing")
if version.read_text(encoding="utf-8").strip()!="3.0.4":
    raise SystemExit("Expected verified 3.0.4 build")

s=bridge.read_text(encoding="utf-8")
if s.count("import alljournals304\n")!=1:raise SystemExit("Missing 3.0.4 import")
s=s.replace("import alljournals304\n",
            "import alljournals304\nimport ttk305\nfrom ttk_catalog305 import cards_list\n",1)
mark="        if action == 'bulk304_catalog':"
if s.count(mark)!=1:raise SystemExit("Missing authenticated action dispatcher")
routes="""        if action.startswith('ttk305_'):
            if user is None:
                raise ValueError('Войдите в личный кабинет для работы с ТК/ТТК')
            vid305=self._venue(b.get('venue'))
            self.accounts.check(user, action, vid305)
            if action=='ttk305_catalog':
                return cards_list(b.get('query',''),b.get('category',''),
                                  b.get('start',0),b.get('limit',45))
            if action=='ttk305_list':
                return ttk305.user_cards(self.store,vid305,
                  b.get('query',''),b.get('limit',45),b.get('start',0))
            if action=='ttk305_get':
                return ttk305.card(self.store,vid305,b.get('id'))
            if action=='ttk305_import':
                return ttk305.import_card(self.store,vid305,b.get('code'),user)
            if action=='ttk305_new':
                return ttk305.new_card(self.store,vid305,user)
            if action=='ttk305_save':
                return ttk305.save(self.store,vid305,b.get('id'),b.get('data'),user)
            if action=='ttk305_approve':
                return ttk305.approve(self.store,vid305,b.get('id'),user,b.get('confirmed'))
            if action=='ttk305_revisions':
                return ttk305.revisions(self.store,vid305,b.get('id'))
            if action=='ttk305_export':
                return ttk305.export(self.store,vid305,b.get('ids'),b.get('format','both'))
            raise ValueError('Неизвестное действие технологических карт')
"""
s=s.replace(mark,routes+mark,1)
s=s.replace("        alljournals304.migrate(self.store)\n",
            "        alljournals304.migrate(self.store)\n") # 3.0.4 has no migration
mark_init="        intelligent24.migrate(self.store)\n"
if mark_init not in s:raise SystemExit("Missing core migration anchor")
s=s.replace(mark_init,mark_init+"        ttk305.migrate(self.store)\n",1)
s=s.replace("'version':'3.0.4'","'version':'3.0.5'")
s=s.replace("['version']=='3.0.4'","['version']=='3.0.5'")
s=s.replace("['version'] == '3.0.4'","['version'] == '3.0.5'")
bridge.write_text(s,encoding="utf-8")

for filename in ("ttk305.py","ttk_catalog305.py","ttk_export305.py"):
    shutil.copy2(here/filename,root/filename)

html=page.read_text(encoding="utf-8")
if "MoOLVaTTK305" in html:raise SystemExit("Duplicate TTK workspace")
if html.count("</body>")!=1:raise SystemExit("Unexpected desktop HTML layout")
js=(here/"ttk305_ui.js").read_text(encoding="utf-8")
html=html.replace("</body>","<script>\n"+js+"\n</script>\n</body>",1)
html=html.replace("3.0.4","3.0.5")
page.write_text(html,encoding="utf-8")
project=root/"native221"/"Desktop"/"MoOLVaDesktop.csproj"
if project.exists():
    cs=project.read_text(encoding="utf-8")
    project.write_text(cs.replace("<Version>3.0.4</Version>","<Version>3.0.5</Version>"),
                       encoding="utf-8")
version.write_text("3.0.5\n",encoding="utf-8")
print("MOOLVA_305_TK_TTK_617_DRAFTS_APPLIED")
