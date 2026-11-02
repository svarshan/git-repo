import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from voice_guard84 import check_report
class VoiceGate84(unittest.TestCase):
 def report(self,n,missing):
  return {'species':298,'photos':298,'articles':298,'birdCalls':n,'missingAudio':missing}
 def test_264_is_minimum(self):
  self.assertEqual(check_report(self.report(264,['Other species '+str(i) for i in range(34)]))['remaining'],34)
 def test_261_is_blocked(self):
  with self.assertRaises(RuntimeError):check_report(self.report(261,['Other species '+str(i) for i in range(37)]))
 def test_8_2_recovered_species_cannot_disappear(self):
  with self.assertRaises(RuntimeError):check_report(self.report(264,['Asio otus']+['Other species '+str(i) for i in range(33)]))
 def test_inventory_mismatch_blocked(self):
  with self.assertRaises(RuntimeError):check_report(self.report(264,['Other']))
if __name__=='__main__':unittest.main()
