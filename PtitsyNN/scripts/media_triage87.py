#!/usr/bin/env python3
"""Offline species-level media QA triage; heuristics are review leads, not biological proof."""
import csv
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=ROOT/'dist'/'release-evidence'
AUDIO=EVIDENCE/'audio-audit85.json'
PHOTOS=EVIDENCE/'photo-review'/'photo-review.csv'
TARGET=ROOT/'app'/'quality-triage87.js'

def priority_audio(row):
    weights={'missing_audio':100,'decode_or_audit_error':100,'clipping_review':60,
             'weak_or_short_review':55,'missing_attribution_review':40,'possible_speech_review':20}
    flags=list(row.get('flags') or [])
    return min(999,sum(85 if flag.startswith('possible_duplicate') else weights.get(flag,0) for flag in flags))

def priority_photo(row):
    flags=[]
    if row.get('metadataProblem')=='1': flags.append('metadata_egg_or_nest_suspected')
    if row.get('decodeError')=='1': flags.append('decode_error')
    if row.get('qualityIssue'): flags.append('quality_issue')
    if row.get('needsHumanVisualReview')=='1': flags.append('needs_visual_review')
    score=(90 if 'metadata_egg_or_nest_suspected' in flags else 0)
    score+=90 if 'decode_error' in flags else 0
    score+=60 if 'quality_issue' in flags else 0
    score+=10 if 'needs_visual_review' in flags else 0
    return score,flags

def build(audio,photo_rows):
    rows=audio.get('records') or []
    if len(rows)!=298 or len(photo_rows)!=298:
        raise ValueError('Expected 298 entries from both audio and photo auditors')
    sound,photos={},{}
    audio_species={r['latin'] for r in rows}
    photo_species={r['latin'] for r in photo_rows}
    if len(audio_species)!=298 or len(photo_species)!=298 or audio_species!=photo_species:
        raise ValueError('Audio/photo audits disagree about the 298 species')
    for row in rows:
        score=priority_audio(row)
        if score:
            sound[row['latin']]={'priority':score,'flags':list(row.get('flags') or []),
                'seconds':row.get('seconds'),'speechLikeMaxSeconds':row.get('speech_like_max_seconds')}
    for row in photo_rows:
        score,flags=priority_photo(row)
        if score: photos[row['latin']]={'priority':score,'flags':flags}
    return {'schema':1,'species':298,
            'note':'Heuristic warnings only, never independent species or speech verification.',
            'summary':{'audioFlagged':len(sound),'photoFlagged':len(photos),
                       'humanAudioVerified':0,'humanPhotoVerified':0},
            'audio':sound,'photo':photos}

def main():
    audit=json.loads(AUDIO.read_text(encoding='utf8'))
    with PHOTOS.open(encoding='utf-8-sig',newline='') as f:
        photos=list(csv.DictReader(f))
    result=build(audit,photos)
    TARGET.write_text('window.MOOLVA_MEDIA_TRIAGE87='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    (EVIDENCE/'media-triage87.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
    with (EVIDENCE/'media-triage87.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.writer(f);writer.writerow(['scientific_species','audio_priority','audio_flags','photo_priority','photo_flags','human_verified'])
        for latin in sorted(set(result['audio'])|set(result['photo'])):
            a,p=result['audio'].get(latin,{}),result['photo'].get(latin,{})
            writer.writerow([latin,a.get('priority',0),';'.join(a.get('flags',[])),
                             p.get('priority',0),';'.join(p.get('flags',[])),'NO'])
    print(json.dumps(result['summary'],ensure_ascii=False),flush=True)

if __name__=='__main__':
    main()
