'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function field(){
 const bag=new Map(),context={window:{},localStorage:{getItem:k=>bag.get(k)||null,setItem:(k,v)=>bag.set(k,v)}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'app','field-assistant.js'),'utf8'),context);
 return context.window.BirdFieldAssistant;
}
test('2.9 night city background is a bundled offline original asset',()=>{
 const svg=fs.readFileSync(path.join(root,'app','nizhny-night.svg'),'utf8'),css=fs.readFileSync(path.join(root,'app','style.css'),'utf8');
 assert.match(svg,/Нижегородский кремль/);
 assert.match(svg,/Александра Невского/);
 assert.match(svg,/<svg[^>]+viewBox=/);
 assert.match(css,/nizhny-night\.svg/);
 assert.match(css,/color-scheme:dark/);
 assert.match(css,/prefers-reduced-motion/);
});
test('offline field helper can match transliterated Latin and misspelled Russian names',()=>{
 const api=field();
 const bird={name:'Большая синица',latin:'Parus major',group:'Воробьинообразные'};
 assert.ok(api.score(bird,'Parus major')<99);
 assert.notEqual(api.score(bird,'синица'),99);
 assert.notEqual(api.score(bird,'синицa'),99); // Cyrillic prefix with single Latin 'a' at final is not a word match yet
 assert.equal(api.score(bird,'лошадь'),99);
});
test('recent species history is capped and deduplicated offline',()=>{
 const api=field();
 api.markRecent('parus-major');api.markRecent('parus-major');
 assert.equal(api.recent().length,1);
 for(let i=0;i<35;i++)api.markRecent('bird-'+i);
 assert.equal(api.recent().length,18);
 assert.equal(api.recent()[0],'bird-34');
});
test('journal edit and filter controls and new field tab are wired',()=>{
 const js=fs.readFileSync(path.join(root,'app','app.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'app','index.html'),'utf8');
 for(const a of ['data-view="field"','id="fieldContent"','id="journalSearch"','id="journalBirdFilter"','id="journalSort"','src="field-assistant.js"','MoOLVa 7.3'])assert.ok(html.includes(a),a);
 for(const a of ['function openForm(existingId=null,preferredBird=null)','data-edit=','window.BirdFieldAssistant?.render','markRecent','function renderJournal()'])assert.ok(js.includes(a),a);
});
