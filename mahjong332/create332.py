#!/usr/bin/env python3
"""MoOLVa Mahjong 3.3.2 real porcelain textures + GLES 2.0 compatible filter."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageEnhance
import math,sys
root=Path(sys.argv[1])
assets=root/'app/src/main/assets'
for i in range(24):
 src=Image.open(assets/'atelier'/f'{i:02}.jpg').convert('RGBA')
 face=src.crop((52,64,460,576)).resize((240,300),Image.Resampling.LANCZOS)
 bg=face.getpixel((8,8)); mask=Image.new('L',face.size,0)
 mp=mask.load();sp=face.load()
 for y in range(300):
  for x in range(240):
   r,g,b,a=sp[x,y];d=abs(r-bg[0])+abs(g-bg[1])+abs(b-bg[2]);mp[x,y]=0 if d<24 else min(255,int((d-15)*4.5))
 mask=mask.filter(ImageFilter.MedianFilter(3)).filter(ImageFilter.GaussianBlur(.8))
 l,t,r,b=mask.getbbox() or (0,0,240,300);pad=6
 l=max(0,l-pad);t=max(0,t-pad);r=min(240,r+pad);b=min(300,b+pad)
 motif=face.crop((l,t,r,b));motif.putalpha(mask.crop((l,t,r,b)))
 rgb=ImageEnhance.Sharpness(ImageEnhance.Contrast(ImageEnhance.Color(motif.convert('RGB')).enhance(1.25)).enhance(1.22)).enhance(1.8)
 motif=rgb.convert('RGBA');motif.putalpha(mask.crop((l,t,r,b)))
 s=min(320/motif.width,380/motif.height);motif=motif.resize((int(motif.width*s),int(motif.height*s)),Image.Resampling.LANCZOS)
 alpha=motif.getchannel('A');w,h=512,640
 out=Image.new('RGBA',(w,h));pix=out.load();cx,cy=w*.35,h*.24
 for y in range(h):
  for x in range(w):
   dx=(x-cx)/w;dy=(y-cy)/h;radius=(dx*dx+dy*dy)**.5
   warm=8*math.sin(x*.03+y*.02)+6*math.sin(x*.07)+5*math.sin(y*.05)
   base=250-int(23*radius)
   pix[x,y]=(int(max(228,min(255,base))),int(max(222,min(252,base-4+warm/4))),int(max(212,min(246,base-12+warm/6))),255)
 overlay=Image.new('RGBA',(w,h),(0,0,0,0));draw=ImageDraw.Draw(overlay)
 draw.rounded_rectangle((18,18,w-18,h-18),radius=60,outline=(243,229,196,220),width=4)
 draw.rounded_rectangle((25,25,w-25,h-25),radius=58,outline=(198,153,83,255),width=4)
 draw.rounded_rectangle((38,38,w-38,h-38),radius=46,outline=(215,178,117,200),width=2)
 hl=Image.new('RGBA',(w,h),(0,0,0,0));hd=ImageDraw.Draw(hl)
 hd.ellipse((-10,-20,int(w*.9),int(h*.5)),fill=(255,255,255,44))
 out=Image.alpha_composite(out,hl.filter(ImageFilter.GaussianBlur(28)))
 out=Image.alpha_composite(out,overlay)
 d=ImageDraw.Draw(out);c=(212,165,88,255)
 for x,y,fx,fy in ((44,44,1,1),(w-112,44,-1,1),(44,h-112,1,-1),(w-112,h-112,-1,-1)):
  d.arc((x,y,x+68,y+68),180 if fx<0 else 270,270 if fy<0 else 360,fill=c,width=4)
  d.line((x+(64 if fx>0 else 4),y+20,x+(34 if fx>0 else 64),y+20),fill=c,width=4)
  d.line((x+20,y+(64 if fy>0 else 4),x+20,y+(34 if fy>0 else 64)),fill=c,width=4)
  d.ellipse((x+(57 if fx>0 else 7),y+(7 if fy>0 else 57),x+(69 if fx>0 else 19),y+(19 if fy>0 else 69)),outline=(235,204,141,255),width=2)
 pos=((w-motif.width)//2,(h-motif.height)//2)
 ol=Image.new('RGBA',motif.size,(181,132,57,120));ol.putalpha(alpha.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(3)))
 tmp=Image.new('RGBA',(w,h),(0,0,0,0));tmp.paste(ol,pos,ol)
 out=Image.alpha_composite(out,tmp.filter(ImageFilter.GaussianBlur(1)))
 sh=Image.new('RGBA',motif.size,(58,35,16,100));sh.putalpha(alpha)
 tmp=Image.new('RGBA',(w,h),(0,0,0,0));tmp.paste(sh,(pos[0]+4,pos[1]+8),sh)
 out=Image.alpha_composite(out,tmp.filter(ImageFilter.GaussianBlur(6)))
 out.paste(motif,pos,motif)
 gloss=Image.new('RGBA',(w,h),(0,0,0,0));ImageDraw.Draw(gloss).rounded_rectangle((24,22,w-24,int(h*.42)),radius=54,fill=(255,255,255,14))
 out=Image.alpha_composite(out,gloss.filter(ImageFilter.GaussianBlur(22))).convert('RGB')
 out.save(assets/'atelier'/f'{i:02}.jpg',quality=96)
 out.resize((256,296),Image.Resampling.LANCZOS).save(assets/'tiles'/f'tile_{i:02}.jpg',quality=95)

build=root/'app/build.gradle';txt=build.read_text();txt=txt.replace("versionName '3.3.1'","versionName '3.3.2'");build.write_text(txt)
board=root/'app/src/main/java/com/moolva/mahjong/Board3DView.java';txt=board.read_text()
txt=txt.replace('o.inPreferredConfig=Bitmap.Config.RGB_565;', 'o.inPreferredConfig=Bitmap.Config.ARGB_8888;')
# GLES 2.0 NPOT images (512 x 640) must NOT use mipmaps: invalid texture on many devices.
# Only power-of-two images receive mipmaps, all others use linear filtering.
txt=txt.replace('GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);', '''boolean pot=(bitmap.getWidth()&(bitmap.getWidth()-1))==0 && (bitmap.getHeight()&(bitmap.getHeight()-1))==0;
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MIN_FILTER,pot?GLES20.GL_LINEAR_MIPMAP_LINEAR:GLES20.GL_LINEAR);''')
txt=txt.replace('GLUtils.texImage2D(GLES20.GL_TEXTURE_2D,0,bitmap,0);return a[0];', '''GLUtils.texImage2D(GLES20.GL_TEXTURE_2D,0,bitmap,0);
            if(pot)GLES20.glGenerateMipmap(GLES20.GL_TEXTURE_2D);
            return a[0];''')
board.write_text(txt)
view=root/'app/src/main/java/com/moolva/mahjong/GameView.java';txt=view.read_text();txt=txt.replace('opts.inSampleSize=4;','opts.inSampleSize=2;').replace('o.inSampleSize=2;','o.inSampleSize=1;');view.write_text(txt)
(root/'RELEASE_NOTES_3.3.2.md').write_text('MoOLVa Mahjong 3.3.2: Real Porcelain Gameplay Tiles; 24 face textures, high-quality previews, GLES2-safe filtering. Original progress unchanged.\n')
print('Applied 3.3.2 patch: 24 tile faces and 24 thumbnails, GLES2-safe texture filtering')