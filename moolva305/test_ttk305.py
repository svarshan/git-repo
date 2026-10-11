"""Release-gate tests of 617 unique draft recipes, approvals and PDF/DOCX.
Uses a genuine SQLite enterprise and the actual authenticated WebView API.
"""
import base64
import io
import tempfile
import unittest
import zipfile
from pathlib import Path

from pypdf import PdfReader
from docx import Document

from web19_bridge import LiveService
from ttk_catalog305 import catalog,cards_list,by_code
from ttk305 import _approval_problems

class CanteenTTK305Tests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.app=LiveService(Path(self.folder.name)/"ttk.sqlite3")
        self.director={"id":1,"role":"super","venue_id":None,"display_name":"Директор Иванов"}
        self.venue=self.app.action("create_venue",{"name":"Столовая №1"},self.director)["venue"]

    def tearDown(self):
        self.folder.cleanup()

    def act(self,action,**body):
        return self.app.action("ttk305_"+action,{"venue":self.venue,**body},self.director)

    def get_draft(self):
        return self.act("import",code="M305-0001")

    def test_catalog_has_500_plus_unique_original_canteen_dishes(self):
        dishes=catalog()
        self.assertGreaterEqual(len(dishes),550)
        self.assertEqual(len({x["title"] for x in dishes}),len(dishes))
        self.assertEqual(len({x["catalog_code"] for x in dishes}),len(dishes))
        categories={x["category"] for x in dishes}
        self.assertTrue({"Основные блюда","Супы","Салаты","Каши","Напитки"}<=categories)
        for x in dishes:
            self.assertFalse(x["verified"])
            self.assertTrue(x["output_is_estimate"])
            self.assertTrue(x["ingredients"])
            self.assertIn("проектная",x["source"].lower())
            self.assertIsNone(x["nutrition"]["kcal"])
        selected=self.act("catalog",query="котлета",limit=25)
        self.assertGreater(selected["total"],20)
        self.assertTrue(all("котлета" in x["title"].lower() for x in selected["items"]))
        with self.assertRaises(ValueError):
            self.act("catalog",start=-1)

    def test_copy_draft_once_and_require_verification(self):
        a=self.get_draft()
        b=self.get_draft()
        self.assertEqual(a["id"],b["id"])
        self.assertEqual(a["status"],"draft")
        self.assertGreater(len(a["problems"]),5)
        self.assertEqual(self.act("list")["total"],1)
        with self.assertRaisesRegex(ValueError,"исправьте"):
            self.act("approve",id=a["id"],confirmed=True)
        self.assertEqual(self.act("get",id=a["id"])["status"],"draft")
        self.assertTrue(a["data"]["output_is_estimate"])
        with self.app.store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM easy20_recipes").fetchone()[0],0)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM journal_records").fetchone()[0],0)

    def _ready(self,a):
        d=a["data"]
        d["title"]="Котлета куриная с пюре — собственная редакция"
        d["source_reference"]="Проработка предприятия от 2026-10-11, акт № 2"
        d["scope"]="Столовая №1"
        d["raw_requirements"]="Приёмка при наличии маркировки и сопроводительных документов."
        d["technology"]="Проверенная тепловая обработка согласно локальной инструкции № 4."
        d["presentation"]="Порционировать в тарелки; оформление по карте."
        d["storage"]="После приготовления и до выдачи соблюдать локальные сроки и температуры по ППК № 12."
        d["quality"]="Нормальная консистенция, запах и вкус. Показатели проверены при проработке."
        d["safety"]="Тепловую обработку контролировать измерением, протокол проработки № 2."
        d["nutrition_basis"]="Проверенный расчёт предприятия по базе химического состава № 5."
        d["nutrition"]={"protein_g":20.4,"fat_g":13.3,"carb_g":31.8,"kcal":328.2}
        d["output_g"]=250
        d["output_is_estimate"]=False
        d["allergen_note"]="Проверены состав продуктов и маркировка поставщиков."
        d["prepared_by"]="Повар Петрова"
        d["checked_by"]="Технолог Сидорова"
        d["ingredients"]=[{**x,"verified":True} for x in d["ingredients"]]
        d["checks"]={key:True for key in (
            "recipe_checked","technology_checked","safety_checked",
            "nutrition_checked","source_checked")}
        return d

    def test_approved_version_requires_person_and_has_date_and_signing_blanks(self):
        card=self.get_draft()
        updated=self.act("save",id=card["id"],data=self._ready(card))
        self.assertEqual(updated["problems"],[])
        saved=self.act("approve",id=card["id"],confirmed=True)
        self.assertEqual(saved["status"],"approved")
        self.assertEqual(saved["approved_by"],"Директор Иванов")
        self.assertTrue(saved["approved_at"])
        self.assertEqual(saved["data"]["nutrition"]["kcal"],328.2)
        other={"id":9,"role":"venue_admin","venue_id":self.venue,"display_name":"Администратор"}
        self.app.action("ttk305_get",{"venue":self.venue,"id":card["id"]},other)
        with self.assertRaises(ValueError):
            self.app.action("ttk305_approve",
                {"venue":self.venue,"id":card["id"],"confirmed":True},other)
        result=self.act("export",ids=[card["id"]],format="both")
        self.assertEqual(result["count"],1)
        self.assertEqual(result["approved"],1)
        self.assertEqual(result["drafts"],0)
        zipdata=zipfile.ZipFile(io.BytesIO(base64.b64decode(result["zip_b64"],validate=True)))
        names=zipdata.namelist()
        self.assertEqual(len(names),3)
        pdf=zipdata.read(next(x for x in names if x.endswith(".pdf")))
        self.assertTrue(pdf.startswith(b"%PDF"))
        pdftext="\n".join(x.extract_text() or "" for x in PdfReader(io.BytesIO(pdf)).pages)
        for token in ("Котлета","Директор Иванов","Технолог","Подпись","328"):
            self.assertIn(token,pdftext)
        doc=Document(io.BytesIO(zipdata.read(next(x for x in names if x.endswith(".docx")))))
        doc_text="\n".join(x.text for x in doc.paragraphs)
        self.assertIn("Директор Иванов",doc_text)
        self.assertIn("Подпись утверждающего:",doc_text)
        self.assertIn("____________",doc_text)
        with self.app.store.connect() as db:
            audit=list(db.execute("SELECT event FROM audit_events WHERE venue_id=?",(self.venue,)))
            self.assertIn("ttk305_card_approved",[x[0] for x in audit])

    def test_edit_approved_card_retains_old_snapshot_and_revokes_approval(self):
        old=self.get_draft()
        self.act("save",id=old["id"],data=self._ready(old))
        approved=self.act("approve",id=old["id"],confirmed=True)
        edited=approved["data"]
        edited["title"]="Котлета куриная с пюре — изменена"
        result=self.act("save",id=old["id"],data=edited)
        self.assertEqual(result["status"],"draft")
        self.assertGreater(result["version"],approved["version"])
        self.assertEqual(result["approved_by"],"")
        versions=self.act("revisions",id=old["id"])
        self.assertTrue(any(x["status"]=="approved" and
                            x["version"]==approved["version"] for x in versions["items"]))

    def test_cross_enterprise_isolation_and_no_fake_approval(self):
        a=self.get_draft()
        second=self.app.action("create_venue",{"name":"Столовая 2"},self.director)["venue"]
        user={"id":99,"role":"venue_admin","venue_id":second,"display_name":"Смена"}
        with self.assertRaises(Exception):
            self.app.action("ttk305_get",{"venue":second,"id":a["id"]},user)
        with self.assertRaises(Exception):
            self.app.action("ttk305_export",{"venue":second,"ids":[a["id"]]},user)
        # Draft PDFs must never look like legally approved recipe cards.
        res=self.act("export",ids=[a["id"]],format="pdf")
        self.assertEqual(res["drafts"],1)
        z=zipfile.ZipFile(io.BytesIO(base64.b64decode(res["zip_b64"])))
        text="\n".join(x.extract_text() or "" for x in
                      PdfReader(io.BytesIO(z.read(next(n for n in z.namelist()
                                                       if n.endswith(".pdf"))))).pages)
        self.assertIn("ПРОЕКТ",text)
        self.assertIn("НЕ ИСПОЛЬЗОВАТЬ",text)
        self.assertIn("не утверждено",text.lower())

    def test_values_validation_and_missing_data(self):
        a=self.get_draft()
        d=a["data"]
        d["ingredients"][0]["net_g"]=100000
        with self.assertRaises(ValueError):
            self.act("save",id=a["id"],data=d)
        d["ingredients"][0]["net_g"]=10
        d["kind"]="INVALID"
        with self.assertRaises(ValueError):
            self.act("save",id=a["id"],data=d)
        with self.assertRaises(ValueError):
            self.act("export",ids=[],format="both")
        with self.assertRaises(ValueError):
            self.act("export",ids=[a["id"]]*51,format="both")

if __name__=="__main__":
    unittest.main()
