'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(ROOT,n),'utf8');
test('4.0 is an offline regional habitat atlas, not a personal observation map',()=>{
 const html=read('app/index.html');
 for(const id of ['habitatAtlas','habitatPins','habitatSpecies','habitatTooltip','habitatSearch','habitatViewport','habitatZoomIn','habitatZoomOut'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/nn-oblast-map\.svg/);
 for(const view of ['assistant','photoid','soundid','academy','conservation','expedition'])assert.ok(html.includes('id="'+view+'"'),view);
 assert.match(html,/src="habitat-data\.js"/);
 assert.match(html,/src="habitat-atlas\.js"/);
 assert.match(html,/src="living-world\.js"/);
 assert.match(html,/src="data\.js"/);
 assert.ok(html.indexOf('habitat-data.js')<html.indexOf('habitat-atlas.js'));
 assert.match(html,/Обобщённые зоны/);
 assert.doesNotMatch(html,/<script[^>]+src="https?:/);
 assert.match(html,/connect-src 'none'/);
});
test('habitat GIS pipeline uses sourced map and filters uncertain, sensitive, out-of-region samples',()=>{
 const py=read('scripts/make_habitat.py');
 for(const token of ['gbif.org','wikimedia','stateProvince','gadm','coordinateUncertaintyInMeters','informationWithheld','dataGeneralizations','GRID_LAT','GRID_LON','n<3','len(dates','sampledRecords','hasGeospatialIssue','license']){
  assert.ok(py.includes(token),'Missing data safety gate: '+token);
 }
 const map=path.join(ROOT,'app','nn-oblast-map.svg'),data=path.join(ROOT,'app','habitat-data.js');
 assert.ok(fs.existsSync(map),'Region map must be packaged');
 assert.ok(fs.statSync(map).size>12000,'Region map is a real SVG, not a placeholder');
 assert.ok(fs.existsSync(data),'Coarsened habitat data must be packaged');
 const box={window:{}};vm.runInNewContext(read('app/habitat-data.js'),box);
 const record=box.window.HABITAT_DATA;
 assert.ok(Array.isArray(record.cells));
 assert.ok(record.cells.length>0, "Do not release a map with zero verified bird encounter zones");
 assert.ok(record.bounds && record.source);
 assert.ok(record.sampledRecords>=0);
 for(const c of record.cells){
  assert.ok(c.lat>=record.bounds.south&&c.lat<=record.bounds.north);
  assert.ok(c.lon>=record.bounds.west&&c.lon<=record.bounds.east);
  assert.ok(c.species.every(x=>x.n>=3&&!('gbifId' in x)&&!('exactLatitude' in x)));
 }
});
test('existing diary, voice player and licensed photos remain available',()=>{
 const app=read('app/app.js'),html=read('app/index.html'),tools=read('app/living-world.js');
 for(const key of ['ptitsy-nn.journal.v1','ptitsy-nn.favorites.v1','BirdAudioPro?.mountCard'])assert.ok(app.includes(key));
 for(const id of ['fieldContent','compareContent','labContent','favoriteGrid','journalItems','grid'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(tools,/localStorage.getItem\('ptitsy-nn.journal.v1'\)/);
 assert.match(html,/Автоматического AI-распознавания/);
});
