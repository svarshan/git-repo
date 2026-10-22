const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const data=fs.readFileSync(path.join(root,'app','data.js'),'utf8');
const box={window:{}};vm.runInNewContext(data,box);
const birds=box.window.BIRDS_DATA;
test('full catalog of unique scientific species',()=>{assert.equal(birds.length,298);assert.equal(new Set(birds.map(b=>b.id)).size,298);assert.equal(new Set(birds.map(b=>b.latin)).size,298);});
test('only existing local media with credits',()=>{for(const b of birds)for(const [file,credit] of [['imageFile','imageCredits'],['audioFile','audioCredits']]){if(!b[file])continue;assert.ok(fs.existsSync(path.join(root,'app',b[file])));assert.ok(b[credit]?.license);assert.match(b[credit]?.source||'',/^https:\/\/commons\.wikimedia\.org\//);}});
test('description links point to Wikipedia',()=>{for(const b of birds)if(b.articleComplete){assert.ok(b.description.length>=280);assert.match(b.descriptionSource,/^https:\/\/ru\.wikipedia\.org\//);}});
