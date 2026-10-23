const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const data=fs.readFileSync(path.join(root,'app','data.js'),'utf8');
const box={window:{}};vm.runInNewContext(data,box);
const birds=box.window.BIRDS_DATA;
const mediaRoot=path.resolve(root,'app','media')+path.sep;
const allowedMediaSource=/^https:\/\/(?:commons\.wikimedia\.org\/|www\.inaturalist\.org\/observations\/\d+(?:\/|$)|xeno-canto\.org\/\d+(?:\/|$))/;
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
  if(file==='audioFile')assert.doesNotMatch(b[credit].source,/inaturalist\.org/, 'Bird audio must not come from ambient iNaturalist observation');
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
