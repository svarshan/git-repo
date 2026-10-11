"""Overlay for MoOLVa 3.0.4: inspection kit and all-enterprise journals."""
from pathlib import Path
import shutil
import sys

if len(sys.argv)!=2:
    raise SystemExit("Usage: python moolva304/apply304.py <moolva_src>")
root=Path(sys.argv[1]).resolve()
here=Path(__file__).resolve().parent
bridge=root/"web19_bridge.py"
page=root/"web19"/"index.html"
version=root/".moolva_easy_version"
if not bridge.exists() or not page.exists() or not version.exists():
    raise SystemExit("Missing existing Windows application source")
if version.read_text(encoding="utf-8").strip()!="3.0.3":
    raise SystemExit("Expected MoOLVa 3.0.3 source")

s=bridge.read_text(encoding="utf-8")
if "import bulk303\n" not in s:
    raise SystemExit("Expected previous PDF export module import")
s=s.replace("import bulk303\n","import bulk303\nimport alljournals304\n",1)

anchor="        if action == 'bulk303_export':"
if anchor not in s:raise SystemExit("Missing prior export endpoint")
routing="""        if action == 'bulk304_catalog':
            if user is None: raise ValueError('Войдите в программу для просмотра журналов')
            vid304 = self._venue(b.get('venue'))
            self.accounts.check(user, action, vid304)
            return alljournals304.catalog(self.store, vid304, b.get('start'), b.get('end'))
        if action == 'bulk304_export':
            if user is None: raise ValueError('Войдите в программу для выгрузки журналов')
            vid304 = self._venue(b.get('venue'))
            self.accounts.check(user, action, vid304)
            return alljournals304.export(
                self.store, vid304, b.get('codes'), b.get('start'), b.get('end'),
                b.get('inspection',False))
"""
s=s.replace(anchor,routing+anchor,1)
s=s.replace("'version':'3.0.3'","'version':'3.0.4'")
s=s.replace("['version']=='3.0.3'","['version']=='3.0.4'")
s=s.replace("['version'] == '3.0.3'","['version'] == '3.0.4'")
bridge.write_text(s,encoding="utf-8")
shutil.copy2(here/"alljournals304.py",root/"alljournals304.py")

html=page.read_text(encoding="utf-8")
if "MoOLVaAllJournals304" in html: raise SystemExit("Duplicate export module")
if html.count("</body>")!=1:raise SystemExit("Unexpected application HTML")
js=(here/"alljournals304_ui.js").read_text(encoding="utf-8")
html=html.replace("</body>","<script>\n"+js+"\n</script>\n</body>",1)
html=html.replace("3.0.3","3.0.4")
page.write_text(html,encoding="utf-8")

project=root/"native221"/"Desktop"/"MoOLVaDesktop.csproj"
if project.exists():
    cs=project.read_text(encoding="utf-8")
    project.write_text(cs.replace("<Version>3.0.3</Version>","<Version>3.0.4</Version>"),
                       encoding="utf-8")
version.write_text("3.0.4\n",encoding="utf-8")
print("MOOLVA_ENTERPRISE_FULL_EXPORT_304_APPLIED")
