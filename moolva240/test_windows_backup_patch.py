"""Regression checks for the generated Windows SQLite backup patch."""
import pathlib
import subprocess
import sys
import tempfile
import unittest

PATCH = pathlib.Path(__file__).with_name("fix_windows_backup.py")

class PatchTests(unittest.TestCase):
    def test_idempotent_and_closes_connections(self):
        with tempfile.TemporaryDirectory() as d:
            root = pathlib.Path(d)
            source = (
                "import json, math, os, re, sqlite3, secrets, time\n"
                "def backup_checked(target,temp):\n"
                "    with sqlite3.connect(f'file:{target.as_posix()}?mode=ro',uri=True) as db:\n"
                "        pass\n"
                "    with sqlite3.connect(temp) as db:\n"
                "        pass\n"
                "    try:\n"
                "        os.replace(temp,target)\n"
                "    finally:temp.unlink(missing_ok=True)\n"
            )
            p = root / "intelligent24.py"
            p.write_text(source, encoding="utf-8")
            for _ in range(2):
                subprocess.run([sys.executable, str(PATCH), str(root)], check=True)
            patched = p.read_text(encoding="utf-8")
            compile(patched, str(p), "exec")
            self.assertEqual(patched.count("from contextlib import closing"), 1)
            self.assertEqual(patched.count("with closing(sqlite3.connect(temp))"), 1)
            self.assertIn("for attempt in range(8)", patched)
    def test_reject_unknown_source(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d) / "intelligent24.py"
            p.write_text("print('unknown')\n", encoding="utf-8")
            result = subprocess.run([sys.executable, str(PATCH), str(p.parent)], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(p.read_text(encoding="utf-8"), "print('unknown')\n")

if __name__ == "__main__":
    unittest.main()
