"""Only licensed, non-egg photo evidence is accepted automatically."""
import sys,unittest,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from photo_guard82 import suspicious,source_title,inspect_image
from PIL import Image
class Photo82Tests(unittest.TestCase):
 def test_reject_eggs_and_nest_images(self):
  for title in ('File:Parus major egg.jpg','File:Passer montanus eggs.jpg','File:Falco egg clutch.jpg','File:Anas oeufs.jpg','File:Picus viridis nest.jpg','File:Anser яйца.jpg','File:Limosa limosa MHNT.jpg','File:Naturalis bird skin specimen.jpeg','File:Melanitta nigra Thorburn.jpg'):
   with self.subTest(title=title):
    self.assertTrue(suspicious({'source':'https://commons.wikimedia.org/wiki/'+title.replace(' ','_')}))
 def test_allow_bird_portrait_titles(self):
  self.assertFalse(suspicious({'source':'https://commons.wikimedia.org/wiki/File:Parus_major_adult_bird.jpg'}))
  self.assertEqual(source_title({'source':'https://commons.wikimedia.org/wiki/File:Parus_major_adult_bird.jpg'}),'File:Parus major adult bird.jpg')
 def test_reject_broken_and_too_small_images(self):
  with tempfile.TemporaryDirectory() as directory:
   small=Path(directory)/'small.jpg'
   valid=Path(directory)/'valid.jpg'
   broken=Path(directory)/'bad.jpg'
   Image.new('RGB',(100,120),'white').save(small)
   Image.new('RGB',(350,250),'white').save(valid)
   broken.write_bytes(b'not a real jpg')
   self.assertEqual(inspect_image(small),'too-small')
   self.assertEqual(inspect_image(valid),'')
   self.assertEqual(inspect_image(broken),'cannot-decode')
if __name__=='__main__':unittest.main()
