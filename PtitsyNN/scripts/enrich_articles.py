#!/usr/bin/env python3
"""Retrieve accurate Wikipedia taxon articles independently of the media downloader.
Prioritize Russian Wikipedia, use the original English text for documented fallback.
Never invent species facts or imply an English article was translated.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import json, os, re, threading, time
import requests
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'app'/'data.js'
REPORT=ROOT/'data'/'coverage.json'
UA='MoOLVa Birds NN/2.3 (educational; github.com/svarshan/git-repo)'
TLS=threading.local()
STOP=float('inf')
LICENSE='https://creativecommons.org/licenses/by-sa/4.0/'
def session():
 if not hasattr(TLS,'s'):
  TLS.s=requests.Session()
  TLS.s.headers.update({'User-Agent':UA,'Accept':'application/json'})
 return TLS.s
def api(lang,params):
 args={'action':'query','format':'json','formatversion':'2',**params}
 for retry in range(2):
  if time.monotonic()>=STOP:return {}
  try:
   r=session().get(f'https://{lang}.wikipedia.org/w/api.php',params=args,timeout=(4,9))
   if r.status_code in (429,500,502,503,504):
    time.sleep(1+retry)
    continue
   r.raise_for_status()
   result=r.json()
   return result.get('query',{}) if 'error' not in result else {}
  except (requests.RequestException,ValueError):
   if retry==0:time.sleep(.4)
 return {}
def extract_text(raw):
 t=str(raw or '').replace('\r','')
 t=re.split(r'\n(?:Примечания|Литература|Ссылки|См\. также|References|External links|Further reading|See also)\n',t,maxsplit=1)[0]
 return re.sub(r'\n{3,}','\n\n',t).strip()[:22000]
def verify(p,lang,b):
 if p.get('missing') or not p.get('pageid') or 'disambiguation' in (p.get('pageprops') or {}):return None
 txt=extract_text(p.get('extract'))
 if len(txt)<180:return None
 latin=b['latin'].casefold()
 title=str(p.get('title','')).casefold()
 if latin not in txt[:2500].casefold() and title not in (latin,b['name'].casefold() if lang=='ru' else latin):return None
 return {'text':txt,'lang':lang,'title':p['title'],
         'url':f'https://{lang}.wikipedia.org/?curid={p["pageid"]}',
         'links':p.get('langlinks') or []}
def titles(lang,values,b):
 if not values or time.monotonic()>=STOP:return []
 q=api(lang,{'titles':'|'.join(dict.fromkeys(values)),'redirects':'1',
             'prop':'extracts|pageprops|langlinks','explaintext':'1',
             'lllang':'ru' if lang=='en' else 'en','lllimit':'1'})
 return [v for page in q.get('pages',[]) if (v:=verify(page,lang,b))]
def search(lang,b):
 if time.monotonic()>=STOP:return []
 q=api(lang,{'list':'search','srsearch':'"'+b['latin']+'"','srnamespace':'0',
             'srlimit':'6','srprop':''})
 return titles(lang,[x['title'] for x in q.get('search',[]) if x.get('title')],b)
def credit():
 return {'authors':'Участники Википедии','license':'CC BY-SA 4.0',
         'licenseUrl':LICENSE,'modified':'Текст статьи извлечён и сокращён'}
def fetch(b):
 old=str(b.get('description') or '')
 if (b.get('articleComplete') and len(old)>=450 and
     b.get('descriptionLanguage','ru')=='ru' and
     str(b.get('descriptionSource') or '').startswith('https://ru.wikipedia.org/')):
  b.update(descriptionLanguage='ru',descriptionStatus='full',descriptionAttribution=credit())
  return b
 ru=titles('ru',[b['name'],b['latin']],b)
 if not any(len(p['text'])>=450 for p in ru):ru+=search('ru',b)
 ru_best=max(ru,key=lambda p:len(p['text']),default=None)
 if ru_best and len(ru_best['text'])>=450:
  best=ru_best
 else:
  en=titles('en',[b['latin']],b)
  if not en:en=search('en',b)
  for page in en:
   for entry in page['links']:
    if entry.get('title') and time.monotonic()<STOP:
     ru+=titles('ru',[entry['title']],b)
  ru_best=max(ru,key=lambda p:len(p['text']),default=None)
  en_best=max(en,key=lambda p:len(p['text']),default=None)
  best=ru_best if ru_best and len(ru_best['text'])>=450 else \
      en_best if en_best and len(en_best['text'])>=450 else ru_best or en_best
 if best:
  b.update(description=best['text'],descriptionSource=best['url'],
           descriptionLanguage=best['lang'],descriptionTitle=best['title'],
           articleComplete=len(best['text'])>=450,
           descriptionStatus='full' if len(best['text'])>=450 else 'short',
           descriptionAttribution=credit())
 else:
  b.update(description=(f"{b['name']} ({b['latin']}) — вид из систематического "
    "перечня птиц Нижегородской области. Полная энциклопедическая статья, "
    "которую можно достоверно сопоставить с этим видом, в доступных разделах "
    "Википедии пока не обнаружена. Для определения необходимо сверять "
    "внешние признаки, поведение и голос с надёжными полевыми определителями."),
    descriptionSource=None,descriptionLanguage='ru',articleComplete=False,
    descriptionStatus='needs-source',descriptionAttribution=None)
 return b
def checkpoint(birds):
 DATA.write_text('window.BIRDS_DATA='+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
 r=json.loads(REPORT.read_text(encoding='utf8')) if REPORT.exists() else {}
 r.update(species=len(birds),articles=sum(bool(b.get('articleComplete')) for b in birds),
          russianArticles=sum(bool(b.get('articleComplete')) and b.get('descriptionLanguage','ru')=='ru' for b in birds),
          englishArticles=sum(bool(b.get('articleComplete')) and b.get('descriptionLanguage')=='en' for b in birds),
          shortArticles=sum(b.get('descriptionStatus')=='short' for b in birds),
          missingArticles=[b['latin'] for b in birds if not b.get('articleComplete')])
 REPORT.write_text(json.dumps(r,ensure_ascii=False,indent=2),encoding='utf8')
 return r
def main():
 global STOP
 raw=DATA.read_text(encoding='utf8').strip()
 if not raw.startswith('window.BIRDS_DATA='):raise ValueError('Bad catalog header')
 birds=json.loads(raw[len('window.BIRDS_DATA='):].rstrip(';'))
 if len(birds)!=298:raise ValueError('Expected 298 species')
 STOP=time.monotonic()+max(120,min(1800,int(os.getenv('BIRDS_WIKI_BUDGET_SECONDS','1200'))))
 ids=[i for i,b in enumerate(birds) if not (b.get('articleComplete') and
      len(b.get('description') or '')>=450 and b.get('descriptionLanguage','ru')=='ru')]
 for i,b in enumerate(birds):
  if i not in ids and not b.get('descriptionAttribution'):
   b.update(descriptionLanguage='ru',descriptionStatus='full',descriptionAttribution=credit())
 checkpoint(birds)
 print('WIKIPEDIA SEARCH',len(ids),'missing Russian articles',flush=True)
 for i in range(0,len(ids),12):
  if time.monotonic()>=STOP:break
  group=ids[i:i+12]
  with ThreadPoolExecutor(max_workers=6) as pool:
   futures={pool.submit(fetch,birds[j]):j for j in group}
   for job in as_completed(futures):
    j=futures[job]
    try:birds[j]=job.result()
    except Exception as exc:print('WIKI ERROR',birds[j]['latin'],str(exc)[:150],flush=True)
  stat=checkpoint(birds)
  print('WIKIPEDIA COVERAGE',i+len(group),'/',len(ids),'full',stat['articles'],
        'ru',stat['russianArticles'],'en',stat['englishArticles'],flush=True)
 for b in birds:
  if len(str(b.get('description') or ''))<140:
   b.update(description=(f"{b['name']} ({b['latin']}) — вид птиц, включённый "
    "в региональный систематический список Нижегородской области. "
    "Надёжная полная статья пока не найдена; описание вида без проверки "
    "не дополняется вымышленными признаками."),
    articleComplete=False,descriptionSource=None,
    descriptionLanguage='ru',descriptionStatus='needs-source',
    descriptionAttribution=None)
 result=checkpoint(birds)
 print('WIKIPEDIA FINAL',json.dumps({x:result[x] for x in
      ('species','articles','russianArticles','englishArticles','shortArticles')},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
