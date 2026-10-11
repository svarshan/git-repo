"""Tests of MoOLVa 3.0.4 adaptive inspection pack (real SQLite and PDFs)."""
import base64
import io
import tempfile
import unittest
import zipfile
from datetime import date,datetime,timedelta
from pathlib import Path

from pypdf import PdfReader

from web19_bridge import LiveService
from mature17_core import create_form,write_form_entry
import alljournals304 as module


class EnterpriseInspector304Tests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.live=LiveService(Path(self.tmp.name)/"enterprise.sqlite3")
        self.actor={"id":1,"role":"super","venue_id":None,"display_name":"Директор"}
        self.venue=self.live.action("create_venue_guided",{"setup":{
            "details":{"venue_name":"Столовая Проверка","kind":"Столовая"},
            "employees":[{"name":"Ольга Иванова","position":"Повар",
                          "shift":"Дневная","deputy":""}],
            "journals":[{"code":"fridge","cadence":"daily","clock":"09:00",
                         "start_on":date.today().isoformat(),
                         "owner":"Ольга Иванова","employee":"Ольга Иванова"}]
        }},self.actor)["venue"]
        self.start=date.today().replace(day=1).isoformat()
        self.end=date.today().isoformat()

    def tearDown(self):
        self.tmp.cleanup()

    def act(self,action,**data):
        return self.live.action("bulk304_"+action,
                  {"venue":self.venue,**data},self.actor)

    def catalog(self):
        return self.act("catalog",start=self.start,end=self.end)

    def export(self,codes,inspection=True,vid=None,start=None,end=None):
        return self.live.action("bulk304_export",
          {"venue":self.venue if vid is None else vid,
           "codes":codes,"inspection":inspection,
           "start":start or self.start,"end":end or self.end},self.actor)

    def unzip(self,result):
        b=base64.b64decode(result["zip_b64"],validate=True)
        self.assertTrue(b.startswith(b"PK"))
        archive=zipfile.ZipFile(io.BytesIO(b))
        self.assertEqual(archive.testzip(),None)
        pdfs=[x for x in archive.namelist() if x.endswith(".pdf")]
        self.assertEqual(len(pdfs),result["count"]+(1 if result["inspection"] else 0))
        self.assertEqual(len(archive.namelist()),len(set(archive.namelist())))
        self.assertIn("00_О_выгрузке.txt",archive.namelist())
        for name in pdfs:
            self.assertNotIn("/",name)
            self.assertNotIn("..",name)
            source=archive.read(name)
            self.assertTrue(source.startswith(b"%PDF-"),name)
            reader=PdfReader(io.BytesIO(source))
            self.assertGreaterEqual(len(reader.pages),1)
        return archive

    def test_recommended_catalog_depends_on_venue_and_includes_noncore(self):
        data=self.catalog()
        self.assertEqual(data["venue_name"],"Столовая Проверка")
        self.assertEqual(data["venue_kind"],"Столовая")
        self.assertGreater(data["total"],6)
        codes={x["code"] for x in data["items"]}
        self.assertTrue({"fridge","brakerage","warehouse","hygiene"}<=codes)
        self.assertGreater(data["recommended_count"],0)
        self.assertGreater(data["missing_recommended"],0)
        self.assertTrue(all("basis" in x and "reason" in x for x in data["items"]))
        self.assertIn("не официальный обязательный перечень",data["notice"])

    def test_many_journals_pdf_is_real_and_unwritten_rows_are_absent(self):
        record_id=self.live.store.add_record(self.venue,"fridge",
            {"c1":date.today().isoformat()+" 09:25",
             "c2":"Холодный цех","c3":"Холодильник №2",
             "c4":"+3,6","c5":"","c6":""})
        codes=["fridge","brakerage","warehouse","hygiene","perishable","cleaning","incoming","fryer"]
        result=self.export(codes)
        self.assertEqual(result["count"],len(codes))
        self.assertEqual(result["total_records"],1)
        self.assertEqual(result["journals"][0]["records"],1)
        self.assertTrue(result["inspection"])
        z=self.unzip(result)
        self.assertIn("00_Состав_и_самопроверка.pdf",z.namelist())
        index=z.read("00_О_выгрузке.txt").decode("utf-8")
        self.assertIn("ППК",index)
        self.assertIn("ХАССП",index)
        self.assertIn("Применимость",index)
        self.assertIn("Журнал",index)
        self.assertIn("Столовая Проверка",index)
        fridge=z.read(result["journals"][0]["file"])
        text="\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(fridge)).pages)
        self.assertIn("+3,6",text)
        self.assertIn("Холодильник",text)
        self.assertEqual(len(self.live.store.list_records(self.venue,"fridge")),1)

    def test_user_created_journal_with_actual_data_and_no_signature(self):
        form=create_form(self.live.store,self.venue,"Дополнительный журнал моего пищеблока",
             [{"name":"Показания прибора","type":"number","required":True},
              {"name":"Комментарий","type":"text","required":False}],
             owner="Ольга Иванова",actor="Директор")
        write_form_entry(self.live.store,self.venue,form,
                         {"Показания прибора":"3,7","Комментарий":"Факт"},
                         actor="Ольга Иванова")
        code="form:"+str(form)
        c=self.catalog()
        target=next(x for x in c["items"] if x["code"]==code)
        self.assertTrue(target["user_created"])
        self.assertTrue(target["recommended"])
        self.assertEqual(target["records"],1)
        out=self.export([code],inspection=False)
        self.assertEqual(out["count"],1)
        self.assertEqual(out["total_records"],1)
        z=self.unzip(out)
        self.assertNotIn("00_Состав_и_самопроверка.pdf",z.namelist())
        body=z.read(out["journals"][0]["file"])
        text="\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(body)).pages)
        self.assertIn("Ольга Иванова",text)
        self.assertIn("3.7",text)
        self.assertIn("Дополнительный",text)

    def test_venue_isolation_and_cancelled_exclusion(self):
        second=self.live.action("create_venue",{"name":"Другая столовая"},self.actor)["venue"]
        self.live.store.add_record(second,"fridge",{"c1":"Секретные данные","c4":"-99"})
        ours=self.export(["fridge"],inspection=False)
        self.assertEqual(ours["total_records"],0)
        rec=self.live.store.add_record(self.venue,"fridge",{"c1":"Отменено","c4":"11.1"})
        self.live.store.void_record(self.venue,rec,"Ошибочная запись")
        self.assertEqual(self.export(["fridge"],inspection=False)["total_records"],0)
        person={"id":9,"role":"venue_admin","venue_id":self.venue,
                "display_name":"Администратор"}
        with self.assertRaises(Exception):
            self.live.action("bulk304_export",{"venue":second,
               "codes":["fridge"],"start":self.start,"end":self.end},person)
        with self.assertRaises(Exception):
            self.live.action("bulk304_catalog",{"venue":second,
               "start":self.start,"end":self.end},person)

    def test_actual_observation_date_takes_priority(self):
        old=(date.today().replace(day=1)-timedelta(days=1)).isoformat()
        current_id=self.live.store.add_record(self.venue,"fridge",{"c1":"test-current","c4":"2.9"})
        past_id=self.live.store.add_record(self.venue,"fridge",{"c1":"test-previous","c4":"14.2"})
        with self.live.store.connect() as db:
            db.execute("""
            INSERT INTO easy19_web_record_meta
            (venue_id,record_id,observation_date,observation_time,equipment,zone,responsible,comment)
            VALUES(?,?,?,?,?,?,?,?)
            """,(self.venue,past_id,old,"12:30","Тест","Цех","Повар",""))
        out=self.export(["fridge"],inspection=False)
        self.assertEqual(out["total_records"],1)
        z=self.unzip(out)
        text="\n".join(p.extract_text() or "" for p in PdfReader(
            io.BytesIO(z.read(out["journals"][0]["file"]))).pages)
        self.assertIn("2.9",text)
        self.assertNotIn("14.2",text)

    def test_selection_bounds_and_empty_catalog(self):
        problems=([],["fridge","fridge"],["not-found"],
                  ["../../sqlite3"],["fridge"]*142)
        for entries in problems:
            with self.subTest(entries=entries[:2]):
                with self.assertRaises(ValueError):
                    self.export(entries)
        for start,end in (("2026-12-03","2026-12-01"),
                          ("2026-01-01","2027-12-31"),
                          ("yesterday","2026-12-10")):
            with self.assertRaises(ValueError):
                self.export(["fridge"],start=start,end=end)
        self.assertEqual(module.bounds("2026-12-01","2026-12-31"),
                         ("2026-12-01","2027-01-01"))
        with self.assertRaises(ValueError):
            self.act("catalog",start="2025-01-01",end="2026-12-31")


if __name__=="__main__":
    unittest.main()
