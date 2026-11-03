import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from habitat_fallback84 import normalize,fetch,PLACE_ID

def base():
 return {'id':145,'quality_grade':'research','geoprivacy':None,'coordinates_obscured':False,
  'license_code':'cc-by','place_ids':[PLACE_ID],
  'taxon':{'rank':'species','name':'Parus major'},
  'geojson':{'type':'Point','coordinates':[44.01,56.28]},
  'positional_accuracy':200,'observed_on':'2024-05-14'}

class HabitatFallbackTests(unittest.TestCase):
 def test_real_region_and_open_license_required(self):
  self.assertEqual(normalize(base())['species'],'Parus major')
  self.assertEqual(normalize(base())['license'],'CC_BY_4_0')
  for field,value in [('license_code','cc-by-nc'),('coordinates_obscured',True),('geoprivacy','obscured'),
                       ('quality_grade','casual'),('place_ids',[777])]:
   with self.subTest(field=field):
    d=base();d[field]=value
    self.assertIsNone(normalize(d))
 def test_obscured_and_outside_oblast_not_used(self):
  for coord in [[41.3,52.1],[50.0,56.2]]:
   d=base();d['geojson']['coordinates']=coord
   self.assertIsNone(normalize(d))
  d=base();d['taxon']['name']='Unknown';self.assertIsNone(normalize(d))
 def test_response_must_contain_real_observations(self):
  class Response:
   def json(self):return {'results':[base(),{**base(),'id':146,'license_code':'cc-by-nc'}]}
  def fake_get(url,params=None,**kwargs):
   self.assertEqual(params['place_id'],PLACE_ID)
   return Response()
  rows,queried,issues=fetch(fake_get,max_pages=3)
  self.assertEqual(len(rows),1);self.assertEqual(queried,6);self.assertEqual(issues,[])
if __name__=='__main__':unittest.main()
