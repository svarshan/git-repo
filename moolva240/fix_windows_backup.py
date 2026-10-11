"""Apply Windows SQLite backup file-handle fix after 2.4 overlay extraction."""
import sys
from pathlib import Path

root = Path(sys.argv[1])
p = root / "intelligent24.py"
s = p.read_text(encoding="utf-8")
needle = "import json, math, os, re, sqlite3, secrets, time"
if "from contextlib import closing" not in s:
    if needle not in s:
        raise SystemExit("Unexpected backup module imports")
    s = s.replace(needle, needle + "\nfrom contextlib import closing", 1)
for old, new in [
    ("with sqlite3.connect(f'file:{target.as_posix()}?mode=ro',uri=True) as db:",
     "with closing(sqlite3.connect(f'file:{target.as_posix()}?mode=ro',uri=True)) as db:"),
    ("with sqlite3.connect(temp) as db:",
     "with closing(sqlite3.connect(temp)) as db:"),
]:
    if old in s:
        s = s.replace(old, new, 1)
    elif new not in s:
        raise SystemExit("Unexpected SQLite connection pattern: " + old)

old = "        os.replace(temp,target)\n    finally:temp.unlink(missing_ok=True)"
new = """        for attempt in range(8):
            try:
                os.replace(temp,target)
                break
            except PermissionError as error:
                if getattr(error, 'winerror', None) not in (5, 32, 33) or attempt == 7:
                    raise
                time.sleep(0.15 * (attempt + 1))
    finally:
        for attempt in range(8):
            try:
                temp.unlink(missing_ok=True)
                break
            except PermissionError as error:
                if getattr(error, 'winerror', None) not in (5, 32, 33):
                    break
                time.sleep(0.15 * (attempt + 1))"""
if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit("Unexpected backup replace/finally pattern; refusing to change")
p.write_text(s, encoding="utf-8")
# sqlite3.Connection context managers commit/rollback but do not close handles.
# Close test readers explicitly before TemporaryDirectory cleanup on Windows.
test = root / "tests" / "test_intelligent24.py"
if test.exists():
    t = test.read_text(encoding="utf-8")
    anchor = "import unittest, tempfile, json, sqlite3"
    if "from contextlib import closing" not in t:
        if anchor not in t:
            raise SystemExit("Unexpected test imports; refusing unsafe edit")
        t = t.replace(anchor, anchor + "\nfrom contextlib import closing", 1)
    original = "with sqlite3.connect(r['path']) as db:"
    corrected = "with closing(sqlite3.connect(r['path'])) as db:"
    if original in t:
        t = t.replace(original, corrected)
    elif corrected not in t:
        raise SystemExit("Unexpected backup test connection pattern")
    test.write_text(t, encoding="utf-8")
print("Windows SQLite backup patch applied")
