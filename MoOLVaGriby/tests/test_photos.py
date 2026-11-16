import unittest
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from fetch_commons import license_ok,photo_candidate

class TestMediaSafety(unittest.TestCase):
 def test_licenses(self):
  self.assertTrue(license_ok('CC BY-SA 4.0'))
  self.assertTrue(license_ok('CC0 1.0'))
  self.assertFalse(license_ok('CC BY-NC 4.0'))
  self.assertFalse(license_ok('CC BY-ND 3.0'))
  self.assertFalse(license_ok('All rights reserved'))
 def test_exact_taxon(self):
  self.assertTrue(photo_candidate('File:Boletus_edulis_01.jpg','Boletus edulis'))
  self.assertFalse(photo_candidate('File:Boletus_reticulatus_01.jpg','Boletus edulis'))
  self.assertFalse(photo_candidate('File:Boletus_edulis_spores.jpg','Boletus edulis'))

if __name__=='__main__':unittest.main()
