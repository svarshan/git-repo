'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('7.2 bundles authentic offline OSM roads forests lakes waterways and settlements',()=>{
 const file=path.join(root,'app','atlas-ultra-data.js');
 assert.ok(fs.existsSync(file),'Missing true regional OSM file');
 assert.ok(fs.statSync(file).size>100000,'OSM map too small or incomplete');
 const scope={window:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),scope,{timeout:7500});
 const map=scope.window.MOOLVA_ULTRA_MAP;
 assert.equal(map.license,'ODbL 1.0');
 // Accept only configured, region-specific OSM PBF sources; the previous
 // single-filename assertion incorrectly rejected the verified RU-NIZ source.
 const allowedSources=[
  'https://www.osmlab.ru/regions/RU-NIZ.pbf',
  'https://geo2day.com/russia/volga_federal_district/nizhny_novgorod_oblast.pbf',
  'https://osmtoday.com/russia/volga_federal_district/nizhny_novgorod_oblast.pbf'
 ];
 assert.ok(allowedSources.includes(map.sourceUrl),'Unexpected regional OSM PBF source: '+map.sourceUrl);
 assert.match(map.sourceSha256,/^[0-9a-f]{64}$/);
 for(const [key,name] of [['roads','road'],['rivers','river'],['lakes','lake'],['forests','forest'],['places','place']]){
  assert.ok(map.selectedCounts[name]>=50,'Missing true OSM feature: '+key);
  assert.ok(map[key].length>=50);
 }
});
test('7.2 renders toggleable vector layers and searchable named places',()=>{
 const html=read('app/index.html'),map=read('app/habitat-atlas.js'),css=read('app/living-world.css');
 for(const id of ['habitatUltraVector','habitatTownSearch','habitatUltraStatus','habitatLayerRoads','habitatLayerRivers','habitatLayerLakes','habitatLayerForests','habitatShowSightings'])
   assert.match(html,new RegExp('id="'+id+'"'),id);
 assert.match(html,/src="atlas-ultra-data\.js"/);
 for(const name of ['buildUltraLayers','addGeometry','updateTownOptions','pointermove','focusTown','species','placeSummary'])
  assert.ok(map.includes(name),name);
 for(const name of ['roads','forests','lakes','rivers']) assert.ok(css.includes('.ultra-'+name),name);
 new Function(map);
});
test('7.2 retains Bird AI model and original encyclopedia',()=>{
 const html=read('app/index.html'),main=read('main.cjs');
 assert.match(html,/src="living6\.js"/);
 assert.match(html,/id="birdAIDiagnostics"/);
 assert.match(main,/onnxruntime-node/);
 assert.match(html,/habitatPins/);
 assert.match(html,/compare6\.js/);
});
test('7.2 archives separate Portable and Setup',()=>{
 const pkg=JSON.parse(read('package.json')),workflow=read('../.github/workflows/ptitsy-nn-windows.yml');
 assert.equal(pkg.version,'8.1.0');
 assert.equal(pkg.build.nsis.artifactName,'MoOLVa-8.1-Setup-${arch}.exe');
 assert.equal(pkg.build.portable.artifactName,'MoOLVa-8.1-Portable-${arch}.exe');
 assert.match(workflow,/Ptitsy-NN-8\.1-Portable-only/);
 assert.match(workflow,/gh release create \$tag/);
 assert.match(workflow,/make_ultra_map\.py/);
});
