"""Offline fixture tests only; no synthetic asset is shipped or deployed."""
import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops

spec=importlib.util.spec_from_file_location('installer',Path(__file__).with_name('install-hands.py'))
installer=importlib.util.module_from_spec(spec);spec.loader.exec_module(installer)

class InstallerTests(unittest.TestCase):
    def fixture(self, key):
        photo=Image.new('RGB',(100,180),(160,10,20) if key=='red' else (5,30,80))
        draw=ImageDraw.Draw(photo);draw.rectangle((32,8,67,179),fill=(205,156,120));draw.rectangle((1,1,4,4),fill=(205,156,120))
        return photo

    def test_keys_crop_and_stain(self):
        decal=Image.new('L',(30,30));ImageDraw.Draw(decal).ellipse((2,2,28,28),fill=255)
        for key in ('red','blue'):
            t=installer.cutout(self.fixture(key),0,key);a=t.getchannel('A');self.assertEqual(t.size,(48,96));self.assertGreater(a.getbbox()[0],0);self.assertEqual(a.getpixel((0,0)),0)
            for i in range(6):
                s=installer.stain(t,decal,i);self.assertEqual(s.getchannel('A').getextrema(),(0,255));self.assertEqual(s.getchannel('A').getpixel((24,95)),0)
                self.assertEqual(s.tobytes(),installer.stain(t,decal,i).tobytes());self.assertTrue(any(r>2*g and g<75 and a>0 for r,g,b,a in s.getdata()))

    def test_source_hash_and_dimensions(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);f=p/'fixture.jpg';self.fixture('blue').save(f);digest=hashlib.sha1(f.read_bytes()).hexdigest()
            source=(f.name,'unused',digest,(100,180),0,'blue');self.assertEqual(installer.source_photo(source,p).size,(48,96))
            with self.assertRaisesRegex(ValueError,'checksum'):installer.source_photo((f.name,'unused','0'*40,(100,180),0,'blue'),p)
            with self.assertRaisesRegex(ValueError,'dimensions'):installer.source_photo((f.name,'unused',digest,(2,2),0,'blue'),p)

    def test_full_atlas_fixture(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);sources=[]
            for i,key in enumerate(('blue','red','red')):
                f=p/f'{i}.jpg';self.fixture(key).save(f);sources.append((f.name,'unused',hashlib.sha1(f.read_bytes()).hexdigest(),(100,180),0,key))
            decal=Image.new('RGBA',(512,512));ImageDraw.Draw(decal).ellipse((110,110,400,400),fill=(130,0,0,255));decal.save(p/installer.BLOOD[0])
            with patch.object(installer,'SOURCES',sources):installer.build(p,p/'atlas.png')
            with Image.open(p/'atlas.png') as im:
                self.assertEqual(im.size,(288,96));self.assertEqual(im.mode,'RGBA');self.assertTrue(all(im.crop((i*48,0,(i+1)*48,96)).getchannel('A').getbbox() for i in range(6)))
            self.assertFalse((p/'atlas.tmp.png').exists())

if __name__=='__main__':unittest.main()
