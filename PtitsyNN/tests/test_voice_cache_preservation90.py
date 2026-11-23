import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from restore_baseline85 import valid_cached_addition


class PreserveLicensedVoiceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.app = Path(self.tmp.name)
        (self.app / "media" / "audio").mkdir(parents=True)
        self.filename = "media/audio/rare-bird-test.mp3"
        self.path = self.app / self.filename
        self.path.write_bytes(b"example audio bytes")
        self.bird = {
            "audioFile": self.filename,
            "audioCredits": {
                "source": "https://commons.wikimedia.org/wiki/File:Bird.ogg",
                "author": "Real recordist",
                "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
                "sourcePlatform": "Wikimedia Commons",
                "reviewStatus": "awaiting-user-review",
                "speciesHumanVerified": False,
                "sha256": hashlib.sha256(self.path.read_bytes()).hexdigest(),
            },
        }

    def test_verified_additional_voice_is_preserved(self):
        self.assertTrue(valid_cached_addition(self.app, self.bird, {"audioFile": None}))

    def test_historical_record_never_replaced_by_cached_addition(self):
        self.assertFalse(valid_cached_addition(self.app, self.bird, {"audioFile": "media/audio/old.mp3"}))

    def test_bad_checksum_does_not_silently_count_as_audio(self):
        self.path.write_bytes(b"unexpected content")
        self.assertFalse(valid_cached_addition(self.app, self.bird, {"audioFile": None}))

    def test_nonfree_or_missing_media_is_rejected(self):
        self.bird["audioCredits"]["licenseUrl"] = "https://creativecommons.org/licenses/by-nc-sa/4.0/"
        self.assertFalse(valid_cached_addition(self.app, self.bird, {"audioFile": None}))
        self.bird["audioCredits"]["licenseUrl"] = "https://creativecommons.org/licenses/by-sa/4.0/"
        self.path.unlink()
        self.assertFalse(valid_cached_addition(self.app, self.bird, {"audioFile": None}))

    def test_path_traversal_is_rejected(self):
        self.bird["audioFile"] = "media/audio/../../secret.mp3"
        self.assertFalse(valid_cached_addition(self.app, self.bird, {"audioFile": None}))


if __name__ == "__main__":
    unittest.main()
