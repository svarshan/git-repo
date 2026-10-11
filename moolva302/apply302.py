"""Apply global reusable staff-name dropdown to Enterprise 3.0.1.

Preserves 3.0.1 journal logic and all original enterprise database migrations.
"""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: python moolva302/apply302.py <moolva_src>")
root = Path(sys.argv[1]).resolve()
here = Path(__file__).resolve().parent
page = root / "web19" / "index.html"
version = root / ".moolva_easy_version"
if not page.is_file() or not version.is_file():
    raise SystemExit("Missing local app files")
if version.read_text(encoding="utf-8").strip() != "3.0.1":
    raise SystemExit("Expected tested MoOLVa 3.0.1 starting point")
html = page.read_text(encoding="utf-8")
if "quick31SaveReading" not in html or "quick31-layout" not in html:
    raise SystemExit("Missing one-screen quick journals")
if "MoOLVaStaffPicker302" not in html:
    assert html.count("</body>") == 1, "Missing HTML body"
    ui = (here / "staff_picker302.js").read_text(encoding="utf-8")
    html = html.replace("</body>", "<script>\n" + ui + "\n</script>\n</body>", 1)
html = html.replace("3.0.1", "3.0.2")
page.write_text(html, encoding="utf-8")
project = root / "native221" / "Desktop" / "MoOLVaDesktop.csproj"
if project.is_file():
    cs = project.read_text(encoding="utf-8")
    project.write_text(cs.replace("<Version>3.0.1</Version>", "<Version>3.0.2</Version>"),
                       encoding="utf-8")
bridge = root / "web19_bridge.py"
if bridge.is_file():
    s = bridge.read_text(encoding="utf-8")
    # Change only literal version indicators, not SQLite migration steps.
    s = s.replace("'version':'3.0.1'", "'version':'3.0.2'")
    s = s.replace("'version':'3.0.0'", "'version':'3.0.2'")
    bridge.write_text(s, encoding="utf-8")
version.write_text("3.0.2\n", encoding="utf-8")
print("MOOLVA_STAFF_PICKER_302_APPLIED")
