'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(dir,p),'utf8');
const g=require('../google31.js');
const context={window:{}};vm.runInNewContext(read('community30.js'),context);
const social=context.window.MOOLVA_COMMUNITY30;
test('Google Maps URLs work without API key for actual coordinates',()=>{
 const p={lat:56.35,lon:43.6,kind:'personal'};
 assert.equal(g.googleUrl(p.lat,p.lon),'https://www.google.com/maps/search/?api=1&query=56.350000%2C43.600000');
 assert.equal(g.googleUrl(90,0),null);
 assert.equal(g.googleSatelliteUrl(56.35,43.6,16),'https://www.google.com/maps/@?api=1&map_action=map&center=56.350000%2C43.600000&zoom=16&basemap=satellite');
 assert.equal(g.googleSatelliteUrl(91,0),null);
 assert.ok(g.pointAccuracy(p).includes('Точная личная'));
});
test('community place is labelled approximate and scientific observations remain aggregates',()=>{
 assert.equal(social.length,12);
 assert.ok(social.every(x=>g.pointAccuracy({...x,kind:'report'}).includes('окрестности населённого пункта')));
 assert.match(g.pointAccuracy({kind:'observations'}),/не точное место/);
 const obs={lat:56.4,lon:43.7,kind:'observations',count:2};
 const points=g.visiblePoints({reportData:social,observationCells:[obs]},[{id:'my',kind:'personal',lat:56.35,lon:43.6}],{reports:true,observations:true,personal:true});
 assert.equal(points.length,14);
 assert.equal(points.filter(x=>x.kind==='personal').length,1);
});
test('map layers can be hidden independently and malformed coordinates ignored',()=>{
 const p=g.visiblePoints({reportData:social,observationCells:[]},[{lat:999,lon:43.6}],{reports:false,observations:false,personal:true});
 assert.equal(p.length,0);
 assert.equal(g.validCoord(56.35,43.6),true);
 assert.equal(g.validCoord(59,43.6),false);
});
test('Google map integration is shipped, API key is never embedded and old data untouched',()=>{
 const pkg=JSON.parse(read('package.json')),html=read('index.html'),script=read('google31.js'),main=read('main.cjs'),css=read('google31.css');
 assert.equal(pkg.version,'3.2.0');
 assert.ok(pkg.build.files.includes('google31.js'));
 assert.ok(pkg.build.files.includes('google31.css'));
 assert.ok(html.includes('<script src="google31.js"></script>'));
 assert.ok(main.includes('www\\.google\\.com\\/maps\\/'));
 assert.ok(main.includes('06-google-maps.png'));
 assert.ok(script.includes('maps.googleapis.com/maps/api/js?key='));
 assert.ok(!/AIza[A-Za-z0-9_-]{30,}/.test(script),'no embedded Google key');
 assert.ok(!script.includes("localStorage.setItem('google"),'Google key must not be persisted');
 assert.ok(css.includes('.gm31-google-canvas'));
});
test('precise public observations require explicit measurement precision and common taxa',()=>{
 const make=changes=>({id:1,grade:'research',latin:'Boletus edulis',lat:56.3,lon:43.7,date:'2026-09-10',accuracyM:25,obscured:false,source:'https://www.inaturalist.org/observations/123',...changes});
 const exact=g.exactPublicObservations([make({}),make({id:2,latin:'Rare species'}),make({id:3,accuracyM:0}),make({id:4,accuracyM:450}),make({id:5,obscured:true}),make({id:6,source:'https://bad.example.org'})]);
 assert.equal(exact.length,1);
 assert.equal(exact[0].kind,'public-exact');
 assert.match(g.pointAccuracy(exact[0]),/±25 м/);
 const selected=g.visiblePoints({reportData:[],observationCells:[]},[],{reports:false,observations:false,personal:false,exact:true},exact);
 assert.equal(selected.length,1);
});
