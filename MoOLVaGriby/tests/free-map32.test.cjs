'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const map=require('../free-map32.js');
const sample={reportData:[{id:'bor',name:'Бор',area:'Бор',lat:56.3581,lon:44.0748,approxKm:15}],
 observationCells:[{lat:56.40,lon:44.15,count:2,kind:'observations'}]};
test('geographic bounds reject invalid positions and preserve real stored coordinates',()=>{
 assert.equal(map.valid(56.4,44.1),true);
 assert.equal(map.valid(59,44),false);
 assert.equal(map.valid(56.4,0),false);
 const center=map.centerOf(sample.reportData);
 assert.ok(Math.abs(center.lat-56.3581)<0.00001);
});
test('source-layer toggles separate community approximation, public aggregate and private GPS',()=>{
 const mine=[{kind:'personal',name:'Личная точка',lat:56.32,lon:43.86}],
 exact=[{kind:'public-exact',latin:'Boletus edulis',lat:55.67,lon:43.7,accuracyM:22}];
 const all=map.collection(sample,mine,exact,{report:true,observations:true,personal:true,exact:true});
 assert.equal(all.length,4);
 assert.ok(map.present(all[0]).includes('окрестности'));
 assert.match(map.present(all[1]),/Обобщённые/);
 assert.match(map.present(all[2]),/Личное/);
 assert.match(map.present(all[3]),/±22/);
 assert.equal(map.collection(sample,mine,exact,{report:false,observations:false,personal:true,exact:false}).length,1);
});
test('offline Leaflet asset is packaged and labels/zoom are controlled by real map engine',()=>{
 const p=JSON.parse(read('package.json')),html=read('index.html'),js=read('free-map32.js'),css=read('free-map32.css');
 assert.equal(p.version,'4.1.0');
 assert.equal(p.dependencies.leaflet,'1.9.4');
 assert.ok(p.build.files.includes('node_modules/leaflet/dist/**/*'));
 assert.ok(p.build.files.includes('free-map32.js'));
 assert.ok(html.includes('node_modules/leaflet/dist/leaflet.js'));
 assert.ok(html.includes('node_modules/leaflet/dist/leaflet.css'));
 assert.ok(html.includes('free-map32.js'));
 assert.ok(js.includes('L.tileLayer('));
 assert.ok(js.includes('https://tile.openstreetmap.org/{z}/{x}/{y}.png'));
 assert.ok(js.includes('scrollWheelZoom:true'));
 assert.ok(js.includes('map.invalidateSize('));
 assert.ok(js.includes('zoomControl:true'));
 assert.ok(css.includes('.fm32-map'));
 const main=read('main.cjs'),wf=read('../.github/workflows/moolva-griby-windows.yml');
 assert.ok(main.includes('07-free-interactive-map.png'));
 assert.ok(main.includes(".leaflet-control-zoom-in"));
 assert.ok(main.includes(".leaflet-control-zoom-out"));
 assert.ok(main.includes("zoomend"));
 assert.ok(main.includes("MoOLVa-Griby/4.1.0"));
 assert.ok(wf.includes("07-free-interactive-map.png"));
});
