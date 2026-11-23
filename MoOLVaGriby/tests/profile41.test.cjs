'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {openProfile}=require('../profile41.cjs');

const key='moolva-griby-1.0-data';
const journal=(id)=>JSON.stringify({favorites:[id],diary:[]});
function fixture(t) {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'грибы-'));
  t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
  return {folder, backup:path.join(folder,'Backups'), profile:openProfile(folder,'4.1.0')};
}

test('preserves the previous profile and falls back past a damaged latest snapshot',t=>{
  const {profile,backup,folder}=fixture(t);
  const old={[key]:journal('g001'),'moolva-map-mode':'offline'};
  assert.deepEqual(profile.bootstrap(old,true),{values:old,recovered:0});
  profile.save({...old,[key]:journal('g002')});
  profile.save({...old,[key]:journal('g003')});
  const latest=fs.readdirSync(backup).filter(x=>x.startsWith('snapshot-')).sort().at(-1);
  fs.writeFileSync(path.join(backup,latest),'broken');
  const next=openProfile(folder,'4.1.0');
  assert.deepEqual(next.bootstrap({[key]:'broken'},true),{values:{...old,[key]:journal('g002')},recovered:2});
  assert.equal(JSON.parse(fs.readFileSync(path.join(backup,'before-4.1.json'),'utf8')).values[key],old[key]);
});

test('keeps five rolling copies and preserves intentional empty preferences',t=>{
  const {profile}=fixture(t);
  profile.bootstrap({},false);
  for(let i=0;i<7;i++)profile.save({[key]:journal('g'+i)});
  const empty=JSON.stringify({favorites:[],diary:[]});
  profile.save({[key]:empty});
  assert.equal(profile.backupCount,5);
  assert.deepEqual(profile.bootstrap({},true),{values:{[key]:empty},recovered:1});
  assert.equal(profile.backupCount,5);
});

test('remembers interrupted launches and clears the counter after a healthy launch',t=>{
  const {profile,folder}=fixture(t);
  profile.begin(false);
  assert.equal(profile.needsSafeMode,false);
  profile.begin(false);
  const next=openProfile(folder,'4.1.0');
  assert.equal(next.needsSafeMode,true);
  next.issue('renderer-killed');
  next.begin(true);
  next.ready();
  assert.equal(next.needsSafeMode,false);
  assert.equal(next.lastIssue,'renderer-killed');
});
