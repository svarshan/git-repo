"""Tests for ULTRA multi-track catalog safety and stable existing media."""
import sys,unittest,tempfile
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import ultra_tracks
class UltraTracksTests(unittest.TestCase):
 def test_absent_track_file_excluded(self):
  b={'audioTracks':[{'path':'media/audio/does-not-exist-xyzz-99888.mp3',
                     'credit':{'source':'https://commons.wikimedia.org/wiki/File:example'}}]}
  self.assertEqual(ultra_tracks.stored(b),[])
 def test_audio_formats_known(self):
  for val in ('audio/mpeg','audio/ogg','audio/wav'):
   self.assertIn(val,ultra_tracks.voice_max.AUDIO)
 def test_protect_against_wrong_species(self):
  b={'latin':'Parus major'}
  self.assertTrue(ultra_tracks.harvest_voices.match_scientific('Parus major song recording',['Parus major']))
  self.assertFalse(ultra_tracks.harvest_voices.match_scientific('Parus montanus song recording',['Parus major']))
 def test_voice_filenames_stay_local(self):
  b={'audioTracks':[{'path':'../private/file.mp3','credit':{'license':'CC BY 4.0'}}]}
  self.assertEqual(ultra_tracks.stored(b),[])
if __name__=='__main__':unittest.main()
