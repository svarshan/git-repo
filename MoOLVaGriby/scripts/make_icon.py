#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'build'/'moolva-griby.ico'
OUT.parent.mkdir(parents=True,exist_ok=True)
S=512
im=Image.new('RGBA',(S,S))
d=ImageDraw.Draw(im)
d.rounded_rectangle((8,8,S-8,S-8),radius=115,fill='#102d24',outline='#cf9c62',width=15)
for r in [160,134,108]:
 d.arc((S//2-r,50,S//2+r,50+r*2),185,355,fill=(223,180,107,65),width=5)
# original stylized mushroom cap
d.ellipse((85,140,430,347),fill='#df9952',outline='#f6d9ac',width=9)
d.pieslice((85,140,430,425),180,360,fill='#d48a46')
d.ellipse((110,256,406,334),fill='#ffdfaf')
d.rounded_rectangle((221,307,304,455),radius=30,fill='#efe0b1')
d.ellipse((188,425,338,463),fill='#c7ce9b')
for x,y,r in [(164,199,17),(245,171,14),(337,205,20),(391,264,11)]:
 d.ellipse((x-r,y-r,x+r,y+r),fill='#fff1cf')
d.arc((100,367,210,450),225,310,fill='#7eae73',width=13)
d.arc((307,367,424,450),230,311,fill='#a9c68e',width=13)
im.save(OUT,format='ICO',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print('Original MoOLVa Griby icon:',OUT)
