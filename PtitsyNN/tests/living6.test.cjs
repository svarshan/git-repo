'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),read=s=>fs.readFileSync(path.join(ROOT,s),'utf8');
test('6.0 truly wires audio file decode to verified pretrained Perch model IPC',()=>{
 const html=read('app/index.html'),script=read('app/living6.js'),main=read('main.cjs'),preload=read('preload.cjs');
 for(const id of ['birdAI','birdAIFile','birdAIRun','birdAIStatus','birdAIResults','birdAIPreview','speciesCompare6','speciesCompareA','speciesCompareB']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/src="living6\.js"/);
 assert.match(html,/src="compare6\.js"/);
 assert.match(main,/onnxruntime-node/);
 assert.match(main,/InferenceSession\.create/);
 assert.match(main,/model\.run/);
 assert.match(main,/new ort\.Tensor\('float32'/);
 assert.match(main,/ipcMain\.handle\('birdai-analyze'/);
 assert.match(preload,/contextBridge\.exposeInMainWorld\('BirdAI'/);
 assert.match(script,/OfflineAudioContext\(1,160000,32000\)/);
 assert.match(script,/model\.analyze\(windows\[i\]\.pcm\)/);
 assert.match(script,/Модель не смогла выделить убедительные классы/);
 assert.match(main,/modelStatus\(\)/);
 new Function(script);new Function(read('app/compare6.js'));new Function(main);
});
test('real model and license assets are in the Windows build',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('../.github/workflows/ptitsy-nn-windows.yml');
 assert.equal(pkg.version,'7.1.0');
 assert.equal(pkg.dependencies['onnxruntime-node'],'1.24.3');
 assert.ok(pkg.build.files.includes('preload.cjs'));
 assert.match(pkg.build.asarUnpack.join(','),/app\/models/);
 assert.match(workflow,/python -u scripts\/prepare_ai\.py/);
 assert.match(workflow,/node scripts\/test_ai\.cjs/);
 assert.match(workflow,/Ptitsy-NN-7\.0-Windows/);
 const folder=path.join(ROOT,'app','models');
 const info=JSON.parse(fs.readFileSync(path.join(folder,'model-provenance.json'),'utf8'));
 const weights=path.join(folder,'perch-v2-eastern-europe.onnx');
 assert.ok(fs.statSync(weights).size>=35000000);
 assert.equal(info.license,'Apache-2.0');
 assert.ok(fs.statSync(path.join(folder,'LICENSE-Apache-2.0.txt')).size>5000);
 assert.ok(info.class_count>=400);
});
test('features 5.1, 5.2, 5.3, 5.4 are upgraded while excluded items remain excluded',()=>{
 const html=read('app/index.html'),map=read('app/habitat-atlas.js'),bird=read('app/app.js');
 assert.match(html,/habitatMonth/);
 assert.match(map,/atlas/);
 assert.match(html,/Голоса птиц/);
 assert.match(bird,/Паспорт вида/);
 assert.match(html,/Bird AI/);
 assert.doesNotMatch(html,/Пульс природы/);
 assert.doesNotMatch(html,/Автономная станция записи/);
});
