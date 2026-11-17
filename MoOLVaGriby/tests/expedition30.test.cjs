'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exp=require('../expedition30.js');
const context={window:{}};vm.runInNewContext(read('community30.js'),context);
const reports=context.window.MOOLVA_COMMUNITY30;
test('12 sourced community reports are approximate location anchors, not invented forest pins',()=>{
 assert.equal(reports.length,12);
 assert.equal(new Set(reports.map(x=>x.id)).size,12);
 for(const p of reports){assert.ok(exp.acceptedReport(p),p.name);assert.ok(p.approxKm>=4);assert.ok(p.source.startsWith('https://'));assert.match(p.details,/\S/);}
});
test('coordinate guard rejects points outside region',()=>{
 assert.ok(exp.validCoordinate(56.4,43.4));
 assert.equal(exp.validCoordinate(59,44),false);
 assert.equal(exp.validCoordinate(56,0),false);
 assert.equal(exp.acceptedReport({...reports[0],source:'https://fake.example/data'}),false);
});
test('public iNaturalist coordinates are coarsened, and hidden or uncertain records excluded',()=>{
 const a=[{lat:56.333,lon:43.577,grade:'research',latin:'Boletus edulis'},
 {lat:56.329,lon:43.577,grade:'research',latin:'Boletus edulis'},
 {lat:56.349,lon:43.577,grade:'research',obscured:true},
 {lat:56.345,lon:43.577,grade:'casual'},
 {lat:90,lon:0,grade:'research'}];
 const c=exp.aggregate(a);
 assert.equal(c.reduce((n,x)=>n+x.count,0),2);
 assert.equal(c.length,1);
 assert.notEqual(c[0].lat,a[0].lat);
 assert.equal(c[0].names[0],'Boletus edulis');
});
test('private points require real geographic coordinates and GPX escapes user labels',()=>{
 const p=exp.importPoint({name:'Мой лес & <овраг>',lat:56.35,lon:43.55,note:'<private>'});
 assert.ok(p);
 assert.equal(exp.importPoint({name:'bad',lat:80,lon:40}),null);
 const g=exp.gpx([p],[{lat:56.35,lon:43.55}]);
 assert.match(g,/&amp; &lt;овраг&gt;/);
 assert.match(g,/&lt;private&gt;/);
 assert.match(g,/<trkpt lat="56.35" lon="43.55"/);
});
test('version 3.2 is packaged with map assets and screenshot smoke checks',()=>{
 const pkg=JSON.parse(read('package.json')),html=read('index.html'),main=read('main.cjs'),css=read('expedition30.css');
 assert.equal(pkg.version,'3.2.0');
 for(const n of ['community30.js','expedition30.js','expedition30.css'])assert.ok(pkg.build.files.includes(n),n);
 assert.ok(html.includes('<script src="expedition30.js"></script>'));
 assert.ok(main.includes('05-expedition.png'));
 assert.ok(main.includes('expedition.reports<10'));
 assert.ok(css.includes('.exp-map'));
});