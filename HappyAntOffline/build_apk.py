"""Experimental XAPK split-to-single APK merger, local offline test only.
Not an official build. Re-signs with temporary locally generated certificate.
"""
import os,io,struct,zipfile,hashlib,datetime,sys
from cryptography.hazmat.primitives.asymmetric import rsa,padding
from cryptography.hazmat.primitives import hashes,serialization
from cryptography.x509.oid import NameOID
from cryptography import x509
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
XAPK=sys.argv[1]
OUT=sys.argv[2]
u32=lambda x:struct.pack('<I',x)
u64=lambda x:struct.pack('<Q',x)
def p32(buf,off):return struct.unpack_from('<I',buf,off)[0]
def edit_manifest(original):
 b=bytearray(original); p=8; pool=[]
 def s(idx):return pool[idx][0] if idx<len(pool) and idx>=0 else ''
 while p<len(b):
  t,h,length=struct.unpack_from('<HHI',b,p)
  if length<8:break
  if t==1:
   count,stylecount,flags,start=struct.unpack_from('<IIII',b,p+8)
   assert not flags&0x100,'Expect UTF16 XML strings'
   for i in range(count):
    off=p+start+p32(b,p+28+4*i); n=struct.unpack_from('<H',b,off)[0]
    assert n<0x8000
    pool.append((bytes(b[off+2:off+2+2*n]).decode('utf-16le'),off+2,n))
  elif t==0x102:
   node=s(p32(b,p+20)); count=struct.unpack_from('<H',b,p+28)[0]
   attribs={}
   for j in range(count):
    o=p+36+20*j;attribs[s(p32(b,o+4))]=o
   if node=='manifest' and 'requiredSplitTypes' in attribs:
    empty=next((i for i,(string,_,_) in enumerate(pool) if string==''),None)
    if empty is not None:
     a=attribs['requiredSplitTypes'];struct.pack_into('<I',b,a+8,empty);struct.pack_into('<I',b,a+16,empty)
   if node=='application' and 'extractNativeLibs' in attribs:
    struct.pack_into('<I',b,attribs['extractNativeLibs']+16,0xffffffff)
   if node=='meta-data' and 'name' in attribs and 'value' in attribs:
    a=attribs['name'];raw=p32(b,a+8); v=p32(b,a+16)
    meta=s(raw if raw!=0xffffffff else v)
    if meta=='com.android.vending.splits.required':
     struct.pack_into('<I',b,attribs['value']+16,0)
  p+=length
 # replace requested dangerous normal permission exactly same UTF16 length
 for idx,(txt,off,num) in enumerate(pool):
  if txt=='android.permission.INTERNET':
   new='android.permission.INTERNEX'
   assert len(new)==num
   b[off:off+2*num]=new.encode('utf-16le')
 return bytes(b)

def encblob(data):return u32(len(data))+data
def digested_sections(f, data_end, cd_begin, end_cd):
 # APK V2 spec chunks
 h=[]
 def eat(stream,total):
  while total>0:
   c=stream.read(min(1024*1024,total));assert c
   h.append(hashlib.sha256(b'\xa5'+u32(len(c))+c).digest());total-=len(c)
 f.seek(0);eat(f,data_end)
 f.seek(cd_begin);eat(f,end_cd-cd_begin)
 f.seek(end_cd);eo=bytearray(f.read());assert eo[:4]==b'PK\x05\x06'
 struct.pack_into('<I',eo,16,data_end)
 eat(io.BytesIO(eo),len(eo))
 return hashlib.sha256(b'\x5a'+u32(len(h))+b''.join(h)).digest()

print('Reading XAPK')
with zipfile.ZipFile(XAPK) as za:
 base=zipfile.ZipFile(io.BytesIO(za.read('flow.color.puzzle.colony.marble.pixel.loop.jigsaw.apk')))
 arm=zipfile.ZipFile(io.BytesIO(za.read('config.arm64_v8a.apk')))
 pack=zipfile.ZipFile(io.BytesIO(za.read('asset_pack1.apk')))
 manifest=edit_manifest(base.read('AndroidManifest.xml'))
 print('Combining',len(base.namelist()),len(arm.namelist()),len(pack.namelist()),'entries')
 with zipfile.ZipFile(OUT,'w',allowZip64=False) as dest:
  written=set()
  for src in (base,arm,pack):
   for info in src.infolist():
    name=info.filename
    if name in written or name.endswith('/') or name.startswith('META-INF/') or name.startswith('META-INF\\'):
     continue
    if name in ('AndroidManifest.xml','resources.arsc') and src is not base:continue
    if name.startswith('res/') and src is not base:continue
    if name.endswith('.RSA') or name.endswith('.SF'):continue
    data=manifest if name=='AndroidManifest.xml' else src.read(name)
    zi=zipfile.ZipInfo(filename=name,date_time=info.date_time)
    zi.external_attr=info.external_attr
    zi.compress_type=zipfile.ZIP_STORED if name.endswith('.so') or name.endswith('.arsc') else info.compress_type
    if name.endswith('.so'):
     # ensure data offset is 16KB-aligned; required for uncompressed .so on modern devices
     stream=dest.fp
     if stream:
      start=stream.tell();pad=(-(start+30+len(name.encode('utf8'))+4))%16384
      zi.extra=struct.pack('<HH',0xd935,pad)+b'\0'*pad
    dest.writestr(zi,data,compresslevel=6)
    written.add(name)
 print('Generated zip',os.path.getsize(OUT), 'bytes')

 # signing block
 priv=rsa.generate_private_key(public_exponent=65537,key_size=3072)
 subj=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Local Test Build - Not Official')])
 cert=x509.CertificateBuilder().subject_name(subj).issuer_name(subj).public_key(priv.public_key()).serial_number(x509.random_serial_number()).not_valid_before(datetime.datetime(2025,1,1,tzinfo=datetime.timezone.utc)).not_valid_after(datetime.datetime(2045,1,1,tzinfo=datetime.timezone.utc)).sign(priv,hashes.SHA256()).public_bytes(Encoding.DER)
 with open(OUT,'r+b') as f:
  f.seek(0,2);eof=f.tell(); f.seek(eof-22);eocd=f.read(22)
  assert eocd[:4]==b'PK\x05\x06' and struct.unpack_from('<H',eocd,20)[0]==0
  cd=p32(eocd,16)
  digest=digested_sections(f,cd,cd,eof-22)
  algorithm=0x0103
  digests=encblob(encblob(u32(algorithm)+encblob(digest)))
  certs=encblob(encblob(cert))
  attrs=encblob(b'')
  signed_data=digests+certs+attrs
  signature=priv.sign(signed_data,padding.PKCS1v15(),hashes.SHA256())
  signatures=encblob(encblob(u32(algorithm)+encblob(signature)))
  pub=priv.public_key().public_bytes(Encoding.DER,PublicFormat.SubjectPublicKeyInfo)
  signer=encblob(signed_data)+signatures+encblob(pub)
  signers=encblob(encblob(signer))
  pair=u64(4+len(signers))+u32(0x7109871a)+signers
  block=u64(24+len(pair))+pair+u64(24+len(pair))+b'APK Sig Block 42'
  f.seek(cd);tail=f.read()
  f.seek(cd);f.write(block);f.write(tail)
  f.seek(cd+len(block)+len(tail)-22+16);f.write(u32(cd+len(block)))
  f.truncate(eof+len(block))
 print('Wrote signed apk',os.path.getsize(OUT), 'bytes, cert SHA256=',hashlib.sha256(cert).hexdigest())

 # Verify integrity of zip layout / v2 block signature and content digest
 with zipfile.ZipFile(OUT) as check:
  if check.testzip():raise ValueError('Corrupt zip entry')
  print('ZIP entries',len(check.namelist()),'testzip OK')
 with open(OUT,'rb') as f:
  f.seek(-22,2);e=f.read(22);post=p32(e,16)
  f.seek(post-24);size=struct.unpack('<Q',f.read(8))[0];magic=f.read(16)
  assert magic==b'APK Sig Block 42'
  sig_start=post-size-8
  recomputed=digested_sections(f,sig_start,post,post+struct.unpack_from('<I',e,12)[0])
  assert recomputed==digest, 'V2 digest changed'
  priv.public_key().verify(signature,signed_data,padding.PKCS1v15(),hashes.SHA256())
  print('APK Signature V2 digest and signature VERIFIED')