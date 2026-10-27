"""MoOLVa 8.1 species nonregression checks against 7.9 immutable evidence."""
import csv,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import voice_guard81 as guard

class GuardTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.base=Path(self.tmp.name)
  self.old=self.base/'data'/'baseline79'
  self.old.mkdir(parents=True)
  self.result=self.base/'dist'/'release-evidence'
  self.result.mkdir(parents=True)
  old_missing=['Taxon '+str(i) for i in range(37)]
  with (self.old/'missing-voices.csv').open('w',encoding='utf-8-sig',newline='') as f:
   w=csv.writer(f,delimiter=';')
   w.writerow(['№','Название вида','Научное название','Группа','Статус'])
   for i,name in enumerate(old_missing):w.writerow([i,name,name,'Test','Нет'])
  (self.old/'coverage.json').write_text(json.dumps({'species':298,'photos':298,'articles':298,'birdCalls':261}),encoding='utf-8')
  self.write_current(old_missing)
  self.prev=(guard.BASE,guard.BEFORE,guard.REPORT)
  guard.BASE=self.base;guard.BEFORE=self.old;guard.REPORT=self.result

 def tearDown(self):
  guard.BASE,guard.BEFORE,guard.REPORT=self.prev
  self.tmp.cleanup()

 def write_current(self,missing):
  p=self.base/'data';p.mkdir(exist_ok=True)
  (p/'coverage.json').write_text(json.dumps({'species':298,'photos':298,'articles':298,'birdCalls':298-len(missing),'missingAudio':missing}),encoding='utf-8')

 def test_unchanged_original_261_species_pass(self):
  guard.inspect()
  result=json.loads((self.result/'voice-regression.json').read_text('utf-8'))
  self.assertEqual(result['currentBirdCalls'],261)
  self.assertEqual(result['newlyMissingPreviouslyPresent'],[])

 def test_new_species_can_never_disappear_even_at_equal_voice_count(self):
  self.write_current(['Taxon '+str(i) for i in range(36)]+['Different bird'])
  with self.assertRaisesRegex(RuntimeError,'Audio regression'):guard.inspect()
  result=json.loads((self.result/'voice-regression.json').read_text('utf-8'))
  self.assertEqual(result['newlyMissingPreviouslyPresent'],['Different bird'])

 def test_voice_count_regression_blocks_release(self):
  self.write_current(['Taxon '+str(i) for i in range(37)]+['Different bird'])
  with self.assertRaisesRegex(RuntimeError,'Audio regression'):guard.inspect()
  self.assertEqual(json.loads((self.result/'voice-regression.json').read_text('utf-8'))['currentBirdCalls'],260)

 def test_real_recovery_from_previous_missing_allowed(self):
  self.write_current(['Taxon '+str(i) for i in range(36)])
  guard.inspect()
  result=json.loads((self.result/'voice-regression.json').read_text('utf-8'))
  self.assertEqual(result['recoveredSinceBaseline'],['Taxon 36'])

if __name__=='__main__':unittest.main()
