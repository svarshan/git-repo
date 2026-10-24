'use strict';
/* Release smoke test: real native CPU inference with 160000 numeric samples.
   Refuse installer release if the pre-trained model is corrupted or output
   dimensionality fails to match the original labels.
*/
const fs=require('node:fs'),path=require('node:path'),ort=require('onnxruntime-node');
(async()=>{
 const root=path.join(__dirname,'..','app','models');
 const file=path.join(root,'perch-v2-eastern-europe.onnx');
 const labels=fs.readFileSync(path.join(root,'perch-v2-eastern-europe-labels.txt'),'utf8').replace(/^\ufeff/,'').trim().split(/\r?\n/);
 const provenance=JSON.parse(fs.readFileSync(path.join(root,'model-provenance.json'),'utf8'));
 if(!fs.existsSync(file)||labels.length!==provenance.class_count||labels.length<400)throw Error('Missing or inconsistent pretrained model assets.');
 const session=await ort.InferenceSession.create(file,{executionProviders:['cpu'],intraOpNumThreads:2});
 if(!session.inputNames.includes('inputs')||!session.outputNames.includes('label'))throw Error('Perch model signature mismatch');
 const pcm=new Float32Array(160000);
 for(let i=0;i<pcm.length;i++)pcm[i]=Math.sin(2*Math.PI*540*i/32000)*0.05;
 const outputs=await session.run({inputs:new ort.Tensor('float32',pcm,[1,160000])},['label']);
 const v=outputs.label?.data;
 if(!v||v.length!==labels.length||!Array.from(v).some(Number.isFinite))throw Error('Live ONNX inference returned invalid labels');
 console.log('MODEL SMOKE PASS: 5 s 32 kHz, output classes',v.length,'model SHA256',provenance.model_sha256);
})().catch(err=>{console.error(err);process.exit(1);});
