import unittest
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import region_atlas20
import photo_gallery20

class TestRegionSafety(unittest.TestCase):
 def test_region_place_must_have_name_and_center(self):
  place={'id':123,'name':'Nizhny Novgorod Oblast','latitude':56.3,'longitude':44.2}
  self.assertTrue(region_atlas20.permitted_place(place))
  self.assertFalse(region_atlas20.permitted_place({**place,'name':'Moscow Oblast'}))
  self.assertFalse(region_atlas20.permitted_place({**place,'latitude':48.2}))
 def test_no_fake_fallback(self):
  result=region_atlas20.default_output('offline')
  self.assertEqual(result['species'],[])
  self.assertEqual(result['observations'],[])
  self.assertEqual(result['recordCount'],0)
 def test_genera_whitelist(self):
  self.assertIn('Boletus',region_atlas20.MACRO_GENERA)
  self.assertNotIn('Aspergillus',region_atlas20.MACRO_GENERA)
 def test_gallery_strict_media(self):
  self.assertFalse(photo_gallery20.eligible({'id':2,'license_code':'cc-by-nc','url':'https://inaturalist-open-data.s3.amazonaws.com/photos/2/medium.jpg'}))
  self.assertTrue(photo_gallery20.eligible({'id':2,'license_code':'cc-by','url':'https://inaturalist-open-data.s3.amazonaws.com/photos/2/medium.jpg'}))

if __name__=='__main__':unittest.main()
