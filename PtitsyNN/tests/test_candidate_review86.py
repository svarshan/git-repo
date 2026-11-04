import unittest
from scripts.candidate_review86 import generate
class CandidateReview86Tests(unittest.TestCase):
 def test_filters_invalid_and_never_promotes_audio(self):
  catalog=[{'latin':'A a','name':'Bird A'},{'latin':'B b','name':'Bird B','audioFile':'known.ogg'}]
  candidates={'results':[{'latin':'A a','status':'found_unreviewed','candidates':[
   {'download_url':'https://example.org/1.ogg','observation':'https://www.inaturalist.org/observations/2','license':'cc-by','author':'Observer'},
   {'download_url':'https://example.org/2.ogg','observation':'https://www.inaturalist.org/observations/2','license':'all-rights-reserved','author':'Observer'}]}]}
  rows=generate(catalog,candidates)
  self.assertEqual(len(rows),1)
  self.assertEqual(rows[0]['status'],'candidate-needs-human-review')
  self.assertEqual(rows[0]['latin'],'A a')
  self.assertNotIn('audioFile',catalog[0])
 def test_missing_search_does_not_claim_not_found_everywhere(self):
  rows=generate([{'latin':'Z z','name':'Z'}],{'results':[]})
  self.assertEqual(rows[0]['status'],'not-found-in-current-search')
if __name__=='__main__':unittest.main()
