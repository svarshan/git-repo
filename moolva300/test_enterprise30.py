"""Regression tests: no invented evidence, venue isolation and real staff workflow."""
import tempfile
import unittest
from datetime import date
from pathlib import Path

from web19_bridge import LiveService

class Enterprise30Tests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.live=LiveService(Path(self.temp.name)/"studio.sqlite3")
        self.root_user={"id":1,"role":"super","venue_id":None,"display_name":"Директор"}
        self.venue=self.live.action("create_venue_guided",{"setup":{
            "details":{"venue_name":"Столовая А","kind":"Столовая"},
            "employees":[{"name":"Анна Иванова","position":"Повар","shift":"Дневная","deputy":""}],
            "journals":[{"code":"fridge","cadence":"daily","clock":"09:00",
                         "start_on":date.today().isoformat(),"owner":"Анна Иванова",
                         "employee":"Анна Иванова"}]}},self.root_user)["venue"]
    def tearDown(self):
        self.temp.cleanup()
    def perform(self,name,**kwargs):
        return self.live.action("enterprise30_"+name,{"venue":self.venue,**kwargs},self.root_user)
    def test_personal_task_board_and_no_created_measurements(self):
        board=self.perform("board",employee="Анна Иванова")
        self.assertEqual(board["total_schedules"],1)
        self.assertTrue(board["tasks"])
        self.assertIn("Анна Иванова",str(board["tasks"]))
        with self.live.store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM journal_records WHERE venue_id=?",(self.venue,)).fetchone()[0],0)
    def test_workday_planning_does_not_sign_or_create_real_records(self):
        first=self.perform("plan",journal_key="legacy:fridge",start_on=date.today().isoformat(),count=5,owner="Анна Иванова")
        self.assertEqual(first["created"],5)
        again=self.perform("plan",journal_key="legacy:fridge",start_on=date.today().isoformat(),count=5,owner="Анна Иванова")
        self.assertEqual(again["created"],5)
        with self.live.store.connect() as db:
            rows=db.execute("SELECT planned_for FROM easy30_planned_check WHERE venue_id=?",(self.venue,)).fetchall()
            self.assertTrue(rows)
            self.assertTrue(all(date.fromisoformat(x[0]).weekday()<5 for x in rows))
            self.assertEqual(db.execute("SELECT COUNT(*) FROM journal_records WHERE venue_id=?",(self.venue,)).fetchone()[0],0)
    def test_handover_training_and_local_help(self):
        r=self.perform("handover",sender="Анна Иванова",recipient="Пётр",note="Проверить холодильник")
        self.assertTrue(r["id"])
        self.assertEqual(len(self.perform("board")["handovers"]),1)
        self.assertIn("температур",self.perform("assistant",question="Как проверить температуру?")["answer"])
        t=self.perform("training")
        self.assertFalse(t["items"][0]["read"])
        self.perform("training_ack",key=t["items"][0]["key"])
        self.assertTrue(self.perform("training")["items"][0]["read"])
    def test_venue_isolation_and_input_checks(self):
        other=self.live.action("create_venue",{"name":"Столовая Б"},self.root_user)["venue"]
        admin={"id":9,"role":"venue_admin","venue_id":self.venue,"display_name":"Администратор"}
        with self.assertRaises(Exception):
            self.live.action("enterprise30_board",{"venue":other},admin)
        for args in [
            {"journal_key":"legacy:fridge","start_on":date.today().isoformat(),"count":500,"owner":"Повар"},
            {"journal_key":"legacy:unknown","start_on":date.today().isoformat(),"count":5,"owner":"Повар"}
        ]:
            with self.assertRaises(ValueError):self.perform("plan",**args)
        with self.assertRaises(ValueError):
            self.perform("handover",sender="Повар",recipient="",note="")
    def test_health_search_and_audit(self):
        health=self.perform("health")
        self.assertEqual(health["database_integrity"],"ok")
        self.assertGreaterEqual(health["audit_events"],1)
        self.assertTrue(self.perform("search",query="холод")["items"])
        self.perform("handover",sender="Анна Иванова",recipient="",note="Следующий этап")
        with self.live.store.connect() as db:
            self.assertTrue(db.execute("SELECT 1 FROM audit_events WHERE venue_id=? AND event='enterprise30_handover'",(self.venue,)).fetchone())
if __name__=="__main__":
    unittest.main()
