import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import attach_voices88 as m


class AttachBirdVoicesTests(unittest.TestCase):
    def test_only_exact_taxon_with_media_level_open_license(self):
        sample={'gen':'Larus','sp':'cachinnans','id':'123456','rec':'Field recorder',
                'q':'A','file':'https://xeno-canto.org/123456/download',
                'type':'contact call','lic':'https://creativecommons.org/licenses/by-sa/4.0/'}
        self.assertIsNotNone(m.soft_xeno(sample,'Larus cachinnans'))
        self.assertIsNone(m.soft_xeno(sample,'Larus hyperboreus'))
        self.assertIsNone(m.soft_xeno({**sample,'lic':'https://creativecommons.org/licenses/by-nc/4.0/'},'Larus cachinnans'))
        self.assertIsNone(m.soft_xeno({**sample,'also':['Larus canus']},'Larus cachinnans'))
        self.assertIsNone(m.soft_xeno({**sample,'rmk':'human speech in foreground'},'Larus cachinnans'))

    def test_promoting_new_voice_keeps_historical_media_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            audio=root/'media'/'audio'
            audio.mkdir(parents=True)
            old=audio/'known.mp3'
            old.write_bytes(b'KNOWN ORIGINAL AUDIO DATA')
            old_hash=m.filehash(old)
            source=root/'candidate.mp3'
            source.write_bytes(b'ANOTHER REAL MP3 FIXTURE')
            bird={'latin':'Larus cachinnans','name':'Хохотунья','audioFile':None}
            item={'recordingId':'XC123456','source':'https://xeno-canto.org/123456',
                  'sourceTaxon':'Larus cachinnans','author':'Recorder',
                  'license':'https://creativecommons.org/licenses/by/4.0/',
                  'quality':'A','type':'call','sourcePlatform':'Xeno-canto'}
            with patch.object(m,'APP',root):
                record=m.promote(bird,item,source,{old_hash},{'seconds':3})
            self.assertEqual(m.filehash(old),old_hash)
            self.assertTrue((root/bird['audioFile']).is_file())
            self.assertEqual(bird['audioCredits']['reviewStatus'],'awaiting-user-review')
            self.assertIs(bird['audioCredits']['speciesHumanVerified'],False)
            self.assertEqual(record['recordingId'],'XC123456')

    def test_inaturalist_audio_has_exact_media_sound_provenance(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'media'/'audio').mkdir(parents=True)
            source=root/'candidate.mp3'
            source.write_bytes(b'a sample audio fixture')
            item={'recordingId':'iNat:98765','source':'https://www.inaturalist.org/observations/12345',
                  'soundId':98765,'sourceTaxon':'Gavia arctica','sourcePlatform':'iNaturalist',
                  'author':'Observer','licenseCode':'CC-BY',
                  'license':'https://creativecommons.org/licenses/by/4.0/',
                  'quality':'research-grade observation','type':'call'}
            bird={'latin':'Gavia arctica','name':'Чернозобая гагара'}
            with patch.object(m,'APP',root):
                m.promote(bird,item,source,set(),{'seconds':8,'meanDb':-18})
            credit=bird['audioCredits']
            self.assertEqual(credit['soundId'],98765)
            self.assertEqual(credit['recordingId'],'iNat:98765')
            self.assertEqual(credit['license'],'CC-BY')
            self.assertRegex(credit['speciesMatch'],r'exact scientific taxon name on research-grade')
            self.assertIn('FFmpeg',credit['audioProcessing'])

    def test_reject_duplicate_or_existing_primary_audio(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'media'/'audio').mkdir(parents=True)
            p=root/'candidate.mp3'
            p.write_bytes(b'fake fixture')
            item={'recordingId':'XC1'}
            with patch.object(m,'APP',root):
                with self.assertRaises(ValueError):
                    m.promote({'latin':'A a','audioFile':'old.mp3'},item,p,set(),{})
                with self.assertRaises(ValueError):
                    m.promote({'latin':'A a'},item,p,{m.filehash(p)},{})


if __name__ == '__main__':
    unittest.main()
