import tempfile
import unittest
from pathlib import Path
from datetime import date, timedelta
from web19_bridge import LiveService
from onboarding222 import recommendations

class GuidedEnterpriseTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.app=LiveService(Path(self.tmp.name)/"sample.sqlite3")
        self.user={"id":1,"role":"super","venue_id":None}
        self.start=(date.today()+timedelta(days=2)).isoformat()
    def tearDown(self):
        self.tmp.cleanup()
    def payload(self):
        return {"details":{"venue_name":"Тестовая столовая","kind":"Столовая",
                           "responsible":"Петров Петр Петрович"},
                "employees":[{"name":"Иванова Мария Петровна","position":"Шеф-повар"}],
                "journals":[{"code":"hygiene","cadence":"daily","start_on":self.start,
                             "clock":"09:00","employee":"Иванова Мария Петровна"}]}
    def test_profile(self):
        r={x["code"]:x for x in recommendations("Столовая")["journals"]}
        self.assertTrue(r["fridge"]["recommended"])
        self.assertTrue(r["hygiene"]["recommended"])
        self.assertFalse(r["transport"]["recommended"])
    def test_atomic_saved_staff_and_schedule_without_fake_measurements(self):
        x=self.app.action("create_venue_guided",{"setup":self.payload()},self.user)
        vid=x["venue"]
        state=self.app.state(vid,self.user)
        self.assertEqual(len(state["schedules"]),1)
        self.assertEqual(state["schedules"][0]["start_on"],self.start)
        self.assertEqual(len(state["employees222"]),1)
        with self.app.store.connect() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM journal_records WHERE venue_id=?",(vid,)).fetchone()[0],0)
    def test_validation_fails_before_partial_creation(self):
        d=self.payload();d["journals"][0]["employee"]="Несуществующий сотрудник"
        with self.assertRaises(ValueError):
            self.app.action("create_venue_guided",{"setup":d},self.user)
        self.assertEqual(self.app.store.list_venues(),[])
    def test_schedule_start_is_editable(self):
        vid=self.app.action("create_venue_guided",{"setup":self.payload()},self.user)["venue"]
        new=(date.today()+timedelta(days=5)).isoformat()
        self.app.action("save_schedule",{"venue":vid,"journal_key":"legacy:hygiene",
             "cadence":"daily","clock":"09:00","owner":"Иванова Мария Петровна","start_on":new},self.user)
        self.assertEqual(self.app.state(vid,self.user)["schedules"][0]["start_on"],new)
    def test_admin_cannot_create_company(self):
        with self.assertRaisesRegex(ValueError,"Недостаточно"):
            self.app.accounts.check({"id":42,"role":"venue_admin","venue_id":15},
                                    "create_venue_guided",0)
    def test_company_data_isolation(self):
        first=self.app.action("create_venue_guided",{"setup":self.payload()},self.user)["venue"]
        d=self.payload();d["details"]["venue_name"]="Вторая столовая";d["journals"]=[]
        second=self.app.action("create_venue_guided",{"setup":d},self.user)["venue"]
        self.assertEqual(len(self.app.state(first,self.user)["schedules"]),1)
        self.assertEqual(len(self.app.state(second,self.user)["schedules"]),0)

if __name__=="__main__":
    unittest.main()
