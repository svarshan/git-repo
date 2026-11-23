import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from remaining21_inat90 import candidate


class InaturalistFinalPassTests(unittest.TestCase):
    def setUp(self):
        self.observation = {
            "id": 123456,
            "quality_grade": "research",
            "taxon": {"name": "Aquila heliaca"},
            "user": {"login": "birdobserver"},
            "description": "Wild eagle call recorded in the field",
            "license_code": "cc-by",
        }
        self.sound = {
            "id": 98765,
            "file_url": "https://static.inaturalist.org/sounds/98765.mp3",
            "license_code": "cc-by-sa",
            "attribution": "Bird Observer",
        }

    def test_accepts_exact_species_sound_license_and_provenance(self):
        result = candidate(self.observation, self.sound, "Aquila heliaca")
        self.assertIsNotNone(result)
        self.assertEqual(result["recordingId"], "iNat:98765")
        self.assertEqual(result["licenseCode"], "CC-BY-SA")
        self.assertEqual(result["sourceTaxon"], "Aquila heliaca")

    def test_rejects_observation_license_when_sound_license_is_missing(self):
        self.assertIsNone(candidate(self.observation, {**self.sound, "license_code": None},
                                    "Aquila heliaca"))

    def test_rejects_noncommercial_sound(self):
        self.assertIsNone(candidate(self.observation, {**self.sound, "license_code": "cc-by-nc"},
                                    "Aquila heliaca"))

    def test_rejects_wrong_species_or_non_research_grade(self):
        self.assertIsNone(candidate(self.observation, self.sound, "Aquila chrysaetos"))
        self.assertIsNone(candidate({**self.observation, "quality_grade": "needs_id"},
                                    self.sound, "Aquila heliaca"))

    def test_rejects_human_narration_and_external_host(self):
        self.assertIsNone(candidate({**self.observation, "description": "people talking"}, self.sound,
                                    "Aquila heliaca"))
        self.assertIsNone(candidate(self.observation,
                                    {**self.sound, "file_url": "https://example.org/voice.mp3"},
                                    "Aquila heliaca"))

    def test_requires_sound_specific_attribution(self):
        self.assertIsNone(candidate(self.observation, {**self.sound, "attribution": None},
                                    "Aquila heliaca"))


if __name__ == "__main__":
    unittest.main()
