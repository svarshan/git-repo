"""Offline 8.3 audio audit safeguards: title flags are leads, not human certifications."""
import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from audio_review83 import SUSPICIOUS
class Audio83Tests(unittest.TestCase):
 def test_flags_interview_or_music_titles_for_manual_check(self):
  for x in ('Bird conversation.mp3','human speech audio.ogg','Music of forest.wav','разговор птиц.ogg'):
   with self.subTest(title=x):self.assertIsNotNone(SUSPICIOUS.search(x))
 def test_does_not_assume_species_or_manufacture_certification(self):
  self.assertIsNone(SUSPICIOUS.search('Parus major singing XC123456.ogg'))
if __name__=='__main__':unittest.main()
