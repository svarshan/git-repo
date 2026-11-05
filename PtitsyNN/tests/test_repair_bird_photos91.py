import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from repair_bird_photos91 import apply_photos

class RepairBirdPhotos(unittest.TestCase):
    def test_replaces_photo_without_changing_audio_and_is_repeatable(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); assets=root/'assets'; app=root/'app'
            assets.mkdir()
            photo=assets/'bird.jpg'
            Image.new('RGB',(200,200),'blue').save(photo)
            entry={'latin':'Example species','file':'bird.jpg','sha256':hashlib.sha256(photo.read_bytes()).hexdigest(),'author':'Photographer','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','source':'https://commons.wikimedia.org/wiki/File:Example.jpg','photoReview':'reviewed'}
            bird={'id':'example','name':'Example bird','latin':'Example species','imageFile':'media/image/old.jpg','audioFile':'media/audio/old.mp3','audioCredits':{'author':'Original'}}
            apply_photos([bird],[entry],assets,app)
            self.assertEqual(bird['imageFile'],'media/image/example-visual91.jpg')
            self.assertEqual(bird['audioFile'],'media/audio/old.mp3')
            self.assertEqual(bird['audioCredits'],{'author':'Original'})
            self.assertEqual((app/bird['imageFile']).read_bytes(),photo.read_bytes())
            apply_photos([bird],[entry],assets,app)
            self.assertEqual((app/bird['imageFile']).read_bytes(),photo.read_bytes())

    def test_rejects_tampered_photo_without_modifying_catalog(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); photo=root/'bird.jpg'
            Image.new('RGB',(200,200)).save(photo)
            bird={'id':'b','latin':'Example species','imageFile':'old.jpg'}
            entry={'latin':'Example species','file':'bird.jpg','sha256':'0'*64}
            with self.assertRaises(ValueError):
                apply_photos([bird],[entry],root,root/'app')
            self.assertEqual(bird['imageFile'],'old.jpg')
