import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from voice_guard85 import verify
from audio_audit85 import near_duplicate

class Audio85Tests(unittest.TestCase):
    def test_baseline_loss_and_changed_bytes_are_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = Path(tmp)
            audio = app/'media'/'audio'
            audio.mkdir(parents=True)
            (audio/'test.mp3').write_bytes(b'preserved audio')
            digest = hashlib.sha256(b'preserved audio').hexdigest()
            birds = [{'latin': 'Species '+str(i), 'audioFile': 'media/audio/test.mp3',
                      'audioCredits': {'source':'https://example.org', 'license':'CC BY'}} for i in range(298)]
            rows = [{'latin':b['latin'], 'file':'media/audio/test.mp3', 'sha256':digest} for b in birds[:265]]
            baseline = {'records':rows}
            def save():
                (app/'data.js').write_text('window.BIRDS_DATA='+json.dumps(birds)+';', encoding='utf-8')
            save()
            self.assertEqual(verify(app, baseline)['preserved'],265)
            birds[23]['audioFile'] = None
            save()
            with self.assertRaisesRegex(ValueError, 'active recording missing'):
                verify(app, baseline)
            birds[23]['audioFile'] = 'media/audio/test.mp3'
            save()
            (audio/'test.mp3').write_bytes(b'changed bytes')
            with self.assertRaisesRegex(ValueError, 'hash mismatch'):
                verify(app, baseline)

    def test_fingerprint_detection_does_not_assume_short_matches(self):
        a = tuple((i * 2654435761) & 0xffffffff for i in range(180))
        b = tuple(x ^ 1 for x in a)
        different = tuple((i * 1103515245 + 12345) & 0xffffffff for i in range(180))
        self.assertTrue(near_duplicate(a,b))
        self.assertFalse(near_duplicate(a,different))
        self.assertFalse(near_duplicate(a[:20],b[:20]))

if __name__ == '__main__':
    unittest.main()
