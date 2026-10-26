'use strict';
/* MoOLVa 7.6 source-level regression guard. Runtime/UI and ONNX smoke tests remain separate. */
const fs=require('node:fs'),path=require('node:path');
const test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('7.0 Windows artifacts have independent stable names',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.version,'7.6.0');
 assert.equal(pkg.build.portable.artifactName,'MoOLVa-7.6-Portable-${arch}.exe');
 assert.equal(pkg.build.nsis.artifactName,'MoOLVa-7.6-Setup-${arch}.exe');
});
test('original field atlas remains with authentic regional offline map',()=>{
 const html=read('app/index.html');
 assert.match(html,/nn-oblast-map\.svg/);
 assert.match(html,/id="habitatAtlas"/);
 assert.match(html,/id="habitatSeason"/);
 assert.match(html,/id="habitatMonth"/);
 assert.match(read('app/habitat-atlas.js'),/seasonMonths=/);
 assert.match(read('app/habitat-atlas.js'),/selectedSeason/);
 assert.ok(fs.existsSync(path.join(root,'app','nn-oblast-map.svg')));
});
test('field atlas points link back to real species passports',()=>{
 const code=read('app/habitat-atlas.js');
 assert.ok(code.includes('dataset.open'), 'Map popups must link to catalog species');
 assert.match(code,/window\.BirdHabitat/);
 assert.match(code,/verified|GBIF|опубликованн/i);
});
test('Bird AI requires real ONNX weights, not simulated inference',()=>{
 const main=read('main.cjs');
 assert.match(main,/onnxruntime-node/);
 assert.match(main,/InferenceSession\.create/);
 assert.match(main,/model\.run/);
 assert.match(main,/model-provenance\.json/);
});
test('microphone is user initiated and not unrestricted',()=>{
 const main=read('main.cjs'),client=read('app/living6.js'),preload=read('preload.cjs');
 assert.match(main,/setPermissionRequestHandler/);
 assert.match(main,/micAllowedUntil/);
 assert.match(main,/permission==='media'/);
 assert.match(preload,/birdai-microphone-intent/);
 assert.match(client,/getUserMedia/);
 assert.match(client,/MediaRecorder/);
 assert.match(client,/microphoneStop/);
});
test('sound analysis uses independent five-second 32kHz frames',()=>{
 const code=read('app/living6.js');
 assert.match(code,/OfflineAudioContext\(1,160000,32000\)/);
 assert.match(code,/const segment=5/);
 assert.match(code,/birdAIWindows/);
 assert.match(code,/model\.analyze/);
 assert.match(code,/window\.BirdHabitat\?\.focusSpecies/);
});
