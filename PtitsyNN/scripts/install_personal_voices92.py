#!/usr/bin/env python3
"""Install seven noncommercial bird calls with provenance and user review pending."""
import hashlib,json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'data'/'personal-seven-calls'
EXPECTED={'Clanga clanga','Larus hyperboreus','Gallinago media','Calidris minuta','Circus pygargus','Mergellus albellus','Circus macrourus'}
LICENSES={'https://creativecommons.org/licenses/by-nc-sa/3.0/':'CC BY-NC-SA 3.0',
          'https://creativecommons.org/licenses/by-nc-sa/4.0/':'CC BY-NC-SA 4.0'}
def apply_recordings(birds,entries,assets,app):
    by_latin={b['latin']:b for b in birds}
    if len(by_latin)!=len(birds) or {e['latin'] for e in entries}!=EXPECTED or len(entries)!=len(EXPECTED):
        raise ValueError('Incorrect species manifest or duplicate')
    staged=[]
    for item in entries:
        latin=item['latin'];filename=item['file'];ident=str(item['id'])
        if latin not in by_latin or Path(filename).name!=filename or not filename.endswith('.mp3') or not ident.isdecimal():
            raise ValueError('Invalid species, file or source ID')
        source=assets/filename;data=source.read_bytes()
        if len(data)<3000 or hashlib.sha256(data).hexdigest()!=item['sha256']:
            raise ValueError('Missing or damaged call: '+latin)
        if item.get('license') not in LICENSES or item.get('source')!='https://xeno-canto.org/'+ident or not item.get('author'):
            raise ValueError('Invalid attribution or license: '+latin)
        bird=by_latin[latin];current=bird.get('audioFile') or ''
        if latin=='Clanga clanga' and current and not (current.endswith('/clanga-clanga-inat.mp3') or current.endswith('/'+filename)):
            raise ValueError('Eagle source changed; refusing to replace an unexpected recording')
        if latin!='Clanga clanga' and current and not current.endswith('/'+filename):
            continue
        staged.append((bird,item,source,app/'media'/'audio'/filename))
    report=[]
    for bird,item,source,dest in staged:
        previous=bird.get('audioFile');dest.parent.mkdir(parents=True,exist_ok=True)
        if not dest.exists() or hashlib.sha256(dest.read_bytes()).hexdigest()!=item['sha256']:
            shutil.copyfile(source,dest)
        bird['audioFile']='media/audio/'+dest.name
        bird.pop('audioCleanFile85',None)
        if bird['latin']=='Clanga clanga':
            bird['audioTracks']=[]
        bird['audioCredits']={'source':item['source'],'author':item['author'],
            'license':LICENSES[item['license']],'licenseUrl':item['license'],
            'recordingId':'XC'+str(item['id']),'sourcePlatform':'Xeno-canto',
            'sourceTaxon':item['latin'],'vocalization':item['type'],
            'recordingQuality':item['quality'],'audioQuality':item['metrics'],
            'sha256':item['sha256'],'reviewStatus':'awaiting-user-review',
            'speciesHumanVerified':False,'noncommercialOnly':True,
            'audioProcessing':'Перекодировано в моно MP3, 32 кГц; не более 45 секунд.',
            'audioReview':'Проверены метаданные источника и файл; на слух не проверено.',
            'licenseNotice':'Только некоммерческое использование, с указанием автора и той же лицензией для переработок.'}
        report.append({'latin':bird['latin'],'name':bird.get('name',''),'previous':previous,
            'current':bird['audioFile'],'source':item['source'],'author':item['author'],
            'license':LICENSES[item['license']],'licenseUrl':item['license'],
            'sha256':item['sha256'],'reviewStatus':'awaiting-user-review'})
    return report
def main():
    catalog=ROOT/'app'/'data.js';prefix='window.BIRDS_DATA='
    raw=catalog.read_text(encoding='utf-8-sig').strip()
    if not raw.startswith(prefix):raise ValueError('Missing bird catalog')
    birds=json.loads(raw[len(prefix):].rstrip(';'))
    if len(birds)!=298:raise ValueError('Expected 298 birds')
    entries=json.loads((ASSETS/'manifest.json').read_text(encoding='utf8'))
    report=apply_recordings(birds,entries,ASSETS,ROOT/'app')
    catalog.write_text(prefix+json.dumps(birds,ensure_ascii=False,separators=(',',':'))+';',encoding='utf8')
    out=ROOT/'dist'/'release-evidence'/'personal-seven-voices.json'
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print('Personal noncommercial recordings installed:',len(report),'awaiting user review',flush=True)
if __name__=='__main__':main()
