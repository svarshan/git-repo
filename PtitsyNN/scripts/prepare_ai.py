#!/usr/bin/env python3
"""MoOLVa 6.0: retrieve source-attributed Apache-2.0 Perch v2 regional ONNX model.

Fail release if unavailable or fails checksum. NEVER synthesize neural-network
outputs as a fallback. Model weights are downloaded on CI, never at user runtime.
"""
from pathlib import Path
import hashlib
import json
import requests

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"app"/"models"
REPO="tphakala/Perch-v2-Models"
REGION="regional/eastern-europe"
API=f"https://huggingface.co/api/models/{REPO}/tree/main/{REGION}"
BASE=f"https://huggingface.co/{REPO}/resolve/main/"
S=requests.Session()
S.headers.update({"User-Agent":"MoOLVaLivingEncyclopedia/6.0 (+desktop-offline-model)"})

def fetch_tree():
    r=S.get(API,timeout=50)
    r.raise_for_status()
    entries=r.json()
    if not isinstance(entries,list) or not entries:
        raise ValueError("No Hugging Face regional model file listing")
    return entries

def select(entries,qualifier):
    candidates=[x for x in entries if qualifier(Path(x.get("path","")).name)]
    if len(candidates)!=1:
        raise RuntimeError(f"Expected exactly one model asset matching selector, found {len(candidates)}: {[x.get('path') for x in candidates]}")
    return candidates[0]

def download(entry,dest,low,high):
    source=entry["path"]
    expected=(entry.get("lfs") or {}).get("sha256")
    target=OUT/dest
    if target.exists() and low<=target.stat().st_size<=high:
        actual=hashlib.sha256(target.read_bytes()).hexdigest()
        if expected and actual==expected:
            print("Reused SHA256-validated model:",target.name)
            return actual
    url=BASE+source+"?download=true"
    digest=hashlib.sha256()
    total=0
    tmp=target.with_suffix(target.suffix+".part")
    with S.get(url,timeout=(25,180),stream=True,allow_redirects=True) as r:
        r.raise_for_status()
        if r.headers.get("Content-Type","").startswith("text/html"):
            raise RuntimeError("Remote server returned HTML rather than a model")
        with tmp.open("wb") as f:
            for chunk in r.iter_content(chunk_size=4*1024*1024):
                if chunk:
                    total+=len(chunk)
                    if total>high: raise RuntimeError("Model unexpectedly large")
                    digest.update(chunk)
                    f.write(chunk)
    if not low<=total<=high:raise RuntimeError(f"Unexpected model size: {total}")
    actual=digest.hexdigest()
    if expected and expected.lower()!=actual:
        tmp.unlink(missing_ok=True)
        raise RuntimeError("Model SHA256 does not match verified upstream LFS")
    tmp.replace(target)
    print(f"Model asset {dest}: {total} bytes; sha256 {actual}")
    return actual

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    files=fetch_tree()
    model=select(files,lambda n:n.endswith("_no_dft_fp32.onnx"))
    labels=select(files,lambda n:n.endswith("_labels.txt"))
    mhash=download(model,"perch-v2-eastern-europe.onnx",35_000_000,150_000_000)
    lhash=download(labels,"perch-v2-eastern-europe-labels.txt",2000,100_000)
    rows=(OUT/"perch-v2-eastern-europe-labels.txt").read_text("utf-8-sig").splitlines()
    if not 400<=len(rows)<=3500:raise RuntimeError(f"Invalid model labels count {len(rows)}")
    if len(set(rows))<len(rows)*0.8:raise RuntimeError("Labels appear corrupt or duplicated")
    (OUT/"model-provenance.json").write_text(json.dumps({
        "name":"Google Perch v2 eastern Europe ONNX", "origin":"Google Research / Perch",
        "conversion":"justinchuby / tphakala", "publisher":REPO,
        "license":"Apache-2.0", "licenseUrl":"https://www.apache.org/licenses/LICENSE-2.0",
        "source":"https://huggingface.co/"+REPO, "input":"inputs",
        "input_shape":[1,160000], "sample_rate":32000,"segment_seconds":5,
        "model_sha256":mhash,"labels_sha256":lhash,"class_count":len(rows),
        "label_asset":labels["path"],"model_asset":model["path"],
        "interpretation":"Scores are model logits, not calibrated certainty; expert review required."
    },ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"AI available: {len(rows)} labels, verification complete.")

if __name__=="__main__":main()
