import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from voices_298 import TARGET, same_species, inspect_sound, allowed_host

class TestVoices298(unittest.TestCase):
 def test_target_298(self):self.assertEqual(TARGET,298)
 def test_exact_taxon_and_license(self):
  bird={'id':'a','latin':'Parus major','name':'Большая синица'}
  obs={'id':123,'taxon':{'name':'Parus major'},'user':{'login':'recordist'},'quality_grade':'research'}
  good={'id':12,'license_code':'cc-by','file_url':'https://static.inaturalist.org/sounds/12.mp3','file_content_type':'audio/mpeg','attribution':'test recordist'}
  self.assertTrue(same_species('Parus major',bird))
  self.assertFalse(same_species('Parus caeruleus',bird))
  self.assertIsNotNone(inspect_sound(good,obs,bird))
  self.assertIsNone(inspect_sound({**good,'license_code':'cc-by-nc'},obs,bird))
  self.assertFalse(allowed_host('example.com'))
