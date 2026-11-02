#!/usr/bin/env python3
"""Exercise the REST contract used by the Android client with a generated local torrent.
No third-party content is downloaded or searched. Does not test Android playback."""
import hashlib, http.server, json, os, socket, subprocess, tempfile, threading, time, urllib.error, urllib.request
from pathlib import Path

def bencode(v):
    if isinstance(v,int): return b'i'+str(v).encode()+b'e'
    if isinstance(v,str): v=v.encode()
    if isinstance(v,bytes): return str(len(v)).encode()+b':'+v
    if isinstance(v,list): return b'l'+b''.join(map(bencode,v))+b'e'
    if isinstance(v,dict): return b'd'+b''.join(bencode(k)+bencode(v[k]) for k in sorted(v))+b'e'
    raise TypeError(type(v))

def freeport():
    s=socket.socket();s.bind(('127.0.0.1',0));p=s.getsockname()[1];s.close();return p

def post(url, body):
    req=urllib.request.Request(url,json.dumps(body).encode(),{'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=20) as r: return json.load(r)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

with tempfile.TemporaryDirectory() as d:
    d=Path(d); content=b'test video bytes for local API test only'
    info={b'name':b'sample.mp4',b'length':len(content),b'piece length':16384,b'pieces':hashlib.sha1(content).digest()}
    (d/'sample.torrent').write_bytes(bencode({b'info':info}))
    handler=lambda *a,**kw: Quiet(*a,directory=str(d),**kw)
    httpd=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler);threading.Thread(target=httpd.serve_forever,daemon=True).start()
    port=freeport(); server=subprocess.Popen([os.environ['TORRSERVER_BIN'],'--port',str(port),'--ip','127.0.0.1','--path',str(d/'state')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    base='http://127.0.0.1:'+str(port)
    try:
        for _ in range(60):
            if server.poll() is not None: raise RuntimeError('TorrServer exited unexpectedly')
            try:
                result=post(base+'/torrents',{'action':'list'});break
            except (OSError,urllib.error.URLError): time.sleep(.5)
        else: raise RuntimeError('TorrServer startup timed out')
        assert isinstance(result,list), 'list should be an array'
        url='http://127.0.0.1:%d/sample.torrent'%httpd.server_port
        added=post(base+'/torrents',{'action':'add','link':url,'title':'MoOLVa test','save_to_db':True})
        hash_value=added.get('hash','');assert len(hash_value)==40, 'missing infohash'
        for _ in range(40):
            info=post(base+'/torrents',{'action':'get','hash':hash_value})
            if info.get('file_stats'): break
            time.sleep(.5)
        else: raise RuntimeError('metadata timed out')
        f=info['file_stats'][0]
        assert f.get('path','').endswith('sample.mp4'), 'unexpected filename'
        assert int(f.get('id',0))>=1, 'invalid file index'
        assert int(f.get('length',0))==len(content), 'unexpected file length'
        print('PASS: actual TorrServer list, add, metadata and file index')
    finally:
        httpd.shutdown();server.terminate()
        try: server.wait(timeout=5)
        except subprocess.TimeoutExpired: server.kill();server.wait()
