import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from repair_clanga93 import inspect_candidate,safe_license,IDS
class EagleRepair93Tests(unittest.TestCase):
    def record(self,**changes):
        rec={'id':'371196','gen':'Clanga','sp':'clanga','q':'A',
             'type':'call','rec':'Matthias Feuersenger','rmk':'Adult calling',
             'lic':'https://creativecommons.org/licenses/by-nc-sa/4.0/',
             'file':'https://xeno-canto.org/371196/download','also':[]}
        rec.update(changes)
        return rec
    def test_licensed_adult_call_candidate(self):
        rec=inspect_candidate(self.record())
        self.assertIsNotNone(rec)
        self.assertEqual(rec['id'],'371196')
        self.assertEqual(rec['author'],'Matthias Feuersenger')
        self.assertTrue(rec['licenseUrl'].endswith('/by-nc-sa/4.0/'))
    def test_wind_only_and_hybrid_and_wrong_species_rejected(self):
        self.assertIsNone(inspect_candidate(self.record(id='19688')))
        self.assertIsNone(inspect_candidate(self.record(rmk='Strong wind noise')))
        self.assertIsNone(inspect_candidate(self.record(rmk='Hybrid nestling')))
        self.assertIsNone(inspect_candidate(self.record(gen='Aquila')))
        self.assertIsNone(inspect_candidate(self.record(also=['Other bird'])))
        self.assertIsNone(inspect_candidate(self.record(q='D')))
        self.assertIsNone(inspect_candidate(self.record(type='ambient')))
    def test_license_restrictions(self):
        self.assertEqual(safe_license('https://creativecommons.org/licenses/by/4.0/'),
                         'https://creativecommons.org/licenses/by/4.0/')
        self.assertEqual(safe_license('//creativecommons.org/licenses/by-sa/3.0/'),
                         'https://creativecommons.org/licenses/by-sa/3.0/')
        self.assertEqual(safe_license('https://creativecommons.org/licenses/by-nd/4.0/'),'')
        self.assertEqual(safe_license('https://creativecommons.org/licenses/by-nc-nd/4.0/'),'')
        self.assertEqual(safe_license('http://creativecommons.org/licenses/by/4.0/'),'')
        self.assertEqual(safe_license('https://evil.test/licenses/by/4.0/'),'')
    def test_audio_shortlist_stays_explicit(self):
        self.assertNotIn('19688',IDS)
        self.assertEqual(len(IDS),len(set(IDS)))
if __name__=='__main__':unittest.main()
