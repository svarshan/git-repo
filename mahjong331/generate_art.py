#!/usr/bin/env python3
"""Generate 24 ORIGINAL porcelain-face illustrations for MoOLVa 3.3.1.
All compositions are standalone motifs, not crops of the game-background screenshot.
Runs with Pillow+cairosvg; assets committed to Android Studio project.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path
import io, math, random, sys
import cairosvg
from xml.sax.saxutils import escape
ROOT=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/mnt/data/MoOLVaMahjong_Ultimate_3_3_1_PremiumTileRework')
OUT=ROOT/'app/src/main/assets/atelier'
OUT.mkdir(parents=True,exist_ok=True)
FONT='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
W,H=512,640

# Vector graphics are painted as SVG at higher resolution and then downsampled.
def path(d,fill='none',stroke='none',sw=1,opacity=1,extra=''):
 return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" opacity="{opacity}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'
def ell(x,y,rx,ry,fill,rot=0,stroke='none',sw=1):
 return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" transform="rotate({rot} {x} {y})"/>'
def circ(x,y,r,fill,stroke='none',sw=1):return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
def star(x,y,r,color='#d4ac55',n=8):
 ps=[]
 for i in range(n*2):
  a=math.pi*i/n-math.pi/2;z=r if i%2==0 else r*.42;ps.append(f'{x+z*math.cos(a):.1f},{y+z*math.sin(a):.1f}')
 return f'<polygon points="{" ".join(ps)}" fill="{color}"/>'

red='#b42e2e';dark='#254c36';gold='#c2923f';ink='#3b3329';pink='#d96c79';grey='#56686b'

def flower(x,y,s=1,pink=True):
 p='#e08a9b' if pink else '#d3b15d';n='#b64254' if pink else '#aa732e'
 out=''
 for a in range(0,360,72):
  dx=math.cos(math.radians(a))*14*s;dy=math.sin(math.radians(a))*14*s
  out+=ell(x+dx,y+dy,15*s,25*s,'url(#petal)' if pink else 'url(#gold)',a-90,stroke=n,sw=0.7*s)
 out+=circ(x,y,8*s,'#ffcb72',n,1.5*s)
 for a in range(0,360,60):
  out+=circ(x+math.cos(math.radians(a))*7*s,y+math.sin(math.radians(a))*7*s,2.3*s,'#9f6535')
 return out

def sakura(n=0):
 out=path('M110 474 C165 404 204 339 262 302 C315 266 318 213 365 176',stroke='#64452c',sw=17)
 out+=path('M137 429 Q207 425 254 455 M198 365 Q159 294 128 243 M277 290 Q361 313 406 274 M326 234 Q283 171 266 140',stroke='#835739',sw=9)
 rng=random.Random(n+111)
 for x,y,s in [(128,243,1.1),(172,325,.8),(264,141,.94),(345,187,1.0),(406,275,.97),(275,452,1),(220,360,.88),(300,290,.93)]:
  out+=flower(x+rng.randint(-4,4),y+rng.randint(-3,3),s)
 for x,y,a in [(178,378,-34),(320,275,26),(241,419,-12),(338,221,-34)]:
  out+=ell(x,y,17,37,'url(#leaf)',a,stroke='#71804a',sw=1)
 return out

def dragon():
 out=''
 # curling serpentine golden body, shadow then enamel interior
 d='M168 476 C108 413 131 349 202 323 C277 294 321 344 332 270 C344 209 240 197 249 142'
 out+=path(d,stroke='#794624',sw=59,opacity=.30)
 out+=path(d,stroke='#98621f',sw=50)
 out+=path(d,stroke='url(#gold)',sw=38)
 out+=path(d,stroke='#f6d884',sw=10)
 for x,y,ang in [(158,457,-15),(157,391,24),(203,324,55),(287,323,-25),(321,270,12),(290,217,-35)]:
  out+=ell(x,y,24,10,'#f8d47b',ang,stroke='#8e5c22',sw=2)
 # sharp spine and claws
 for d2 in ['M153 439 l-34 4 24-25','M142 392 l-31 -9 34 -13','M207 321 l-7 -42 28 31','M292 332 l20 -42 7 36','M321 264 l24 -20 -10 38']:
  out+=path(d2,fill='#b57b2f',stroke='#6c4822',sw=2)
 out+=ell(252,145,40,34,'url(#gold)',-24,stroke='#81511f',sw=6)
 out+=path('M223 134 L198 103 224 116 M252 113 l8 -34 12 42 M268 154 q47 -4 64 -24',stroke='#855623',sw=9)
 out+=path('M225 169 Q184 199 166 194 M237 177 Q203 214 218 223',stroke='#c39843',sw=4)
 out+=circ(262,139,5,'#501c15')+circ(264,138,1.5,'#ffed97')
 out+=path('M250 180 l-12 13 22 -5 14 8',stroke='#6e3d1b',sw=3)
 return out

def bamboo():
 o=''
 for x,y,ht in [(160,148,380),(260,110,420),(363,173,345)]:
  o+=path(f'M{x} {y+ht} L{x+4} {y}',stroke='#305e43',sw=24)
  o+=path(f'M{x-5} {y+ht} L{x-1} {y}',stroke='#9abd69',sw=10)
  for dy in range(70,ht,100):
   o+=path(f'M{x-14} {y+dy} l26 -1',stroke='#755b32',sw=8)
  for dy,sd in [(90,-1),(180,1),(260,-1)]:
   o+=path(f'M{x+2} {y+dy} q{sd*40} -31 {sd*105} -40',stroke='#456947',sw=4)
   o+=ell(x+sd*74,y+dy-33,50,12,'url(#leaf)',-sd*17)
   o+=ell(x+sd*53,y+dy-60,47,11,'url(#leaf)',sd*17)
 return o

def crane():
 o=path('M184 476 Q204 412 204 368 M250 486 Q229 436 242 355',stroke='#715b42',sw=7)
 o+=ell(233,325,100,66,'#f9f4e4',-17,stroke='#aaa7a0',sw=2)
 o+=path('M229 315 Q166 241 104 226 Q132 320 210 372 Z',fill='#f9f6e9',stroke='#8f938f',sw=3)
 for i in range(7):
  o+=path(f'M{131+i*11} {251+i*6} Q{167+i*5} {313+i*2} {215+i*3} 353',stroke='#74817f',sw=1.6)
 o+=path('M290 324 Q351 300 319 232 Q297 190 340 162',stroke='#f8f5e8',sw=24)
 o+=circ(342,156,21,'#fdf8e7',stroke='#717471',sw=2)
 o+=path('M361 151 l64 7 -64 11Z',fill='#b15a33')
 o+=path('M334 151 l17 6',stroke=red,sw=7)+circ(351,157,3,'#1c3031')
 o+=ell(289,344,63,22,'#515e61',-20)
 return o

def lotus():
 o=''
 for a in range(0,360,24):
  rad=math.radians(a);x=256+math.cos(rad)*76;y=336+math.sin(rad)*55
  o+=ell(x,y,27,92,'url(#petal)',a+90,stroke='#bd677b',sw=2)
 for a in range(0,360,36):
  rad=math.radians(a);x=256+math.cos(rad)*43;y=332+math.sin(rad)*31
  o+=ell(x,y,25,62,'url(#petal)',a+90,stroke='#ab5463',sw=1.4)
 o+=ell(256,326,34,26,'#ffda79',stroke='#9a6b34',sw=4)
 for a in range(0,360,50):o+=circ(256+math.cos(math.radians(a))*21,326+math.sin(math.radians(a))*17,4,'#bf8a29')
 o+=path('M148 470 Q250 514 369 467 M200 502 Q280 524 349 493',stroke='#78958c',sw=5)
 return o

def pagoda():
 o=path('M148 490 H385 V470 H148 Z',fill='#866037')
 for y,w in [(435,236),(345,186),(260,135)]:
  x=256
  o+=f'<rect x="{x-w*.38:.1f}" y="{y-70}" width="{w*.76:.1f}" height="70" fill="#90633b" stroke="#5d3f2b" stroke-width="5"/>'
  for dx in [-w*.20,0,w*.20]:o+=path(f'M{x+dx:.1f} {y-67}V{y-4}',stroke='#dcc18a',sw=8)
  o+=path(f'M{x-w*.60:.1f} {y-72} Q{x-w*.35:.1f} {y-100} {x} {y-96} Q{x+w*.35:.1f} {y-100} {x+w*.60:.1f} {y-72} Q{x} {y-92} {x-w*.60:.1f} {y-72}',fill='#31524e',stroke='#bb9a55',sw=7)
 o+=path('M256 163 V116',stroke=gold,sw=5)+star(256,109,13)
 return o

def coin():
 o=''
 for x,y,r in [(200,265,78),(306,340,81),(204,436,74)]:
  o+=circ(x+3,y+5,r,'#705128')+circ(x,y,r,'url(#gold)',stroke='#855527',sw=6)
  o+=circ(x,y,r-18,'none',stroke='#ffe6a3',sw=7)
  o+=f'<rect x="{x-19}" y="{y-19}" width="38" height="38" rx="4" fill="#754b28" stroke="#ffe2a0" stroke-width="7"/>'
  for a in range(0,360,45):
   xx=x+math.cos(math.radians(a))*(r-11);yy=y+math.sin(math.radians(a))*(r-11)
   o+=circ(xx,yy,3,'#8c5d26')
 return o

def ginkgo():
 o=''
 for x,y,ang,scale in [(224,280,-20,1),(322,351,24,.8),(173,402,-52,.84)]:
  o+=path(f'M{x} {y+125*scale} Q{x+20} {y+70*scale} {x} {y+15*scale}',stroke='#806c3c',sw=5)
  o+=path(f'M{x} {y+8*scale} Q{x-93*scale} {y-20*scale} {x-93*scale} {y-90*scale} Q{x-17*scale} {y-153*scale} {x+93*scale} {y-90*scale} Q{x+91*scale} {y-6*scale} {x} {y+8*scale}',fill='url(#gold)',stroke='#a36d27',sw=3)
  for j in range(-4,5):
   a=j*.17;tx=x+math.sin(a)*87*scale;ty=y-95*scale+abs(j)*5
   o+=path(f'M{x} {y+8*scale} Q{x+j*14} {y-35*scale} {tx} {ty}',stroke='#bb873b',sw=2)
 return o

def koi():
 o=path('M136 411 C144 347 211 292 296 261 C362 246 389 290 346 349 C305 398 219 428 166 470 Z',fill='url(#warm)',stroke='#904a2e',sw=5)
 o+=path('M324 291 Q412 205 433 259 Q409 331 345 335',fill='#d99c58',stroke='#894e2a',sw=4)
 o+=path('M213 344 Q169 262 246 271 M270 371 Q300 461 350 420',fill='#bd6037',stroke='#963f2a',sw=2)
 for ix in range(6):
  for iy in range(4):
   x=194+ix*23;y=338+iy*23-ix*9
   o+=path(f'M{x} {y} q11 -10 21 0',stroke='#ffe3ae',sw=2)
 o+=circ(169,396,5,'#3e2f29')
 for i in range(4):
  y=425+i*27
  o+=path(f'M94 {y} Q255 {y-80} 418 {y-33}',stroke='#779aa2',sw=4,opacity=.65)
 return o

def mountain():
 o=circ(360,187,53,'#c85239')
 o+=path('M78 461 L172 239 263 379 309 275 444 465 Z',fill='#6b7b6c')
 o+=path('M168 253 L131 340 171 317 193 351 199 321 219 358 255 372 Z',fill='#e6e7da')
 o+=path('M311 283 l-37 86 44-26 26 29 25-14 Z',fill='#e7ddd0')
 o+=path('M93 479 Q210 445 450 484',stroke='#8a9b83',sw=6)
 for i in range(4):o+=path(f'M{95+i*63} {488+i*10} q70 -12 145 -3',stroke='#9aaea2',sw=2)
 return o

def bonsai():
 o=path('M193 485 H338 L318 523 H218 Z',fill='#946342',stroke='#553a29',sw=6)
 o+=path('M256 481 Q283 407 236 375 Q169 326 227 268 Q269 218 247 181',stroke='#765237',sw=20)
 o+=path('M242 349 Q318 322 350 250 M222 309 Q164 271 140 233',stroke='#654a37',sw=10)
 for x,y,s in [(229,191,1),(141,226,1.1),(340,246,1.05),(256,287,.85),(198,333,.71)]:
  for dx,dy in [(-36,8),(-15,-20),(15,-17),(38,5),(0,21)]:o+=ell(x+dx*s,y+dy*s,32*s,19*s,'url(#leaf)',rot=(dx/2),stroke='#516340',sw=1)
 return o

def lantern():
 o=path('M256 169 V119',stroke=gold,sw=9)+ell(256,172,37,16,'url(#gold)')
 o+=path('M176 206 Q256 168 334 206 L323 394 Q256 439 188 394 Z',fill='url(#warm)',stroke='#9c5937',sw=7)
 for x in [194,225,256,287,319]:o+=path(f'M{x} 200 Q{x-13} 295 {x} 405',stroke='#c78b53',sw=6)
 o+=ell(256,403,84,16,'url(#gold)',stroke='#95632d',sw=4)
 o+=path('M255 414 V467',stroke='#a75e3f',sw=14)
 for x in range(228,285,11):o+=path(f'M{x} 462 V493',stroke='#c47c37',sw=3)
 return o

def fan():
 o=path('M150 448 Q121 287 173 214 Q257 182 344 214 Q403 322 355 448 L257 506 Z',fill='#f2dcb7',stroke='#906337',sw=7)
 for i in range(-5,6):
  x=257+i*23
  o+=path(f'M257 502 Q{245+i*21} 323 {x} 215',stroke='#b99563',sw=3)
 o+=path('M150 448 Q250 400 355 448',stroke='#b95d60',sw=11)
 for x,y in [(200,350),(266,307),(320,370)]:o+=flower(x,y,.45)
 return o

def moon():
 o=circ(253,308,139,'#d9d6cb')
 o+=circ(308,268,136,'#f7ecda') # cut crescent in ivory color, subtle texture later
 for x,y,r in [(192,334,10),(232,367,15),(215,260,6)]:o+=circ(x,y,r,'#b5b6b4')
 for x,y,r in [(380,204,16),(140,217,14),(351,420,11)]:o+=star(x,y,r)
 o+=path('M154 480 Q245 441 389 481',stroke='#8fa6b5',sw=5)
 return o

def cloud():
 o=''
 for x,y,s in [(215,210,1.15),(270,336,1.2),(165,433,.91)]:
  o+=path(f'M{x-100*s} {y+30*s} Q{x-88*s} {y+12*s} {x-61*s} {y+21*s} C{x-78*s} {y-43*s} {x+12*s} {y-59*s} {x+20*s} {y-19*s} Q{x+85*s} {y-41*s} {x+90*s} {y+15*s} Q{x+109*s} {y+32*s} {x+64*s} {y+43*s}',fill='none',stroke='#c09550',sw=14*s)
 return o

def phoenix():
 o=ell(250,294,59,90,'url(#warm)',-5,stroke='#be732f',sw=4)
 for ang in [-70,-43,-22,0,22,43,70]:
  o+=ell(255+ang*.75,328,24,114,'url(#gold)',ang,stroke='#a87d3d',sw=2)
 o+=path('M250 245 Q245 166 279 156',stroke='#8b552c',sw=16)
 o+=circ(281,155,24,'url(#gold)')+path('M305 156 l39 14 -36 16',fill='#b34e38')
 o+=circ(289,150,4,'#47301a')
 o+=path('M270 135 l10 -39 12 41 M285 139 l30 -26 -14 37',stroke='#a86e31',sw=7)
 return o

def teacup():
 o=ell(245,276,127,29,'#f6e7cb',stroke='#ae834a',sw=7)
 o+=path('M130 276 Q137 432 245 436 Q359 430 361 276 Z',fill='#f2e0c0',stroke='#ad7e49',sw=6)
 o+=path('M362 312 Q433 299 420 352 Q410 403 358 391',stroke='#ae824d',sw=21)
 o+=ell(245,274,109,16,'#75543f')
 o+=ell(245,270,98,11,'#b96d36')
 for x in [200,246,290]:o+=path(f'M{x} 238 Q{x-20} 204 {x+7} 176 Q{x+28} 146 {x+5} 118',stroke='#b7a9a0',sw=7,opacity=.65)
 o+=flower(241,364,.75)
 return o

def butterfly():
 o=''
 for x,y,ang,s in [(250,285,0,1.5),(175,418,-26,.81),(359,410,25,.7)]:
  o+=ell(x-39*s,y-28*s,47*s,68*s,'url(#petal)',-24+ang,stroke='#8d596d',sw=2)
  o+=ell(x+39*s,y-28*s,47*s,68*s,'url(#petal)',24+ang,stroke='#8d596d',sw=2)
  o+=ell(x-35*s,y+40*s,44*s,45*s,'url(#gold)',-20+ang,stroke='#a47a3d',sw=2)
  o+=ell(x+35*s,y+40*s,44*s,45*s,'url(#gold)',20+ang,stroke='#a47a3d',sw=2)
  o+=ell(x,y,12*s,70*s,'#63452f')
  o+=path(f'M{x-2} {y-58*s} q{-27*s} {-34*s} {-43*s} {-24*s} M{x+2} {y-58*s} q{27*s} {-34*s} {43*s} {-24*s}',stroke='#58442e',sw=3)
 return o

def tiger():
 o=ell(256,321,129,124,'#d29856',stroke='#7d553b',sw=6)
 for x,ang in [(154,-36),(358,36)]:o+=ell(x,202,46,65,'#b9763a',ang,stroke='#7b512a',sw=6)
 o+=ell(256,369,82,58,'#f2dfb7')
 for x in [195,315]:o+=ell(x,312,17,23,'#302c23')
 o+=path('M256 329 L234 358 276 358 Z',fill='#4a322b')
 for x in [193,315]:
  for i in range(3):o+=path(f'M{x+(i-1)*8} 238 q{(i-1)*8} 24 0 49',stroke='#754227',sw=7)
 o+=path('M154 368 l-54 -13 M161 388 l-62 12 M358 368 l54 -13 M351 388 l62 12',stroke='#7b643d',sw=3)
 return o

styles=[sakura,dragon,bamboo,crane,lotus,pagoda,coin,ginkgo,koi,mountain,bonsai,lantern,fan,moon,cloud,phoenix,teacup,butterfly,tiger]
chinese=['東','中','發','萬','福']

def svg_scene(idx):
 if idx<len(styles): artwork=styles[idx]()
 else:
  artwork=f'<text x="256" y="423" text-anchor="middle" font-family="Noto Sans CJK SC, Noto Serif CJK SC" font-size="272" font-weight="800" fill="url(#ink)" stroke="#b38a55" stroke-width="2">{chinese[idx-len(styles)]}</text>'
 # fine inner golden frame with high-contrast detail
 return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 640" width="512" height="640"><defs>
 <linearGradient id="gold" x2=".90" y2="1"><stop stop-color="#fff2bc"/><stop offset=".25" stop-color="#dbaa59"/><stop offset=".59" stop-color="#9b6429"/><stop offset=".83" stop-color="#e8c580"/><stop offset="1" stop-color="#fff0c8"/></linearGradient>
 <linearGradient id="petal" x2=".5" y2="1"><stop stop-color="#fff0e8"/><stop offset=".4" stop-color="#e4969d"/><stop offset="1" stop-color="#ac435d"/></linearGradient>
 <linearGradient id="leaf" x2=".9" y2="1"><stop stop-color="#c6d48c"/><stop offset=".55" stop-color="#62875f"/><stop offset="1" stop-color="#244d39"/></linearGradient>
 <linearGradient id="warm" x2="1" y2="1"><stop stop-color="#ffdf90"/><stop offset=".55" stop-color="#d08a46"/><stop offset="1" stop-color="#a74b34"/></linearGradient>
 <linearGradient id="ink" x2=".9" y2="1"><stop stop-color="#183b2c"/><stop offset="1" stop-color="#496b46"/></linearGradient></defs>
 <rect x="0" y="0" width="512" height="640" fill="#f9efdb"/>
 <rect x="14" y="14" width="484" height="612" rx="43" fill="none" stroke="#c99f5f" stroke-width="6"/>
 <rect x="28" y="28" width="456" height="584" rx="35" fill="none" stroke="#fff9e9" stroke-width="4"/>
 <rect x="39" y="39" width="434" height="562" rx="31" fill="none" stroke="#dfb474" stroke-width="2"/>
 <path d="M46 130 V69 Q46 46 70 46 H129 M383 46 H442 Q466 46 466 70 V135 M46 509 V573 Q46 595 72 595 H125 M387 595 H440 Q465 595 465 571 V509" fill="none" stroke="#b08343" stroke-width="7" stroke-linecap="round"/>
 <path d="M78 62 q42 7 51 45 M435 62 q-42 7 -51 45 M77 578 q42 -7 51 -45 M435 578 q-42 -7 -51 -45" fill="none" stroke="#d6af6e" stroke-width="3"/>
 <g>{artwork}</g>
 <circle cx="60" cy="60" r="5" fill="#c49b60"/><circle cx="452" cy="60" r="5" fill="#c49b60"/>
 <circle cx="60" cy="580" r="5" fill="#c49b60"/><circle cx="452" cy="580" r="5" fill="#c49b60"/>
 </svg>'''

def produce(idx):
 raw=cairosvg.svg2png(bytestring=svg_scene(idx).encode(),output_width=W*2,output_height=H*2)
 img=Image.open(io.BytesIO(raw)).convert('RGB').resize((W,H),Image.Resampling.LANCZOS)
 import numpy as np
 a=np.array(img,dtype=np.int16)
 rng=np.random.default_rng(seed=idx+1129)
 n=rng.normal(0,1.45,(H,W,1))
 gradient=np.linspace(0,-6,H).reshape(-1,1,1)
 a=np.uint8(np.clip(a+n+gradient,0,255))
 img=Image.fromarray(a)
 img.save(OUT/f'{idx:02d}.jpg',quality=96,subsampling=0,optimize=True)
 return img

def main():
 images=[produce(i) for i in range(24)]
 sheet=Image.new('RGB',(6*156,4*210),'#17110b')
 for i,img in enumerate(images):sheet.paste(img.resize((144,180)),(i%6*156+6,i//6*210+8))
 sheet.save('/mnt/data/MoOLVa_3.3.1_Atelier_Art_Contact.jpg',quality=92)
 print('Generated original tile motifs:',len(images),'at',OUT)
if __name__=='__main__':main()