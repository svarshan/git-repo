from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import numpy as np, math, random, os
from pathlib import Path

import sys
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '/mnt/data/MoOLVaMahjong_Ultimate_3_2_0_PremiumTiles')
DEST=ROOT/'app/src/main/assets/premium'
DEST.mkdir(parents=True,exist_ok=True)
W,H=448,560
FONT_CJK='/usr/share/fonts/truetype/arphic-gkai00mp/gkai00mp.ttf'
FONT_FA='/usr/share/fonts/opentype/font-awesome/FontAwesome.otf'
FA={'coffee':'\uf0f4','leaf':'\uf06c','star':'\uf005','moon':'\uf186','key':'\uf084','compass':'\uf14e','flame':'\uf06d','camera':'\uf030','music':'\uf001','diamond':'\uf219','gift':'\uf06b','clock':'\uf017','rocket':'\uf135','anchor':'\uf13d','globe':'\uf0ac','trophy':'\uf091','bolt':'\uf0e7','magic':'\uf0d0','paw':'\uf1b0','heart':'\uf004','tree':'\uf1bb'}
MOTIFS=['龙','lotus','bamboo','blossom','mountain','teapot','coffee','coins','koi','crane','春','福','lantern','maple','东','南','fan','pagoda','compass','diamond','月','tree','key','star']
THEMES=[
# base,accent1,accent2,ink,name
((239,226,201),(167,103,37),(176,54,39),(54,54,47),'ivory'),
((38,48,65),(214,177,104),(134,171,189),(228,220,202),'moonstone'),
((47,27,29),(236,177,95),(188,66,54),(238,209,161),'lacquer'),
((65,52,42),(221,160,91),(170,121,76),(235,215,179),'bronze'),
((204,151,89),(133,67,38),(122,54,34),(58,41,37),'amber'),
((88,55,39),(221,174,100),(186,133,65),(234,216,182),'walnut'),
((32,34,37),(235,181,95),(186,105,66),(227,214,181),'obsidian'),
]

def rgba(c,a=255):return tuple(c)+(a,)
def mix(a,b,t):return tuple(int(a[i]*(1-t)+b[i]*t) for i in range(3))
def polygon(draw,xy,fill,outline=None,width=1):draw.polygon(xy,fill=fill); draw.line(xy+[xy[0]],fill=outline or fill,width=width,joint='curve')

def source_background(t,seed):
    base,metal,secondary,ink,name=t
    rng=np.random.default_rng(seed)
    yy,xx=np.ogrid[:H,:W]
    band=np.clip(.30+.55*xx/W-.35*yy/H,0,1)
    noise=rng.normal(0,2.0,(H,W))
    grad=(np.maximum(0,1-np.sqrt(((xx-W*.27)/(W*.85))**2+((yy-H*.16)/(H*.9))**2)))*11
    a=np.zeros((H,W,3),np.uint8)
    for ch in range(3):
       a[:,:,ch]=np.clip(base[ch]+(band-.5)*19+grad+noise,0,255)
    return Image.fromarray(a,'RGB').convert('RGBA')

def motif_layer(motif,t,seed):
    base,gold,secondary,ink,name=t
    s=3
    lw,lh=W*s,H*s
    img=Image.new('RGBA',(lw,lh),(0,0,0,0));d=ImageDraw.Draw(img)
    cx,cy=lw//2,lh//2; gc=tuple(gold);sc=tuple(secondary);ic=tuple(ink)
    def p(x,y):return (int(x*s),int(y*s))
    def ellipse(x,y,r,fill,outline=None,w=1):d.ellipse((p(x-r,y-r),p(x+r,y+r)),fill=fill,outline=outline,width=w*s)
    def line(points,fill,width=4):d.line([p(x,y) for x,y in points],fill=fill,width=max(1,width*s),joint='curve')
    def bezier(points,fill,width=4):
      # smooth Catmull-Rom -> samples
      out=[]
      for i in range(len(points)-1):
        a=points[max(0,i-1)];b=points[i];c=points[i+1];e=points[min(len(points)-1,i+2)]
        for q in range(24):
          t1=q/24;t2=t1*t1;t3=t2*t1
          x=.5*((2*b[0])+(-a[0]+c[0])*t1+(2*a[0]-5*b[0]+4*c[0]-e[0])*t2+(-a[0]+3*b[0]-3*c[0]+e[0])*t3)
          y=.5*((2*b[1])+(-a[1]+c[1])*t1+(2*a[1]-5*b[1]+4*c[1]-e[1])*t2+(-a[1]+3*b[1]-3*c[1]+e[1])*t3)
          out.append((x,y))
      out.append(points[-1]);line(out,fill,width)
    if motif in ['龙','春','福','东','南','月']:
        fontsize=238 if motif=='龙' else 244
        font=ImageFont.truetype(FONT_CJK,fontsize*s)
        bb=d.textbbox((0,0),motif,font=font,stroke_width=1)
        pos=(cx-(bb[0]+bb[2])//2,cy-(bb[1]+bb[3])//2-8*s)
        d.text((pos[0]+4*s,pos[1]+7*s),motif,font=font,fill=(30,20,15,140),stroke_width=1*s,stroke_fill=(50,30,20,100))
        d.text(pos,motif,font=font,fill=rgba(secondary if motif in ['春','福'] else ink),stroke_width=1*s,stroke_fill=rgba(gold))
        # gold red seal
        d.rounded_rectangle((p(294,347),p(331,385)),radius=3*s,fill=(174,41,30,225))
        d.line([p(304,362),p(322,367)],fill=(253,221,169,230),width=2*s)
    elif motif=='bamboo':
        for x,offset in [(172,5),(246,-20),(315,25)]:
            for y in range(154+offset,378+offset,47):
                d.rounded_rectangle((p(x-9,y),p(x+9,y+42)),radius=5*s,fill=rgba((32,94,67) if name not in ('moonstone','obsidian') else (100,176,147)),outline=rgba(gold),width=3*s)
                line([(x-4,y+6),(x-4,y+32)],(193,218,162,255),2)
            for y,dir in [(235,-1),(294,1),(340,-1)]:
                polygon(d,[p(x,y),p(x+dir*92,y-40),p(x+dir*35,y+22)],rgba((40,111,67)),rgba(gold),1*s)
    elif motif=='blossom' or motif=='maple':
        bezier([(138,372),(188,309),(222,241),(286,181),(335,166)],rgba((104,63,43)),8)
        rng=random.Random(seed)
        for x,y in [(160,335),(210,274),(254,218),(309,186),(255,330),(296,273),(182,238)]:
            col=(179,60,47) if motif=='blossom' else (169,104,47)
            for i in range(5):
                a=i*math.tau/5;xx=x+math.cos(a)*21;yy=y+math.sin(a)*21
                d.ellipse((p(xx-14,yy-16),p(xx+14,yy+16)),fill=rgba(col),outline=rgba(gold),width=2*s)
            ellipse(x,y,5,(244,204,100,255))
    elif motif=='lotus':
        center=(225,287)
        for rad,n,k,colors in [(104,8,0,(121,63,68)),(74,8,.3,(182,93,86)),(54,7,.5,(226,144,112))]:
            for i in range(n):
                a=(i+k)*math.tau/n-math.pi/2
                ex=center[0]+math.cos(a)*rad*.55;ey=center[1]+math.sin(a)*rad*.6
                d.ellipse((p(ex-31,ey-60),p(ex+31,ey+60)),fill=rgba(colors),outline=rgba(gold),width=3*s)
        ellipse(225,287,23,(241,174,102,255))
        for j in range(13):
            ang=j*math.tau/13;ellipse(225+15*math.cos(ang),287+14*math.sin(ang),2,(124,71,40,255))
    elif motif=='mountain':
        polygon(d,[p(86,388),p(183,174),p(242,285),p(288,191),p(371,390)],rgba(mix(ink,gold,.25)),rgba(gold),3*s)
        polygon(d,[p(160,240),p(183,174),p(207,225),p(189,216),p(181,232)],(231,217,193,255))
        polygon(d,[p(269,240),p(288,191),p(310,234),p(292,224)],(231,217,193,255))
        d.ellipse((p(284,121),p(334,171)),fill=(182,77,49,245))
        for y in [360,380,402]: bezier([(90,y),(155,y-10),(225,y+5),(354,y-13)],rgba(gold,85),3)
    elif motif in ('teapot','coffee'):
        # detailed black ceramic tea / coffee, golden edges
        d.ellipse((p(149,193),p(303,337)),fill=(49,42,39,255),outline=rgba(gold),width=7*s)
        d.ellipse((p(173,217),p(278,291)),fill=(70,57,44,255))
        d.arc((p(287,208),p(365,308)),55,300,fill=rgba(gold),width=14*s)
        if motif=='teapot':
            d.ellipse((p(159,187),p(297,225)),fill=(53,40,32,255),outline=rgba(gold),width=5*s)
            ellipse(227,181,12,rgba(gold))
            polygon(d,[p(150,234),p(98,211),p(118,263),p(165,267)],(51,43,33,255),rgba(gold),4*s)
        else:
            d.ellipse((p(154,182),p(299,231)),fill=(117,62,36,255),outline=rgba(gold),width=5*s)
            for x in [189,216,253]:
                bezier([(x,163),(x-17,143),(x+11,115),(x,86)],rgba(gold),5)
            for x,y in [(164,364),(219,382),(278,366),(311,388)]:
                ellipse(x,y,14,(92,48,28,255),rgba(gold),2)
    elif motif=='coins':
        for x,y,r in [(182,244,62),(258,259,59),(220,332,56)]:
            ellipse(x,y,r,rgba(gold),rgba(ink),4)
            ellipse(x,y,r-11,rgba((108,61,42)),rgba((246,209,128)),3)
            d.rectangle((p(x-13,y-13),p(x+13,y+13)),fill=rgba(base),outline=rgba(gold),width=3*s)
    elif motif=='koi':
        d.ellipse((p(147,171),p(291,365)),fill=(207,136,90,255),outline=rgba(gold),width=4*s)
        polygon(d,[p(222,329),p(143,410),p(237,388),p(295,412),p(276,321)],rgba((181,73,55)),rgba(gold),4*s)
        ellipse(190,215,9,(40,33,28,255)); bezier([(237,215),(268,260),(221,314)],rgba((54,52,51)),7)
        for y in range(257,313,17): bezier([(158,y),(219,y+15),(272,y)],rgba(gold,180),2)
    elif motif=='crane':
        bezier([(188,372),(213,330),(228,260),(257,203),(293,170)],rgba(ink),13)
        polygon(d,[p(224,294),p(82,234),p(145,293),p(229,324)],rgba((211,192,161)),rgba(ink),3*s)
        polygon(d,[p(242,300),p(350,211),p(338,308),p(255,332)],rgba((223,208,180)),rgba(ink),3*s)
        ellipse(294,170,12,(183,50,39,255));line([(282,163),(306,163)],rgba(gold),3)
        line([(228,320),(218,392)],rgba(ink),4);line([(249,328),(265,389)],rgba(ink),4)
    elif motif=='lantern':
        ellipse(224,152,17,rgba(gold))
        d.rounded_rectangle((p(160,184),p(288,350)),radius=45*s,fill=rgba((165,50,38)),outline=rgba(gold),width=9*s)
        for x in (184,222,262): line([(x,185),(x,351)],rgba(gold,220),5)
        line([(158,216),(290,216)],rgba(gold),7);line([(160,322),(285,322)],rgba(gold),7)
        line([(223,355),(223,410)],rgba(gold),5)
    elif motif=='fan':
        polygon(d,[p(217,371),p(76,254),p(119,164),p(215,115),p(319,157),p(360,253)],rgba((208,177,136)),rgba(gold),4*s)
        for x,y in [(95,251),(130,173),(214,121),(305,172),(348,255)]:line([(217,371),(x,y)],rgba((118,66,41)),3)
        bezier([(99,246),(166,225),(238,209),(344,246)],rgba((184,66,57)),5)
    elif motif=='pagoda':
        for y,w in [(206,160),(281,124),(351,90)]:
            d.rectangle((p(225-w*.34,y),p(225+w*.34,y+53)),fill=rgba(ink),outline=rgba(gold),width=3*s)
            polygon(d,[p(225-w*.68,y+9),p(225,y-40),p(225+w*.68,y+9)],rgba((137,62,51)),rgba(gold),3*s)
        line([(225,149),(225,98)],rgba(gold),4)
    else:
        icon={'compass':'compass','diamond':'diamond','tree':'tree','key':'key','star':'star'}.get(motif,'star')
        font=ImageFont.truetype(FONT_FA,232*s)
        txt=FA[icon]
        bb=d.textbbox((0,0),txt,font=font)
        pos=(cx-(bb[0]+bb[2])//2,cy-(bb[1]+bb[3])//2)
        d.text((pos[0]+5*s,pos[1]+7*s),txt,font=font,fill=(18,10,6,170))
        d.text(pos,txt,font=font,fill=rgba(gold),stroke_width=2*s,stroke_fill=rgba(ink))
    return img.resize((W,H),Image.Resampling.LANCZOS)

def produce(t,idx,i):
    bg=source_background(t,idx*300+i)
    d=ImageDraw.Draw(bg,'RGBA');base,gold,secondary,ink,name=t
    # cloth-like porcelain texture; subtle hairline cracks and mineral inclusions
    rng=random.Random(idx*9137+i)
    for q in range(60):
        x,y=rng.randint(25,W-25),rng.randint(25,H-25)
        if rng.random()<.7: d.ellipse((x,y,x+1,y+2),fill=rgba(mix(base,ink,.35),int(rng.uniform(14,35))))
    # realistic layered rim and gilding
    d.rounded_rectangle((11,10,W-12,H-12),radius=46,outline=rgba(mix(base,gold,.65)),width=4)
    d.rounded_rectangle((23,23,W-23,H-23),radius=37,outline=rgba(gold,140),width=2)
    d.arc((18,17,W-18,H-18),188,310,fill=(255,252,226,130),width=5)
    d.arc((18,17,W-18,H-18),20,135,fill=(36,21,13,105),width=6)
    # finely etched corner ornaments like expensive lacquerware
    for x,dx in ((46,1),(W-46,-1)):
      for y,dy in ((51,1),(H-51,-1)):
        d.arc((x-11,y-11,x+11,y+11),0,320,fill=rgba(gold,150),width=2)
        d.line([(x,y+dy*10),(x,y+dy*28)],fill=rgba(gold,130),width=2)
        d.line([(x+dx*9,y),(x+dx*27,y)],fill=rgba(gold,130),width=2)
    # faint radial medallion to ground bas-relief, never dominating central art
    d.ellipse((54,110,W-54,H-97),outline=rgba(gold,60),width=2)
    art=motif_layer(MOTIFS[i],t,idx*90+i)
    shadow=art.getchannel('A').filter(ImageFilter.GaussianBlur(6))
    dark=Image.new('RGBA',(W,H),rgba((21,10,8),80));dark.putalpha(shadow.point(lambda x:round(x*.35)))
    bg.alpha_composite(dark,(3,6));bg.alpha_composite(art)
    d=ImageDraw.Draw(bg,'RGBA')
    # bottom maker's seal and tile numbering for legibility, not oversized
    d.ellipse((W//2-4,H-50,W//2+4,H-42),fill=rgba(gold,210))
    d.arc((W//2-24,H-65,W//2+24,H-28),20,160,fill=rgba(gold,100),width=2)
    return bg.convert('RGB')

sheet=Image.new('RGB',(6*166,4*214),(30,25,24))
for k,t in enumerate(THEMES):
  fold=DEST/f'finish_{k}'
  fold.mkdir(exist_ok=True)
  for i in range(24):
    im=produce(t,k,i)
    im.save(fold/f'{i:02d}.jpg',quality=91,subsampling=0,optimize=True)
    if k==0:
      sh=im.resize((148,194),Image.Resampling.LANCZOS)
      sheet.paste(sh,((i%6)*166+9,(i//6)*214+9))
sheet.save(str(ROOT/'premium_tiles_contact.jpg'),quality=91)
print('created',len(list(DEST.rglob('*.jpg'))),'texture images','bytes',sum(p.stat().st_size for p in DEST.rglob('*.jpg')))