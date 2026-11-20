'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const atlas=require('../smart-atlas40.js');

const catalog={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../catalog.js'),'utf8'),catalog);
const species=Array.from(catalog.window.MOOLVA_MUSHROOMS);
const item=id=>species.find(entry=>entry.id===id);

test('observations narrow the guide and change the next question',()=>{
  assert.equal(atlas.identify(species,{},[]).next,'surface');
  const results=atlas.identify(species,{surface:'pores'},[]);
  assert.ok(results.next && results.next!=='surface');
  assert.ok(results.ranked.some(row=>row.item.id==='g001' && row.matched.includes('surface')));
  assert.ok(results.ranked.every(row=>row.item.id!=='g031'));
  assert.notEqual(atlas.identify(species,{surface:'pores'},[results.next]).next,results.next);
});

test('incomplete or fragile traits do not become positive matches or false exclusions',()=>{
  const results=atlas.identify([item('g031'),item('g022')],{surface:'gills',volva:'no'},[]);
  assert.deepEqual(results.ranked.map(row=>row.item.id),['g022','g031']);
  assert.deepEqual(results.ranked[1].unknown,['volva']);
});

test('differences compare two recorded values and omit missing entries',()=>{
  const rows=atlas.comparison(item('g005'),item('g006'),true);
  assert.deepEqual(rows.map(row=>row.key),['ring']);
  assert.deepEqual(atlas.comparison(item('g001'),item('g002'),true).map(row=>row.key),['poreTone']);
  assert.ok(atlas.glossaryFor(item('g031')).includes('volva'));
});

test('atlas search accepts aliases, spelling mistakes and structural phrases',()=>{
  const search=atlas.makeSearch(species,text=>text);
  const scope=new Set(species);
  const ids=q=>search(q,scope).map(row=>row.id);
  assert.deepEqual(new Set(ids('обабок')),new Set(['g003','g004']));
  assert.equal(ids('борвик')[0],'g001');
  assert.equal(ids('Boletus edulis')[0],'g001');
  assert.equal(ids('ПОДБЕРЕЗОВИК')[0],'g003');
  assert.ok(ids('губка под шляпкой').includes('g001'));
  assert.ok(!ids('губка под шляпкой').includes('g031'));
  assert.deepEqual(search('обабок',new Set([item('g003')])).map(row=>row.id),['g003']);
});
