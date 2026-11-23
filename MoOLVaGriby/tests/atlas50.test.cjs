'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const data=require('../atlas50-data.js');
const core=require('../atlas50.js');
const atlas=require('../smart-atlas40.js');

function fixture() {
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../catalog.js'),'utf8'),context);
  const species=Array.from(context.window.MOOLVA_MUSHROOMS);
  return {species,groups:core.createCatalog(core.validate(data),species)};
}

test('built-in comparisons resolve at least three distinct species per group',()=>{
  const {groups}=fixture();
  assert.equal(groups.length,5);
  const rows=core.matrix(groups[0],atlas);
  assert.equal(rows.find(row=>row.key==='surface').status,'same');
  assert.equal(rows.find(row=>row.key==='poreTone').status,'differs');
  assert.equal(rows.find(row=>row.key==='stem').incomplete,true);
  assert.equal(groups[0].entries.find(x=>x.item.id==='g002').source.includes('naturalis.nl'),true);
});

test('external packages validate the schema and never accept executable URLs or duplicate entries',()=>{
  const invalid=structuredClone(data);
  invalid.groups[0].entries[0][2]='javascript:alert(1)';
  assert.throws(()=>core.validate(invalid),/Некорректный/);
  invalid.groups[0].entries[0]=invalid.groups[0].entries[1];
  assert.throws(()=>core.validate(invalid),/Некорректный/);
  assert.throws(()=>core.readPackage(' '.repeat(core.maxSize+1)),/512/);
  assert.equal(core.resolvePackages(data,{current:{...data,version:2}}).version,2);
  assert.equal(core.resolvePackages(data,{current:invalid}).version,1);
});

test('published species reuse existing identities and new publication cards have stable IDs',()=>{
  const {species}=fixture();
  const initial=species.length;
  core.createCatalog(core.validate(data),species);
  assert.equal(species.length,initial);
  const card=species.find(x=>x.latin==='Ganoderma lucidum');
  assert.equal(card.id,'region50-ganoderma-lucidum');
  assert.equal(card.risk,'неопределён');
});

test('training uses rows with a documented, unique answer for the full group',()=>{
  const {groups}=fixture();
  const exercises=core.practice(groups,atlas);
  assert.ok(exercises.length>=6);
  assert.ok(exercises.every(question=>!question.row.incomplete&&question.row.values.indexOf(question.value)===question.index));
});
