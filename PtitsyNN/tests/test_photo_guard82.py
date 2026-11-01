"""Only licensed, non-egg photo evidence is accepted automatically."""
import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from photo_guard82 import suspicious,source_title
class Photo82Tests(unittest.TestCase):
 def test_reject_eggs_and_nest_images(self):
  for title in ('File:Parus major egg.jpg','File:Passer montanus eggs.jpg','File:Falco egg clutch.jpg','File:Anas oeufs.jpg','File:Picus viridis nest.jpg','File:Anser яйца.jpg'):
   with self.subTest(title=title):
    self.assertTrue(suspicious({'source':'https://commons.wikimedia.org/wiki/'+title.replace(' ','_')}))
 def test_allow_bird_portrait_titles(self):
  self.assertFalse(suspicious({'source':'https://commons.wikimedia.org/wiki/File:Parus_major_adult_bird.jpg'}))
  self.assertEqual(source_title({'source':'https://commons.wikimedia.org/wiki/File:Parus_major_adult_bird.jpg'}),'File:Parus major adult bird.jpg')
if __name__=='__main__':unittest.main()
