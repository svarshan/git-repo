"""Windows-safe SQLite backup fix applied after 2.4 overlay extraction."""
import sys
from pathlib import Path
p=Path(sys.argv[1])/'intelligent24.py'
s=p.read_text(encoding='utf-8')
needle='import json, math, os, re, sqlite3, secrets, time'
if needle not in s:raise SystemExit('Unexpected smart backup source')
s=s.replace(needle,needle+'\nfrom contextlib import closing',1)
a="with sqlite3.connect(f'file:{target.as_posix()}?mode=ro',uri=True) as db:"
b="with closing(sqlite3.connect(f'file:{target.as_posix()}?mode=ro',uri=True)) as db:"
if a not in s:raise SystemExit('Existing backup connection anchor changed')
s=s.replace(a,b,1)
a='with sqlite3.connect(temp) as db:'
b='with closing(sqlite3.connect(temp)) as db:'
if a not in s:raise SystemExit('Temporary backup connection anchor changed')
s=s.replace(a,b,1)
p.write_text(s,encoding='utf-8')
# Windows tests must explicitly close test reader connections before deleting temp folders.
test=Path(sys.argv[1])/'tests'/'test_intelligent24.py'
t=test.read_text(encoding='utf-8')
if 'from contextlib import closing' not in t:
    t=t.replace('import unittest, tempfile, json, sqlite3', 'import unittest, tempfile, json, sqlite3\nfrom contextlib import closing')
t=t.replace("with sqlite3.connect(r['path']) as db:", "with closing(sqlite3.connect(r['path'])) as db:")
test.write_text(t,encoding='utf-8')
print('Closed SQLite backup and test handles on Windows: OK')
