#!/usr/bin/env python3
"""Nonregression gate against immutable 7.9 release media evidence.
Download 7.9 release CSV/coverage to data/baseline79 before this check.
"""
import csv,json,sys
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
BEFORE=BASE/'data'/'baseline79'
REPORT=BASE/'dist'/'release-evidence'

def rows(path):
    with path.open(encoding='utf-8-sig',newline='') as f:
        lines=list(csv.DictReader(f,delimiter=';'))
    if len(lines)>298:raise ValueError('invalid voice CSV count')
    return {x['Научное название'].strip() for x in lines if x.get('Научное название')}

def inspect():
    REPORT.mkdir(parents=True,exist_ok=True)
    previous=json.loads((BEFORE/'coverage.json').read_text('utf-8-sig'))
    current=json.loads((BASE/'data'/'coverage.json').read_text('utf-8-sig'))
    before_missing=rows(BEFORE/'missing-voices.csv')
    current_missing={str(s) for s in current.get('missingAudio',[])}
    if len(before_missing)!=298-int(previous['birdCalls']):raise ValueError('7.9 release CSV/count mismatch')
    if len(current_missing)!=298-int(current['birdCalls']):raise ValueError('8.1 media inventory/count mismatch')
    lost=sorted(current_missing-before_missing)
    recovered=sorted(before_missing-current_missing)
    checks={
      'baselineTag':'ptitsy-v7.9.0','baselineBirdCalls':int(previous['birdCalls']),
      'currentBirdCalls':int(current['birdCalls']),
      'baselineMissing':len(before_missing),'currentMissing':len(current_missing),
      'newlyMissingPreviouslyPresent':lost,'recoveredSinceBaseline':recovered,
      'minimumRequiredVoices':max(261,int(previous['birdCalls'])),
      'photos':int(current.get('photos',0)),'articles':int(current.get('articles',0)),
      'baselinePhotos':int(previous.get('photos',0)),'baselineArticles':int(previous.get('articles',0))
    }
    (REPORT/'voice-regression.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
    doc=['# MoOLVa 8.1 — контроль регресса голосов и материалов','',
      'Эталон: опубликованный неизменяемый релиз 7.9 (coverage.json и missing-voices.csv).','',
      f"- Голосов в 7.9: **{checks['baselineBirdCalls']}**; в новой сборке: **{checks['currentBirdCalls']}**.",
      f"- Исчезнувшие ранее проверенные виды: **{len(lost)}**.",
      f"- Восстановленные/найденные после 7.9: **{len(recovered)}**.",
      '- При потере любого ранее проверенного вида публикация запрещена, даже если общий счёт прежний.',
      '- Синтетические записи не допускаются; учитываются только файлы после технического аудиоаудита.',
      '']
    if lost:doc+=['## Утерянные виды','']+['- '+x for x in lost]
    if recovered:doc+=['','## Возвращённые или новые виды','']+['- '+x for x in recovered]
    (REPORT/'voice-regression.md').write_text('\n'.join(doc)+'\n',encoding='utf-8')
    print('VOICE NONREGRESSION',json.dumps(checks,ensure_ascii=False),flush=True)
    if int(previous['birdCalls'])<261 or int(previous['species'])!=298:raise RuntimeError('Known 7.9 baseline is invalid')
    if int(current.get('species',0))!=298:raise RuntimeError('Regional catalog lost species')
    if lost:raise RuntimeError('Audio regression: previously verified species missing: '+', '.join(lost))
    if int(current['birdCalls'])<checks['minimumRequiredVoices']:raise RuntimeError('Audio voice count regressed below 261')
    if current.get('photos',0)<previous.get('photos',0) or current.get('articles',0)<previous.get('articles',0):
        raise RuntimeError('Photo/article completeness regressed')
    print('VOICE / PHOTO / ARTICLE GUARD PASS',flush=True)

if __name__=='__main__':
    try:inspect()
    except Exception as e:
        print('VOICE GUARD FAILED:',e,file=sys.stderr,flush=True)
        sys.exit(1)
