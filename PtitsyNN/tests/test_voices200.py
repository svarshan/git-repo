import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from voices_200 import same_species, inspect_sound, allowed_host, ALLOWED, TARGET


def bird():
    return {"id": "test", "latin": "Parus major", "name": "Большая синица"}


def obs(taxon="Parus major", quality="research"):
    return {
        "id": 918273645,
        "quality_grade": quality,
        "taxon": {"name": taxon},
        "user": {"login": "bird-recorder"},
        "sounds": [],
    }


def sound(license_code="cc-by", url="https://static.inaturalist.org/sounds/12345.mp3"):
    return {
        "id": 12345, "license_code": license_code,
        "file_url": url, "file_content_type": "audio/mpeg",
        "attribution": "(c) bird-recorder, CC BY",
    }


class TestVoices200(unittest.TestCase):
    def test_target_stays_200(self):
        self.assertEqual(TARGET, 200)

    def test_exact_taxon_only(self):
        self.assertTrue(same_species("Parus major", bird()))
        self.assertFalse(same_species("Parus montanus", bird()))
        self.assertFalse(same_species("Parus major minor", bird()))

    def test_individual_sound_license_not_observation(self):
        self.assertIsNotNone(inspect_sound(sound("cc-by"), obs(), bird()))
        for code in ("cc-by-nc", "cc-by-nd", "none", "", "all-rights-reserved", "cc-by-nc-sa"):
            self.assertIsNone(inspect_sound(sound(code), obs(), bird()), code)

    def test_author_attribution_and_exact_observation_taxon(self):
        self.assertIsNone(inspect_sound(sound(), obs("Parus caeruleus"), bird()))
        self.assertIsNone(inspect_sound({**sound(), "attribution": ""}, {**obs(), "user": {}}, bird()))
        x = inspect_sound(sound("cc-by-sa"), obs(), bird())
        self.assertTrue(x["source"].startswith("https://www.inaturalist.org/observations/"))
        self.assertEqual(x["license"], "CC-BY-SA")
        self.assertIn("audioReview", x)

    def test_no_untrusted_audio_hosts(self):
        self.assertFalse(allowed_host("evil-example.com"))
        self.assertTrue(allowed_host("static.inaturalist.org"))
        self.assertIsNone(inspect_sound(sound(url="https://example.com/x.mp3"), obs(), bird()))
        self.assertIsNone(inspect_sound(sound(url="http://static.inaturalist.org/x.mp3"), obs(), bird()))


if __name__ == "__main__":
    unittest.main()
