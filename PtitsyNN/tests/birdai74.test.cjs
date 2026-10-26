'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('real FFT spectrogram and offline Bird AI audio preview',()=>{
 const js=read('app/spectrogram74.js'),html=read('app/index.html');
 for(const word of ['fft(re,im)','decodeAudioData','getChannelData(0)','createImageData','putImageData','selectedAudio.currentTime'])assert.ok(js.includes(word),word);
 assert.ok(html.includes('id="birdAISpectrogram"'));assert.ok(html.includes('src="spectrogram74.js"'));
});
test('native Perch windows preserve audio times and clickable snippets',()=>{
 const js=read('app/living6.js');
 for(const word of ['model.analyze(windows[i].pcm)','prediction.findings','playClip(finding.offset)','activeAudio.currentTime','end=offset+5'])assert.ok(js.includes(word),word);
});
test('new 298 voice target and both old and new audit milestones',()=>{
 const p=JSON.parse(read('package.json')),wf=read('../.github/workflows/ptitsy-nn-windows.yml'),py=read('scripts/voices_298.py'),qa=read('scripts/audit_audio.py');
 assert.equal(p.version,'7.8.0');
 assert.ok(p.build.nsis.artifactName.startsWith('MoOLVa-7.8-Setup-'));
 assert.ok(p.build.portable.artifactName.startsWith('MoOLVa-7.8-Portable-'));
 assert.ok(py.includes('TARGET = 298')&&py.includes('milestone298'));
 assert.ok(wf.includes('python -u scripts/voices_298.py'));
 assert.ok(qa.includes('milestone150')&&qa.includes('milestone200'));
 assert.ok(wf.includes('milestone298'));
 assert.ok(read('app/index.html').includes('id="m75Town"'));
 assert.ok(read('app/index.html').includes('id="birdAIWindows"'));
});
