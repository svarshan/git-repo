#!/usr/bin/env python3
"""Download authentic MIT bird-image EfficientNet ONNX for fully-offline Windows.
This 525-class model is NOT trained/evaluated on the 298-species Nizhny Novgorod list.
Never fabricate labels or model outputs if remote assets fail verification.
"""
import hashlib,json,requests
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'app'/'models'
REV='ff5136258c85e15098b4db44ba00a8fdcf2d04d5'
REPO='chriamue/bird-species-classifier'
BASE=f'https://huggingface.co/{REPO}/resolve/{REV}/'
SHA256='dbfd1293e47384cc215f3cbf0a611548589b91d5fd5e8838a03fdd485bd7151b'
MODEL='birdvision-efficientnet-525.onnx'
s=requests.Session()
s.headers['User-Agent']='MoOLVa/8.0 (+offline-on-device-image-classification)'

def load(name):
    r=s.get(BASE+name,timeout=(25,80),allow_redirects=True)
    r.raise_for_status()
    return r.content

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    dest=OUT/MODEL
    reuse=dest.is_file() and hashlib.sha256(dest.read_bytes()).hexdigest()==SHA256
    if not reuse:
        tmp=dest.with_suffix('.part')
        hasher=hashlib.sha256()
        total=0
        try:
            with s.get(BASE+'model.onnx',timeout=(35,200),stream=True,allow_redirects=True) as r:
                r.raise_for_status()
                with tmp.open('wb') as output:
                    for chunk in r.iter_content(1024*1024):
                        if not chunk:continue
                        total+=len(chunk)
                        if total>45_000_000:raise ValueError('Unusually large pretrained image model')
                        output.write(chunk);hasher.update(chunk)
            if total<30_000_000 or hasher.hexdigest()!=SHA256:raise ValueError('Model SHA256 mismatch against upstream pinned ONNX')
            tmp.replace(dest)
        finally:tmp.unlink(missing_ok=True)
    config=json.loads(load('config.json'))
    labels=config.get('id2label')
    if not isinstance(labels,dict) or len(labels)<200:raise ValueError('Model class mapping missing or too small')
    ordered=[labels.get(str(i)) for i in range(len(labels))]
    if any(not isinstance(v,str) or not v.strip() for v in ordered):raise ValueError('Missing class label in model config')
    if len(set(ordered))!=len(ordered):raise ValueError('Model class labels duplicated')
    processor=json.loads(load('preprocessor_config.json'))
    # Publish the upstream data to avoid inferring means, std or correct class names.
    image_size=processor.get('size')
    if image_size is None:raise ValueError('Image processor size unavailable')
    metadata={'model':'EfficientNet 525 bird species classifier','source':f'https://huggingface.co/{REPO}',
      'revision':REV,'file':MODEL,'sha256':SHA256,'license':'MIT','labels':ordered,
      'processor':processor,'architecture':config.get('model_type'),'accuracyClaim':'Self-reported 96.8% on external 525-class validation set; not validated on 298 regional birds.',
      'limitation':'Classes outside model and regional species may be missing; logits are not confidence probabilities.'}
    (OUT/'birdvision-525-provenance.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'BIRDVISION-THIRD-PARTY-NOTICE.txt').write_text(
      'chriamue/bird-species-classifier; EfficientNet trained on 525 bird species.\n'
      'Model repository license: MIT. Check the model card and source for full terms.\n'
      f'Source: https://huggingface.co/{REPO}\nPinned revision: {REV}\nSHA256: {SHA256}\n'
      'Validation claims on the remote 525-class dataset do not establish accuracy on the 298-species regional atlas.\n',encoding='utf-8')
    print('REAL BIRD VISION MODEL VERIFIED',len(labels),'classes',dest.stat().st_size,'bytes',flush=True)

if __name__=='__main__':main()
