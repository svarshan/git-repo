"""Offline regression checks for taxon matching, licenses and xeno-canto safety."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import voice_max
class TestVoiceMax(unittest.TestCase):
 def test_free_licenses_only(self):
  self.assertTrue(voice_max.license_ok('https://creativecommons.org/licenses/by/4.0/'))
  self.assertTrue(voice_max.license_ok('https://creativecommons.org/licenses/by-sa/3.0/'))
  self.assertTrue(voice_max.license_ok('https://creativecommons.org/publicdomain/zero/1.0/'))
  for value in ['','all rights reserved','https://creativecommons.org/licenses/by-nc/4.0/',
                'https://creativecommons.org/licenses/by-nd/4.0/',
                'https://creativecommons.org/licenses/by-nc-sa/4.0/']:
   with self.subTest(value=value):self.assertFalse(voice_max.license_ok(value))
 def test_xeno_correct_species_and_metadata(self):
  good={'gen':'Parus','sp':'major','q':'A','id':'987654','rec':'Field researcher',
    'lic':'https://creativecommons.org/licenses/by-sa/4.0/',
    'file':'https://xeno-canto.org/987654/download','type':'song','rmk':'clear bird song'}
  other={**good,'sp':'minor','id':'987655'}
  speech={**good,'id':'987656','rmk':'loud human speech behind bird'}
  forbidden={**good,'id':'987657','lic':'https://creativecommons.org/licenses/by-nc/4.0/'}
  with patch.object(voice_max,'KEY','test-secret'),patch.object(voice_max,'get_json',return_value={'recordings':[other,speech,forbidden,good]}):
   candidates=voice_max.xeno_choices({'latin':'Parus major'})
  self.assertEqual(len(candidates),1)
  self.assertEqual(candidates[0][3]['recordingId'],'XC987654')
  self.assertEqual(candidates[0][3]['vocalization'],'Песня')
 def test_recording_sort_and_safe_host(self):
  self.assertEqual(voice_max.soundtype('alarm call'),'Тревожный сигнал')
  self.assertEqual(voice_max.soundtype('song'),'Песня')
  self.assertFalse(voice_max.download('https://example.com/tracker.mp3',Path('nonexistent.mp3')))
if __name__=='__main__':unittest.main()
