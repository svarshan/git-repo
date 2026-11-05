import hashlib,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from install_personal_voices92 import apply_recordings,EXPECTED,quarantine_eagle
def fixtures(root):
    birds=[];items=[]
    for i,latin in enumerate(sorted(EXPECTED)):
        name='clip'+str(i)+'.mp3';data=(b'ID3'+bytes([i]))*1000
        (root/name).write_bytes(data)
        bird={'id':str(i),'name':latin,'latin':latin,'audioFile':None,'audioCredits':None}
        if latin=='Clanga clanga':
            bird['audioFile']='media/audio/clanga-clanga-inat.mp3'
            bird['audioCleanFile85']='media/audio/old-clean.mp3'
            bird['audioTracks']=[{'path':'old.mp3'}]
        birds.append(bird)
        items.append({'latin':latin,'file':name,'sha256':hashlib.sha256(data).hexdigest(),'id':str(100+i),
                      'source':'https://xeno-canto.org/'+str(100+i),'author':'Person',
                      'license':'https://creativecommons.org/licenses/by-nc-sa/4.0/',
                      'quality':'A','type':'call','metrics':{}})
    return birds,items
class PersonalVoicesTests(unittest.TestCase):
    def test_installs_all_preserves_archive_and_marks_noncommercial(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);assets=root/'assets';app=root/'app';assets.mkdir()
            old=app/'media'/'audio'/'clanga-clanga-inat.mp3';old.parent.mkdir(parents=True)
            old.write_bytes(b'archival original')
            birds,items=fixtures(assets)
            result=apply_recordings(birds,items,assets,app)
            self.assertEqual(len(result),6)
            self.assertTrue(all(b['audioCredits']['noncommercialOnly'] for b in birds))
            self.assertTrue(all(b['audioCredits']['speciesHumanVerified'] is False for b in birds))
            self.assertTrue(all((app/b['audioFile']).is_file() for b in birds))
            self.assertEqual(old.read_bytes(),b'archival original')
            self.assertEqual(len(apply_recordings(birds,items,assets,app)),6)
    def test_wind_only_eagle_quarantined_without_deleting_original_file(self):
        bird={'latin':'Clanga clanga','audioFile':'media/audio/clanga-clanga-xc19688.mp3',
              'audioCredits':{'recordingId':'XC19688'},'audioTracks':[{'path':'other.mp3'}],
              'audioCleanFile85':'old.mp3'}
        self.assertTrue(quarantine_eagle([bird]))
        self.assertIsNone(bird['audioFile'])
        self.assertIsNone(bird['audioCredits'])
        self.assertEqual(bird['audioTracks'],[])
        self.assertNotIn('audioCleanFile85',bird)

    def test_rejects_damaged_file_without_modifying_birds(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);assets=root/'assets';assets.mkdir()
            birds,items=fixtures(assets);items[-1]['sha256']='0'*64
            original=[b['audioFile'] for b in birds]
            with self.assertRaises(ValueError):apply_recordings(birds,items,assets,root/'app')
            self.assertEqual([b['audioFile'] for b in birds],original)
