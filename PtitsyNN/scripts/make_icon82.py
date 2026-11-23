#!/usr/bin/env python3
"""Generate the MoOLVa branded bird crest for Windows from the established navy/gold palette.
Keep the in-app bird crest and MoOLVa text. Do not replace with default Electron icon.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
OUT=Path(__file__).resolve().parents[1]/'build'
def main():
 OUT.mkdir(parents=True,exist_ok=True)
 n=512
 im=Image.new('RGBA',(n,n),(0,0,0,0));d=ImageDraw.Draw(im)
 d.rounded_rectangle((12,12,n-12,n-12),radius=100,fill='#071422')
 d.rounded_rectangle((25,25,n-25,n-25),radius=88,outline='#c79a52',width=19)
 d.ellipse((124,90,388,354),fill='#193f5b')
 # Original stylized bird and wing silhouette, readable at 32 px.
 d.ellipse((206,182,351,300),fill='#f8f1d9')
 d.polygon([(235,212),(130,150),(170,245),(270,294)],fill='#faf6e9')
 d.polygon([(332,211),(407,225),(332,249)],fill='#df9a54')
 d.ellipse((304,201,318,215),fill='#071422')
 d.arc((120,257,386,395),15,165,fill='#72bdcf',width=16)
 try:font=ImageFont.truetype('arialbd.ttf',72)
 except OSError:font=ImageFont.load_default()
 d.text((256,390),'MoOLVa',font=font,anchor='mm',fill='#fff3d7',stroke_width=1,stroke_fill='#193f5b')
 im.save(OUT/'moolva.png')
 im.save(OUT/'moolva.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
 print('MoOLVa custom bird crest created for Windows',flush=True)
if __name__=='__main__':main()
