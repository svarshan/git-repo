import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from last_voice94 import candidate, TARGET

def good():
    return {'id':'817020','gen':'Ichthyaetus','sp':'ichthyaetus','rec':'Bird recordist',
            'file':'https://xeno-canto.org/817020/download','lic':'https://creativecommons.org/licenses/by-sa/4.0/',
            'q':'A','type':'call','also':[],'rmk':'clear individual bird call','playback-used':'no'}

class LastVoiceTest(unittest.TestCase):
    def test_exact_species(self):
        x=candidate(good(),TARGET)
        self.assertIsNotNone(x)
        self.assertEqual(x['sourceTaxon'],TARGET)
    def test_different_gull_refused(self):
        r=good();r['gen']='Larus';r['sp']='marinus'
        self.assertIsNone(candidate(r,TARGET))
    def test_old_genus_requires_correct_species(self):
        r=good();r['gen']='Larus'
        self.assertIsNotNone(candidate(r,'Larus ichthyaetus'))
        self.assertIsNone(candidate(r,TARGET))
    def test_invalid_license_and_background(self):
        r=good();r['lic']='https://creativecommons.org/licenses/by-nc-sa/4.0/'
        self.assertIsNone(candidate(r,TARGET))
        r=good();r['also']=['Other species']
        self.assertIsNone(candidate(r,TARGET))
    def test_suspected_identity_refused(self):
        r=good();r['id-questioned']='yes'
        self.assertIsNone(candidate(r,TARGET))

if __name__=='__main__':unittest.main()
