#!/usr/bin/env python3
"""MoOLVa 7.9 release evidence from authentic Windows screenshot smoke and generated bird catalog."""
from __future__ import annotations
import argparse,csv,hashlib,json,re,struct,sys
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
DIST=BASE/'dist'/'release-evidence'
PNG_SIGNATURE=b'\x89PNG\r\n\x1a\n'

def read_catalog():
    s=(BASE/'app'/'data.js').read_text(encoding='utf-8-sig').strip()
    prefix='window.BIRDS_DATA='
    if not s.startswith(prefix):raise ValueError('Generated licensed catalog missing')
    data=json.loads(s[len(prefix):].rstrip(';'))
    if not isinstance(data,list) or len(data)!=298:raise ValueError('Regional catalog count is not 298')
    return data

def inventory():
    DIST.mkdir(parents=True,exist_ok=True)
    birds=read_catalog()
    coverage=json.loads((BASE/'data'/'coverage.json').read_text(encoding='utf-8-sig'))
    missing=[b for b in birds if not b.get('audioFile')]
    verified=len(birds)-len(missing)
    if coverage.get('birdCalls')!=verified or coverage.get('species')!=len(birds):
        raise ValueError('Voice inventory disagrees with technically validated coverage.json')
    with (DIST/'missing-voices.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f,delimiter=';',quoting=csv.QUOTE_MINIMAL)
        w.writerow(['№','Название вида','Научное название','Группа','Статус'])
        for i,b in enumerate(sorted(missing,key=lambda t:t.get('name') or ''),1):
            cells=[i,b.get('name',''),b.get('latin',''),b.get('group',''),'Нет проверенной основной голосовой записи']
            cells=["'"+x if isinstance(x,str) and x.startswith(('=','+','-','@','\t')) else x for x in cells]
            w.writerow(cells)
    md=['# MoOLVa — виды без проверенных основных голосов','',
        f'Всего: {len(birds)}. С голосами: {verified}. Без основных записей: {len(missing)}.','',
        'Список сформирован из каталога той же Windows-сборки. Отсутствие записи означает отсутствие лицензированного подтверждённого файла в текущем пакете.','',
        '| № | Вид | Научное название |','|---:|---|---|']
    for i,b in enumerate(sorted(missing,key=lambda t:t.get('name') or ''),1):
        md.append(f"| {i} | {str(b.get('name','')).replace('|','/')} | {str(b.get('latin','')).replace('|','/')} |")
    (DIST/'missing-voices.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
    (DIST/'voice-inventory.json').write_text(json.dumps({'species':len(birds),'withPrimaryVoice':verified,'missingPrimaryVoice':len(missing)},ensure_ascii=False,indent=2),encoding='utf-8')
    print('VOICE INVENTORY',len(birds),verified,len(missing),flush=True)

def sha256(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()

def screenshots():
    smoke=json.loads((DIST/'gui-smoke.json').read_text(encoding='utf-8'))
    if smoke.get('type')!='MoOLVa-real-windows-screenshots' or smoke.get('packaged') is not True or smoke.get('os')!='win32':
        raise ValueError('Real packaged Windows Electron screenshot evidence absent')
    if smoke.get('catalog',{}).get('species')!=298 or smoke.get('modelAvailable') is not True:
        raise ValueError('Packaged screenshot runtime lacks catalog or Perch model')
    names=['01-glavnaya.png','02-bird-ai.png','03-karta-oblasti.png','04-encyclopedia.png','05-polevoi-dnevnik.png','06-audiolaboratoriya.png']
    rows=smoke.get('screenshots',[])
    if [x.get('name') for x in rows]!=names:raise ValueError('Some actual application sections were not captured')
    result=[]
    for shot in rows:
        p=DIST/shot['name']
        raw=p.read_bytes()
        if len(raw)<20000 or not raw.startswith(PNG_SIGNATURE):raise ValueError('Not a genuine PNG: '+p.name)
        width,height=struct.unpack('>II',raw[16:24])
        if width<800 or height<500 or width!=shot['width'] or height!=shot['height']:
            raise ValueError('Invalid dimensions: '+p.name)
        digest=sha256(p)
        if digest!=shot['sha256']:raise ValueError('Screenshot SHA256 mismatch: '+p.name)
        result.append({'name':p.name,'bytes':len(raw),'width':width,'height':height,'sha256':digest,'screen':shot.get('view')})
    return result,smoke

def test_logs():
    node=(DIST/'node-tests.log').read_text(encoding='utf-8-sig',errors='replace')
    python=(DIST/'python-tests.log').read_text(encoding='utf-8-sig',errors='replace')
    passes=re.findall(r'^# pass\s+(\d+)\s*$',node,re.MULTILINE)
    fails=re.findall(r'^# fail\s+(\d+)\s*$',node,re.MULTILINE)
    py=re.findall(r'Ran\s+(\d+)\s+tests?\s+in\s+',python)
    if not passes or not fails or int(fails[-1])!=0 or int(passes[-1])<50:raise ValueError('Node regression log missing or failed')
    if not py or not re.search(r'^OK\s*$',python,re.MULTILINE):raise ValueError('Python regression log missing or failed')
    return {'nodePassed':int(passes[-1]),'nodeFailed':int(fails[-1]),'pythonPassed':int(py[-1]),'pythonFailed':0}

def finalize():
    shots,smoke=screenshots()
    checks=test_logs()
    coverage=json.loads((BASE/'data'/'coverage.json').read_text(encoding='utf-8-sig'))
    voices=json.loads((DIST/'voice-inventory.json').read_text(encoding='utf-8'))
    version=json.loads((BASE/'package.json').read_text(encoding='utf-8'))['version']
    if smoke.get('version')!=version or version!='7.9.0':raise ValueError('Executable version differs from release')
    if voices['withPrimaryVoice']!=coverage.get('birdCalls'):raise ValueError('Coverage changed after inventory')
    report={'version':version,'status':'PASS','automatedTests':checks,
       'gui':{'packaged':True,'system':'Windows GitHub Actions', 'screenshots':shots,'method':smoke['captureMethod'],
              'limitations':'Actual packaged Electron captured with offscreen Chromium; not an interactive user desktop test.'},
       'catalog':{'species':coverage.get('species'),'photos':coverage.get('photos'),'voices':coverage.get('birdCalls'),
                  'articles':coverage.get('articles'),'missingVoices':voices['missingPrimaryVoice']},
       'notTested':['User microphone and sound hardware','Restore operation on personal datasets','Independent model accuracy']}
    (DIST/'test-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    md=['# MoOLVa '+version+' — отчёт проверки Windows','',
       '**Автоматические проверки: успешно.**','',
       f"- Node.js: {checks['nodePassed']} пройдено, {checks['nodeFailed']} ошибок.",
       f"- Python: {checks['pythonPassed']} пройдено.",
       f"- Реальные скриншоты упакованного Electron на Windows: {len(shots)}.",
       '- Скриншоты сняты Chromium webContents.capturePage из работающего EXE в offscreen-режиме. Это не нарисованные макеты.',
       '- Проверены формат PNG, размеры и SHA-256 снимков.',
       '- Основной Windows workflow дополнительно тестирует Perch v2 ONNX, оба EXE и SHA256SUMS.','',
       '## Медиа и недостающие голоса','',
       f"- Видов: {coverage.get('species')}, фотографий: {coverage.get('photos')}, статей: {coverage.get('articles')}.",
       f"- Основных голосов: {coverage.get('birdCalls')}. Без голосов: {voices['missingPrimaryVoice']}.",
       '- Имена отсутствующих видов находятся в файле missing-voices.csv.','',
       '## Скриншоты и контрольные суммы','',
       '| Файл | Раздел | Размер | SHA-256 |','|---|---|---|---|']
    for shot in shots:md.append(f"| {shot['name']} | {shot['screen']} | {shot['width']}×{shot['height']} | {shot['sha256']} |")
    md+=['','## Не проверено вручную','',
        '- Работа микрофона и колонок на пользовательском компьютере.',
        '- Восстановление больших личных архивов в реальных условиях.',
        '- Независимая точность распознавания птиц.','']
    (DIST/'test-report.md').write_text('\n'.join(md),encoding='utf-8')
    print('RELEASE QA PASS',checks,'screenshots',len(shots),'missing',voices['missingPrimaryVoice'],flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('mode',choices=['inventory','finalize'])
    mode=p.parse_args().mode
    try:inventory() if mode=='inventory' else finalize()
    except Exception as ex:
        print('RELEASE EVIDENCE FAILED:',ex,file=sys.stderr,flush=True)
        sys.exit(1)
