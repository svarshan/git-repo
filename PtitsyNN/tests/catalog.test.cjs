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
  assert.match(b[credit]?.source||'',allowedMediaSource,'Unrecognized license source for '+b[file]);
 }
});
test('description links point to Wikipedia',()=>{
 for(const b of birds)if(b.articleComplete){
  assert.ok(b.description.length>=280);
  assert.match(b.descriptionSource,/^https:\/\/ru\.wikipedia\.org\//);
 }
});
