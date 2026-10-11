"""Integrate bulk export after MoOLVa 3.0.2 WPF/WebView desktop overlays.

No data migrations required: only readonly SELECT queries and temporary PDF
generation. The same authenticated /api/action transport is reused.
"""
from pathlib import Path
import shutil
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: python moolva303/apply303.py <moolva_src>")
root = Path(sys.argv[1]).resolve()
here = Path(__file__).resolve().parent
bridge = root / "web19_bridge.py"
page = root / "web19" / "index.html"
version = root / ".moolva_easy_version"
if not bridge.is_file() or not page.is_file() or not version.is_file():
    raise SystemExit("Base Windows source is missing")
if version.read_text(encoding="utf-8").strip() != "3.0.2":
    raise SystemExit("Expected tested MoOLVa 3.0.2 starting point")

s = bridge.read_text(encoding="utf-8")
def replace_once(old, new, reason):
    global s
    if s.count(old) != 1:
        raise SystemExit("Cannot patch 3.0.3: " + reason)
    s = s.replace(old, new, 1)

replace_once("import quick31\n", "import quick31\nimport bulk303\n", "module import")
dispatcher = """        if action == 'bulk303_export':
            if user is None:
                raise ValueError('Для выгрузки журналов необходимо войти в программу')
            vid303 = self._venue(b.get('venue'))
            self.accounts.check(user, action, vid303)
            return bulk303.export_month(self.store, vid303, b.get('codes'))
"""
replace_once("        if action.startswith('quick31_'):",
             dispatcher + "        if action.startswith('quick31_'):",
             "authenticated journal action")
s = s.replace("'version':'3.0.2'", "'version':'3.0.3'")
s = s.replace("['version']=='3.0.2'", "['version']=='3.0.3'")
s = s.replace("['version'] == '3.0.2'", "['version'] == '3.0.3'")
bridge.write_text(s, encoding="utf-8")
shutil.copy2(here / "bulk303.py", root / "bulk303.py")

html = page.read_text(encoding="utf-8")
if "bulk303-open" in html or "MoOLVaBulk303" in html:
    raise SystemExit("3.0.3 export controls already present")
if html.count("</body>") != 1:
    raise SystemExit("Unexpected application HTML")
script = "<script>\n" + (here / "bulk303_ui.js").read_text(encoding="utf-8") + "\n</script>\n"
html = html.replace("</body>", script + "</body>", 1)
html = html.replace("3.0.2", "3.0.3")
page.write_text(html, encoding="utf-8")

project = root / "native221" / "Desktop" / "MoOLVaDesktop.csproj"
if project.is_file():
    original = project.read_text(encoding="utf-8")
    project.write_text(original.replace("<Version>3.0.2</Version>",
                                        "<Version>3.0.3</Version>"),
                       encoding="utf-8")
version.write_text("3.0.3\n", encoding="utf-8")
print("MOOLVA_JOURNAL_PDF_ZIP_303_APPLIED")
