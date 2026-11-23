'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('map is a permanent second button in the shipped HTML (no JS required to create it)',()=>{
 const html=read('index.html');
 const nav=html.slice(html.indexOf('<nav id="nav">'),html.indexOf('</nav>'));
 const positions=[nav.indexOf('data-page="catalog"'),nav.indexOf('id="primary-map-nav"'),nav.indexOf('data-page="compare"')];
 assert.ok(positions.every(n=>n>=0),'Missing permanent map or catalog button: '+positions);
 assert.ok(positions[0]<positions[1] && positions[1]<positions[2],'Map should be between Catalog and Compare');
 assert.match(nav,/id="primary-map-nav"[^>]*data-expedition30="open"/);
 assert.match(nav,/Карта грибных мест/);
 assert.match(html,/id="hero-map-link"/);
});
test('map page and geographic container are already present in HTML',()=>{
 const html=read('index.html');
 assert.match(html,/<section class="page" id="expedition30"/);
 assert.match(html,/<div id="exp-map" class="exp-map"/);
 assert.match(html,/www\.openstreetmap\.org\/#map=8/);
 assert.ok(html.indexOf('id="expedition30"')<html.indexOf('id="favorites"'));
});
test('legacy expedition mounts into the static page instead of abandoning initialization',()=>{
 const expedition=read('expedition30.js');
 assert.ok(expedition.includes("doc.getElementById('expedition30')||doc.createElement('section')"));
 assert.ok(expedition.includes("doc.getElementById('primary-map-nav')||doc.createElement('button')"));
 assert.ok(expedition.includes('if(!section.isConnected)main.append(section)'));
 assert.ok(expedition.includes('section.dataset.gribyMounted'));
 assert.ok(expedition.includes("e.target.closest('[data-expedition30=\"open\"]')"));
});
test('the free map has fallback if expedition 3.0 module fails',()=>{
 const freeMap=read('free-map32.js');
 assert.ok(freeMap.includes('const fallbackExp='));
 assert.ok(freeMap.includes('w.MoOLVaExpedition30||fallbackExp'));
 assert.ok(freeMap.includes("w.addEventListener('moolva:expedition-shown',show)"));
 assert.ok(freeMap.includes('L.map(surface'));
 const css=read('styles.css');
 assert.ok(css.includes('#primary-map-nav'));
 assert.ok(css.includes('overflow-y:auto'));
});
test('Windows GUI QA requires visible map button, selected navigation and a map screenshot',()=>{
 const main=read('main.cjs');
 for(const token of ['08-static-menu-check.json','08-static-navigation.json','08-visible-map-menu.png','buttonExists','secondInNav','mapCanvasDisplayed','zoomend'])assert.ok(main.includes(token),token);
 const pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.version,'4.1.0');
 assert.match(pkg.build.nsis.artifactName,/4\.1\.0-Setup/);
 assert.match(pkg.build.portable.artifactName,/4\.1\.0-Full-Portable/);
});
