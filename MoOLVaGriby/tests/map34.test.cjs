'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {mkdtemp, readFile, rm, writeFile} = require('node:fs/promises');
const {tmpdir} = require('node:os');
const {createHash} = require('node:crypto');
const path = require('node:path');
const {createMapPacks} = require('../map-packs.cjs');

const map = Buffer.from('PMTiles test archive');
const checksum = createHash('sha256').update(map).digest('hex');
const catalog = [{id:'center',size:map.length,sha256:checksum}];
async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(),'moolva-map-'));
  t.after(() => rm(directory,{recursive:true,force:true}));
  return directory;
}

test('maps resume from disk and become openable only when the entire archive passes SHA-256',async t => {
  const directory = await fixture(t);
  const calls = [];
  const packs = createMapPacks(directory,async (name,options) => {
    if (name==='catalog.json') return Response.json(catalog);
    calls.push(options.headers.Range);
    const offset = 7;
    return new Response(map.subarray(offset),{status:206,headers:{'content-range':`bytes ${offset}-${map.length-1}/${map.length}`}});
  });
  await writeFile(path.join(directory,'center.pmtiles.part'),map.subarray(0,7));
  assert.equal((await packs.list()).find(x=>x.id==='center').state,'paused');
  assert.equal(await packs.start('center'),true);
  assert.deepEqual(calls,['bytes=7-']);
  assert.deepEqual(await readFile(packs.filename('center')),map);
  assert.equal((await packs.list()).find(x=>x.id==='center').state,'ready');
});

test('corrupt downloads are quarantined from the map list and unknown identifiers have no file path',async t => {
  const directory = await fixture(t);
  const packs = createMapPacks(directory,async name => name==='catalog.json'?Response.json(catalog):new Response(Buffer.alloc(map.length,1)));
  assert.equal(await packs.start('center'),false);
  const item=(await packs.list()).find(x=>x.id==='center');
  assert.equal(item.state,'error');
  assert.equal(item.received,0);
  assert.equal(packs.filename('../index'),null);
  assert.equal(await packs.start('../index'),false);
});
