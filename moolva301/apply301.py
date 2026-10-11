"""Integrate 3.0.1 quick journals AFTER the tested Enterprise 3.0 overlay."""
from pathlib import Path
import shutil
import sys

if len(sys.argv)!=2:
    raise SystemExit("Usage: python moolva301/apply301.py <moolva_src>")
root=Path(sys.argv[1]).resolve()
here=Path(__file__).resolve().parent
bridge=root/"web19_bridge.py"
html=root/"web19"/"index.html"
if not bridge.is_file() or not html.is_file():
    raise SystemExit("Native WebView source missing")

source=bridge.read_text(encoding="utf-8")
def guarded(s,old,new,where):
    if new in s:return s
    if s.count(old)!=1:
        raise SystemExit("Unsupported version / missing "+where)
    return s.replace(old,new,1)

source=guarded(source,"import enterprise30\n","import enterprise30\nimport quick31\n","3.0 enterprise import")
source=guarded(source,"        enterprise30.migrate(self.store)\n",
               "        enterprise30.migrate(self.store)\n        quick31.migrate(self.store)\n",
               "3.0 enterprise schema init")
before="        if action.startswith('enterprise30_'):"
route="""        if action.startswith('quick31_'):
            if user is None:
                raise ValueError('Для заполнения журнала нужно войти в личный кабинет')
            vid31=self._venue(b.get('venue'))
            if action=='quick31_profiles':
                return quick31.listing(self,vid31,b.get('code'))
            if action=='quick31_profile_save':
                return quick31.save_profile(self,vid31,b)
            if action=='quick31_record':
                return quick31.save_measurement(self,vid31,b,user)
            raise ValueError('Неизвестная операция быстрого журнала')
"""
source=guarded(source,before,route+before,"quick journal API")
# Eliminate shadowing from any nested import inside LiveService.action.
# The global exports.columns_for is already imported at module scope.
import re
source, removed = re.subn(
    r"(?m)^[ \\t]+from exports import columns_for[^\\n]*\\r?\\n",
    "", source
)
if removed < 1:
    raise SystemExit("Expected legacy nested columns_for import was not found")
bridge.write_text(source,encoding="utf-8")
shutil.copy2(here/"quick31.py",root/"quick31.py")
page=html.read_text(encoding="utf-8")
if "quick31-layout" not in page:
    if page.count("</body>")!=1:raise SystemExit("Unexpected HTML body")
    script="<script>\n"+(here/"quick31_ui.js").read_text(encoding="utf-8")+"\n</script>\n"
    page=page.replace("</body>",script+"</body>",1)
page=page.replace("3.0.0","3.0.1")
html.write_text(page,encoding="utf-8")
csproj=root/"native221"/"Desktop"/"MoOLVaDesktop.csproj"
if csproj.is_file():
    p=csproj.read_text(encoding="utf-8").replace("<Version>3.0.0</Version>","<Version>3.0.1</Version>")
    csproj.write_text(p,encoding="utf-8")
(root/".moolva_easy_version").write_text("3.0.1\n",encoding="utf-8")
print("MOOLVA_SMART_JOURNALS_301_APPLIED")
