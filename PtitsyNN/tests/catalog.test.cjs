const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const data=fs.readFileSync(path.join(root,'app','data.js'),'utf8');
const box={window:{}};vm.runInNewContext(data,box);
const birds=box.window.BIRDS_DATA;
const mediaRoot=path.resolve(root,'app','media')+path.sep;
const allowedMediaSource=/^https:\/\/(?:commons\.wikimedia\.org\/|www\.inaturalist\.org\/observations\/\d+(?:\/|$)|xeno-canto\.org\/\d+(?:\/|$)|freesound\.org\/(?:people|s)\/|archive\.org\/details\/)/;
const forbiddenLicense=/(?:by-nc|by-nd|nc-sa|nc-nd|noncommercial|no-derivatives)/i;
test('full catalog of unique scientific species',()=>{
 assert.equal(birds.length,298);
 assert.equal(new Set(birds.map(b=>b.id)).size,298);
 assert.equal(new Set(birds.map(b=>b.latin)).size,298);
});
test('only existing local media with open licenses, author and source credits',()=>{
 for(const b of birds)for(const [file,credit] of [['imageFile','imageCredits'],['audioFile','audioCredits']]){
  if(!b[file])continue;
  assert.match(b[file],/^media\/(?:image|audio)\/[a-z0-9_-]+\.(?:jpg|png|webp|ogg|mp3|wav)$/i);
  const location=path.resolve(root,'app',b[file]);
  assert.ok(location.startsWith(mediaRoot),'Media path must stay inside offline media folder');
  assert.ok(fs.existsSync(location),'Missing media: '+b[file]);
  assert.ok(fs.statSync(location).size>=250,'Suspiciously short media: '+b[file]);
  assert.ok(b[credit]?.author,'Missing author credit for '+b[file]);
  assert.ok(b[credit]?.license,'Missing license for '+b[file]);
  assert.doesNotMatch(b[credit].license,forbiddenLicense);
  if(file==='audioFile' && /inaturalist\.org/.test(b[credit].source)){
   // Bare ambient observation recordings remain forbidden; only an identified
   // individual sound with licensed metadata, author and audit is admissible.
   const c=b[credit];
   assert.equal(c.sourcePlatform,'iNaturalist','Missing per-sound source provenance');
   assert.match(String(c.recordingId||''),/^iNat:\d+$/,'Missing individual sound recording ID');
   assert.ok(Number.isInteger(c.soundId)&&c.soundId>0,'Missing original sound ID');
   assert.match(c.source,/^https:\/\/www\.inaturalist\.org\/observations\/\d+$/);
   assert.ok(['CC0','CC-BY','CC-BY-SA'].includes(String(c.license).toUpperCase()),'Only CC0, CC BY, CC BY-SA licensed sound permitted');
   assert.match(String(c.licenseUrl||''),/^https:\/\/creativecommons\.org\/(?:licenses\/by(?:-sa)?\/|publicdomain\/zero\/)/);
   assert.match(String(c.speciesMatch||''),/exact scientific taxon name on research-grade/i);
   assert.ok(c.audioQuality?.seconds>=1 && Number.isFinite(c.audioQuality?.meanDb),'Missing post-download FFmpeg QA');
   assert.ok(c.author && c.audioProcessing,'Missing author or processing metadata');
  }
  assert.match(b[credit]?.source||'',allowedMediaSource,'Unrecognized license source for '+b[file]);
 }
});
test('description links point to Wikipedia',()=>{
 for(const b of birds)if(b.articleComplete){
  assert.ok(b.description.length>=280);
  assert.match(b.descriptionSource,/^https:\/\/(ru|en)\.wikipedia\.org\//);
 }
});

test('bird details modal fits small screens without cropping photo or inheriting stale scroll',()=>{
 const css=fs.readFileSync(path.join(root,'app','style.css'),'utf8');
 const app=fs.readFileSync(path.join(root,'app','app.js'),'utf8');
 assert.match(css,/\.overlay\{[^}]*align-items:flex-start;[^}]*overflow-y:auto;/);
 assert.match(css,/\.modal\{[^}]*max-height:calc\(100dvh - 32px\);[^}]*overflow-y:auto;/);
 assert.match(css,/\.detailphoto img\{[^}]*object-fit:contain;/);
 assert.match(css,/body\.dialog-open\{overflow:hidden\}/);
 assert.match(app,/function showDialog\(\)[^}]*overlay\.scrollTop=0;[^}]*modal\.scrollTop=0;/);
 assert.match(app,/function close\(\)[^}]*document\.body\.classList\.remove\('dialog-open'\)/);
});

test('each of 298 bird cards has text, and detailed articles have source and open license',()=>{
 for(const b of birds){
  assert.ok(typeof b.description==='string'&&b.description.length>=140,'Missing: '+b.latin);
  if(b.articleComplete){
   assert.ok(b.description.length>=450);
   assert.ok(['ru','en'].includes(b.descriptionLanguage));
   assert.equal(b.descriptionAttribution?.license,'CC BY-SA 4.0');
  }
 }
});

test('Voices PRO player and comparison integrated in offline app',()=>{
 const p=fs.readFileSync(path.join(root,'app','audio-pro.js'),'utf8');
 const a=fs.readFileSync(path.join(root,'app','app.js'),'utf8');
 const h=fs.readFileSync(path.join(root,'app','index.html'),'utf8');
 assert.match(h,/src="audio-pro\.js"/);
 assert.match(h,/data-view="compare"/);
 assert.match(h,/id="compareContent"/);
 assert.match(a,/window\.BirdAudioPro\?\.mountCard/);
 assert.match(a,/window\.BirdAudioPro\?\.mountCompare/);
 assert.match(a,/window\.BirdAudioPro\?\.stopAll/);
 for(const feature of ['audio.playbackRate','audio.volume','audio.loop','audio.currentTime','exportReports','localStorage','other.pause()']){
  assert.ok(p.includes(feature),'Missing player capability: '+feature);
 }
 assert.match(p,/не проверен прослушиванием специалиста/);
});
test('Audio technical review script ships with quality thresholds and human-audit disclaimer',()=>{
 const s=fs.readFileSync(path.join(root,'scripts','audit_audio.py'),'utf8');
 assert.match(s,/volumedetect,silencedetect/);
 assert.match(s,/Duplicate recording/);
 assert.match(s,/audioHumanReviewed/);
});

test('Voices MAX listening lab renders and allows offline explicit human review',()=>{
 const html=fs.readFileSync(path.join(root,'app','index.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'app','voice-lab.js'),'utf8');
 const app=fs.readFileSync(path.join(root,'app','app.js'),'utf8');
 assert.match(html,/data-view="lab"/);
 assert.match(html,/id="labContent"/);
 assert.match(html,/src="voice-lab\.js"/);
 assert.match(app,/window\.BirdVoiceLab\?\.render/);
 for(const piece of ['ptitsy-nn.voice-lab.v1','localStorage','exportReview','mountCard','reviewedAt','source','license']){
  assert.ok(js.includes(piece),'Missing human-audit feature: '+piece);
 }
});

test('ULTRA supports multiple verified offline tracks without overwriting primary bird call',()=>{
 const files=new Set();
 for(const b of birds){
  const tracks=b.audioTracks||[];
  assert.ok(Array.isArray(tracks),'audioTracks must be an array');
  assert.ok(tracks.length<=2,'At most 2 licensed secondary tracks per bird');
  for(const t of tracks){
   assert.ok(b.audioFile,'Secondary track without main recording for '+b.latin);
   assert.match(t.path,/^media\/audio\/[a-z0-9_-]+\.mp3$/i);
   const p=path.resolve(root,'app',t.path);
   assert.ok(p.startsWith(mediaRoot));
   assert.ok(fs.existsSync(p),'Missing secondary bird recording '+t.path);
   assert.ok(fs.statSync(p).size>=3000);
   assert.ok(!files.has(t.path),'Secondary file assigned twice');
   files.add(t.path);
   assert.ok(t.credit?.source,'Missing original audio source');
   assert.ok(t.credit?.author,'Missing secondary audio author');
   assert.ok(t.credit?.license,'Missing secondary audio license');
   assert.doesNotMatch(t.credit.license,forbiddenLicense);
   assert.match(t.credit.source,allowedMediaSource);
   assert.ok(t.credit?.audioQuality?.meanDb!=null,'Secondary recording never passed FFT/loudness QA');
  }
 }
});
test('ULTRA playback features are offline and local imports are explicitly not licensed sounds',()=>{
 const js=fs.readFileSync(path.join(root,'app','ultra-audio.js'),'utf8');
 const player=fs.readFileSync(path.join(root,'app','audio-pro.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'app','index.html'),'utf8');
 for(const token of ['indexedDB.open','createObjectStore','audio/wav','audio/ogg','audio/mpeg','getByteFrequencyData','createAnalyser','createMediaElementSource','URL.revokeObjectURL']){
  assert.ok(js.includes(token),'Missing ULTRA audio feature '+token);
 }
 assert.match(js,/не проверены и не включаются в распространяемый EXE/);
 assert.match(player,/window\.BirdUltra\?\.render/);
 assert.match(html,/src="ultra-audio\.js"/);
 assert.match(html,/MoOLVa 8\.0/);
});
