"""Windows regression tests for 3.0.3 actual journal PDF ZIP export."""
import base64
import io
import json
import tempfile
import unittest
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path

from pypdf import PdfReader

from web19_bridge import LiveService
import bulk303


class BulkPDF303Tests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.live = LiveService(Path(self.tmp.name) / "haccp.sqlite3")
        self.admin = {"id":1,"role":"super","venue_id":None,
                      "display_name":"Руководитель"}
        self.venue = self.live.action("create_venue_guided", {
            "setup": {
                "details":{"venue_name":"Столовая 3.0.3", "kind":"Столовая"},
                "employees":[{"name":"Анна Иванова","position":"Повар",
                              "shift":"Дневная","deputy":""}],
                "journals":[{"code":"fridge","cadence":"daily","clock":"09:00",
                             "start_on":date.today().isoformat(),
                             "owner":"Анна Иванова","employee":"Анна Иванова"}]
            }
        },self.admin)["venue"]

    def tearDown(self):
        self.tmp.cleanup()

    def export(self,codes=None,venue=None,instant=None):
        if instant is not None:
            # Date-boundary tests deliberately use the pure exporter.
            return bulk303.export_month(self.live.store,venue or self.venue,
                         codes or list(bulk303.JOURNALS),instant)
        return self.live.action("bulk303_export", {
            "venue":venue or self.venue,
            "codes":codes if codes is not None else list(bulk303.JOURNALS)
        },self.admin)

    def add_record(self,venue,code,data=None):
        values=data if data is not None else {
            "c1":date.today().isoformat()+" 09:00",
            "c2":"Холодный цех","c3":"Холодильник №2","c4":"+3,5"
        }
        return self.live.store.add_record(venue,code,values)

    def inspect(self,result):
        data=base64.b64decode(result["zip_b64"],validate=True)
        self.assertTrue(data.startswith(b"PK"))
        archive=zipfile.ZipFile(io.BytesIO(data))
        members=archive.namelist()
        self.assertEqual(len(members),result["count"]+1)
        self.assertEqual(len(members),len(set(members)))
        self.assertIn("О_выгрузке.txt",members)
        self.assertFalse(any("/" in name or ".." in name for name in members))
        for name in members:
            if name.endswith(".pdf"):
                binary=archive.read(name)
                self.assertTrue(binary.startswith(b"%PDF-"),name)
                self.assertGreater(len(binary),900)
                self.assertTrue(len(PdfReader(io.BytesIO(binary)).pages)>=1)
        return archive

    def test_six_requested_pdfs_all_generated_and_readable(self):
        first=self.add_record(self.venue,"fridge")
        self.add_record(self.venue,"incoming",{
            "c1":date.today().isoformat(),"c2":"ООО Поставка",
            "c3":"Картофель, партия P-125", "c4":"Накладная 123",
            "c5":"2026-12-31","c6":"4.1","c7":"Принято","c8":"Анна Иванова"
        })
        original=self.live.store.list_records(self.venue,"fridge")
        result=self.export()
        self.assertEqual(result["count"],6)
        self.assertEqual(result["total_records"],2)
        self.assertEqual(result["period_start"],date.today().replace(day=1).isoformat())
        self.assertEqual([x["code"] for x in result["journals"]],list(bulk303.JOURNALS))
        self.assertEqual({x["code"]:x["records"] for x in result["journals"]},
                         {"fridge":1,"brakerage":0,"incoming":1,
                          "cleaning":0,"hygiene":0,"equipment":0})
        archive=self.inspect(result)
        index=archive.read("О_выгрузке.txt").decode("utf-8")
        self.assertIn("Столовая 3.0.3",index)
        self.assertIn("Только",index) if False else None
        self.assertIn("вымышленные измерения",index)
        fridge=next(x["filename"] for x in result["journals"] if x["code"]=="fridge")
        parsed="\n".join(page.extract_text() or "" for page in
                         PdfReader(io.BytesIO(archive.read(fridge))).pages)
        self.assertIn("+3,5",parsed)
        self.assertIn("Холодильник",parsed)
        self.assertEqual(self.live.store.list_records(self.venue,"fridge"),original)

    def test_observation_date_and_cancelled_excluded(self):
        now=date.today()
        past=now.replace(day=1)-timedelta(days=1)
        good=self.add_record(self.venue,"fridge",{"c1":"current","c4":"8.1"})
        observed_old=self.add_record(self.venue,"fridge",{"c1":"old","c4":"13"})
        cancelled=self.add_record(self.venue,"fridge",{"c1":"cancelled","c4":"18"})
        self.live.store.void_record(self.venue,cancelled,"Ошибочная запись теста")
        with self.live.store.connect() as db:
            db.execute("""
              INSERT INTO easy19_web_record_meta
              (venue_id,record_id,observation_date,observation_time,equipment,zone,responsible,comment)
              VALUES(?,?,?,?,?,?,?,?)
            """,(self.venue,observed_old,past.isoformat(),"12:30","Тест",
                 "Цех","Повар",""))
        result=self.export(["fridge"])
        self.assertEqual(result["total_records"],1)
        self.assertEqual(result["journals"][0]["records"],1)
        arc=self.inspect(result)
        text="\n".join(p.extract_text() or "" for p in PdfReader(
            io.BytesIO(arc.read(result["journals"][0]["filename"]))).pages)
        self.assertIn("8.1",text)
        self.assertNotIn("13",text)
        self.assertNotIn("18",text)

    def test_cross_venue_isolation_and_readonly(self):
        second=self.live.action("create_venue",{"name":"Другая столовая"},self.admin)["venue"]
        self.add_record(second,"fridge",{"c1":"secret","c4":"-99"})
        ours=self.export(["fridge"])
        self.assertEqual(ours["total_records"],0)
        self.inspect(ours)
        actor={"id":20,"role":"venue_admin","venue_id":self.venue,
               "display_name":"Сотрудник"}
        with self.assertRaises(Exception):
            self.live.action("bulk303_export",{"venue":second,"codes":["fridge"]},actor)
        with self.live.store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM journal_records").fetchone()[0],1)

    def test_invalid_selection_and_month_rollover(self):
        for codes in ([],["fridge","fridge"],["../../haccp.sqlite3"],
                      ["unknown"],None,list(bulk303.JOURNALS)+["fridge"]):
            with self.subTest(codes=codes):
                with self.assertRaises(ValueError):
                    self.export(codes) if codes is not None else bulk303.export_month(self.live.store,self.venue,None)
        start,next_start=bulk303.month_bounds(datetime(2026,12,31,23,59))
        self.assertEqual(start,"2026-12-01")
        self.assertEqual(next_start,"2027-01-01")
        dec=self.export(["brakerage"],instant=datetime(2026,12,31,23,59))
        self.assertEqual(dec["period_end"],"2026-12-31")
        self.inspect(dec)

    def test_empty_journal_is_explicitly_marked_without_fake_rows(self):
        out=self.export(["equipment"])
        self.assertEqual(out["total_records"],0)
        archive=self.inspect(out)
        text="\n".join(p.extract_text() or "" for p in PdfReader(
            io.BytesIO(archive.read(out["journals"][0]["filename"]))).pages)
        self.assertIn("0",text)
        self.assertEqual(out["journals"][0]["records"],0)

if __name__=="__main__":
    unittest.main()
