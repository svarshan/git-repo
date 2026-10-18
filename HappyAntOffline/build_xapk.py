#!/usr/bin/env python3
"""Experimental XAPK repack: remove INTERNET grant and modify local booster counters.
Does not assert runtime compatibility, server emulation, or support for purchases.
"""
import sys, io, os, json, zipfile, struct, hashlib, datetime
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from cryptography.x509.oid import NameOID

PACKAGENAME = 'flow.color.puzzle.colony.marble.pixel.loop.jigsaw.apk'
INFILE = sys.argv[1] if len(sys.argv)>1 else '/mnt/data/Your+Happy+Ant_1.21.0_APKPure.xapk'
OUTFILE = sys.argv[2] if len(sys.argv)>2 else '/mnt/data/Your_Happy_Ant_1.21.0_LOCAL_HELP_TEST.xapk'

u32=lambda x:struct.pack('<I',x)
u64=lambda x:struct.pack('<Q',x)
p32=lambda b,o:struct.unpack_from('<I',b,o)[0]
def encblob(b):return u32(len(b))+b

def no_internet_manifest(original):
    b=bytearray(original); p=8; strings=[]
    while p<len(b):
        t,h,length=struct.unpack_from('<HHI',b,p)
        if length<8:raise ValueError('bad XML chunk')
        if t==1:
            count,stylecount,flags,start=struct.unpack_from('<IIII',b,p+8)
            if flags&0x100:raise ValueError('Unexpected UTF8 XML string pool')
            for i in range(count):
                off=p+start+p32(b,p+28+4*i)
                n=struct.unpack_from('<H',b,off)[0]
                if n>=0x8000:raise ValueError('Unexpected multibyte string len')
                strings.append((bytes(b[off+2:off+2+2*n]).decode('utf-16le'),off+2,n))
        p+=length
    replaced=0
    for txt,off,n in strings:
        if txt=='android.permission.INTERNET':
            replacement='android.permission.INTERNEX'
            if len(replacement)!=n:raise ValueError('Not same length')
            b[off:off+2*n]=replacement.encode('utf-16le'); replaced+=1
    if replaced!=1:raise ValueError(f'Expected exactly one Internet permission, found {replaced}')
    return bytes(b)

def modify_game_native(data):
    out=bytearray(data)
    # These addresses are validated with the exact binary from XAPK v1.21.0.
    # On AArch64: mov w0, #9999; ret; or mov w0,#1; ret
    defs=[(0x28eafec,bytes.fromhex('fd7bbca9'),9999, 'm8_data_props::getCount'),
          (0x28eb0b4,bytes.fromhex('fd7bbca9'),9999,'m8_data_props::getCount thunk'),
          (0x28ebad4,bytes.fromhex('fd7bbea9'),1,'m8_data_props::canUseProp'),
          (0x28ebb2c,bytes.fromhex('fd7bbea9'),1,'m8_data_props::canUseProp thunk')]
    for off, expected, imm,name in defs:
        if out[off:off+4]!=expected:raise ValueError(f'Wrong native version at {off:#x}: {name}')
        inst=(0x52800000 | (imm<<5)).to_bytes(4,'little')
        out[off:off+8]=inst+bytes.fromhex('c0035fd6')
        print('  Native patch:',name,'value=',imm,'at',hex(off))
    if len(out)!=len(data):raise AssertionError('lib size changed')
    return bytes(out)

def v2_digest(f, data_end, cd_begin, eocd_offset):
    hashes_list=[]
    def section(data_total):
        while data_total>0:
            chunk=f.read(min(1024*1024,data_total)); assert chunk
            hashes_list.append(hashlib.sha256(b'\xa5'+u32(len(chunk))+chunk).digest())
            data_total-=len(chunk)
    f.seek(0);section(data_end)
    f.seek(cd_begin);section(eocd_offset-cd_begin)
    f.seek(eocd_offset);tail=bytearray(f.read())
    assert tail[:4]==b'PK\x05\x06'
    struct.pack_into('<I',tail,16,data_end)
    import io
    f=io.BytesIO(tail)
    section(len(tail))
    return hashlib.sha256(b'\x5a'+u32(len(hashes_list))+b''.join(hashes_list)).digest()

def sign_apk(path,key,cert):
    with open(path,'r+b') as f:
        f.seek(0,2);eof=f.tell(); f.seek(eof-22);eocd=f.read(22)
        assert eocd[:4]==b'PK\x05\x06' and struct.unpack_from('<H',eocd,20)[0]==0
        central_start=p32(eocd,16)
        digest=v2_digest(f,central_start,central_start,eof-22)
        alg=0x0103
        signed_data=encblob(encblob(u32(alg)+encblob(digest)))+encblob(encblob(cert))+encblob(b'')
        signature=key.sign(signed_data,padding.PKCS1v15(),hashes.SHA256())
        pub=key.public_key().public_bytes(Encoding.DER,PublicFormat.SubjectPublicKeyInfo)
        signer=encblob(signed_data)+encblob(encblob(u32(alg)+encblob(signature)))+encblob(pub)
        pairs=u64(4+len(encblob(encblob(signer))))+u32(0x7109871a)+encblob(encblob(signer))
        block=u64(24+len(pairs))+pairs+u64(24+len(pairs))+b'APK Sig Block 42'
        f.seek(central_start);tail=f.read()
        f.seek(central_start);f.write(block);f.write(tail)
        f.seek(central_start+len(block)+len(tail)-22+16);f.write(u32(central_start+len(block)))
        f.truncate(eof+len(block))
        # Internal digest / signature verification (not Android installation)
        f.seek(-22,2);e=f.read(22);post=p32(e,16)
        f.seek(post-24);size=struct.unpack('<Q',f.read(8))[0];magic=f.read(16)
        assert magic==b'APK Sig Block 42'
        sig_start=post-size-8
        cd_size=p32(e,12)
        assert digest==v2_digest(f,sig_start,post,post+cd_size)
        key.public_key().verify(signature,signed_data,padding.PKCS1v15(),hashes.SHA256())

def build_split(src,name,key,cert):
    # Individual split APKs must all be signed by the same certificate.
    tmp=OUTFILE+'.'+name+'.tmp'
    with zipfile.ZipFile(io.BytesIO(src)) as old,zipfile.ZipFile(tmp,'w',allowZip64=False) as out:
        for info in old.infolist():
            n=info.filename
            upper=n.upper()
            if n in ('stamp-cert-sha256',):continue
            if upper.startswith('META-INF/') and upper.rsplit('/',1)[-1].endswith(('.RSA','.DSA','.EC','.SF')):continue
            if upper=='META-INF/MANIFEST.MF':continue
            data=old.read(n)
            if name==PACKAGENAME and n=='AndroidManifest.xml':
                data=no_internet_manifest(data)
            elif name=='config.arm64_v8a.apk' and n=='lib/arm64-v8a/libMyGame.so':
                data=modify_game_native(data)
            ni=zipfile.ZipInfo(n,date_time=info.date_time)
            ni.compress_type=info.compress_type
            ni.external_attr=info.external_attr
            ni.create_system=info.create_system
            ni.flag_bits=info.flag_bits &~ 0x8
            if n.endswith('.so') and ni.compress_type==zipfile.ZIP_STORED:
                # Four-byte Android legacy minimum + 16KB page alignment.
                at=out.fp.tell(); nb=len(n.encode('utf-8'))
                padding_bytes=(-(at+30+nb+4)) % 16384
                ni.extra=struct.pack('<HH',0xD935,padding_bytes)+b'\0'*padding_bytes
            out.writestr(ni,data,compresslevel=6)
    sign_apk(tmp,key,cert)
    with zipfile.ZipFile(tmp) as verify:
        bad=verify.testzip()
        if bad:raise ValueError(f'Bad ZIP entry: {bad}')
    with open(tmp,'rb') as f:data=f.read()
    os.remove(tmp)
    return data

print('Loading original XAPK',os.path.getsize(INFILE))
key=rsa.generate_private_key(public_exponent=65537,key_size=3072)
subj=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'Your Happy Ant - Local Test Only')])
cert=x509.CertificateBuilder().subject_name(subj).issuer_name(subj).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(datetime.datetime(2025,1,1,tzinfo=datetime.timezone.utc)).not_valid_after(datetime.datetime(2045,1,1,tzinfo=datetime.timezone.utc)).sign(key,hashes.SHA256()).public_bytes(Encoding.DER)

with zipfile.ZipFile(INFILE) as inp,zipfile.ZipFile(OUTFILE,'w',allowZip64=False) as out:
    info=json.loads(inp.read('manifest.json'))
    info['permissions']=[x for x in info['permissions'] if x!='android.permission.INTERNET']
    info['name']='Your Happy Ant (Local Help Test)'
    for name in inp.namelist():
        if name.endswith('.apk'):
            print('Signing split',name, flush=True)
            data=build_split(inp.read(name),name,key,cert)
        elif name=='manifest.json':
            data=json.dumps(info,ensure_ascii=False,separators=(',',':')).encode('utf-8')
        else:
            data=inp.read(name)
        out.writestr(name,data,compress_type=zipfile.ZIP_STORED)

with zipfile.ZipFile(OUTFILE) as check:
    assert len([i for i in check.namelist() if i.endswith('.apk')])==5
    assert check.testzip() is None
    assert 'android.permission.INTERNET' not in json.loads(check.read('manifest.json'))['permissions']
    from zipfile import ZipFile
    with ZipFile(io.BytesIO(check.read(PACKAGENAME))) as base:
        b=base.read('AndroidManifest.xml')
        assert 'android.permission.INTERNEX'.encode('utf-16le') in b
    with ZipFile(io.BytesIO(check.read('config.arm64_v8a.apk'))) as arm:
        lib=arm.read('lib/arm64-v8a/libMyGame.so')
        assert lib[0x28ebad4:0x28ebad4+8]==bytes.fromhex('20008052c0035fd6')
print('Created',OUTFILE,os.path.getsize(OUTFILE),'bytes')
print('SHA256',hashlib.file_digest(open(OUTFILE,'rb'),'sha256').hexdigest())
print('Cert SHA256',hashlib.sha256(cert).hexdigest())
print('WARNING: not tested on physical Android. Native runtime may detect modified signature or require internet.')