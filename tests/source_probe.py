"""Read-only accessibility checks without a RuTracker account or torrents."""
import urllib.request, urllib.error, urllib.parse
agent={'User-Agent':'Mozilla/5.0 (Linux; Android 12; TV) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'}
checks=[('RuTracker home',urllib.request.Request('https://rutracker.org/',headers=agent)),('RuTracker search',urllib.request.Request('https://rutracker.org/forum/tracker.php',data=('nm='+urllib.parse.quote_plus('Sintel',encoding='cp1251')).encode(),headers={**agent,'Content-Type':'application/x-www-form-urlencoded; charset=windows-1251'}))]
for name,req in checks:
    try:
        with urllib.request.urlopen(req,timeout=20) as response:
            text=response.read(500000).decode('cp1251',errors='replace').lower()
            print(name,'HTTP',response.status,'login_form',('login-form-full' in text),'results_table',('tor-tbl' in text))
    except urllib.error.HTTPError as e: print(name,'HTTP',e.code)
    except Exception as e: print(name,'NETWORK_ERROR',type(e).__name__)
