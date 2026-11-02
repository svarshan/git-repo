"""Read-only availability check; does not add or download torrents."""
import json, urllib.request, urllib.error, urllib.parse
base='https://torapi.vercel.app'
endpoints=[('providers','/api/provider/list'),('RuTracker','/api/search/title/rutracker?query=Sintel&page=0&year=0'),('RuTor','/api/search/title/rutor?query=Sintel&page=0&year=0')]
for name,path in endpoints:
    try:
        req=urllib.request.Request(base+path,headers={'User-Agent':'MoOLVaKinoCheck/1.3','Accept':'application/json'})
        with urllib.request.urlopen(req,timeout=30) as r:
            obj=json.load(r); print(name,'HTTP',r.status,'type',type(obj).__name__,'items',len(obj) if hasattr(obj,'__len__') else 'n/a')
    except urllib.error.HTTPError as e: print(name,'HTTP',e.code)
    except Exception as e: print(name,'NETWORK_ERROR',type(e).__name__)
