'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(base,p),'utf8');
test('7.9 sidebar keeps main tabs visible and stores collapse locally',()=>{
 const html=read('app/index.html'),js=read('app/sidebar76.js'),css=read('app/sidebar76.css');
 assert.match(html,/id="m76Toggle"/);
 assert.match(html,/id="m76SidebarCompact"/);
 assert.match(html,/id="m76-find"/);
 assert.match(html,/id="m76-library"/);
 assert.match(html,/src="sidebar76.js"/);
 assert.match(html,/href="sidebar76.css"/);
 assert.match(html,/id="m76ExpeditionStats"/);
 assert.match(html,/src="expedition76.js"/);
 assert.match(js,/ptitsy-nn.sidebar.v76/);
 assert.match(js,/localStorage.setItem/);
 assert.match(js,/aria-expanded/);
 assert.match(css,/m76-sidebar-compact/);
});
test('7.9 all former navigation targets remain reachable; service lives in settings',()=>{
 const html=read('app/index.html'),start=html.indexOf('<nav aria-label="Разделы приложения">'),end=html.indexOf('</nav>',start),nav=html.slice(start,end);
 for(const id of ['catalog','birdai','map','journal','pro75','field','assistant','photoid','soundid','comparebirds6','lab','favorites','gallery','articles','academy','calendar','conservation','settings']){
  assert.ok(nav.includes('data-view="'+id+'"'),'Lost navigation: '+id);
 }
 for(const id of ['about','expedition'])assert.ok(html.includes('data-view="'+id+'"'),'Lost service screen '+id);
 assert.ok(!nav.includes('data-view="about"'),'About must be inside Settings');
 assert.ok(!nav.includes('data-view="expedition"'),'Expedition must be inside Settings');
 assert.ok(html.includes('data-jump="field-recent"'));
});
test('7.9 keeps offline user data and both EXEs',()=>{
 const p=JSON.parse(read('package.json')),html=read('app/index.html'),workflow=read('../.github/workflows/ptitsy-nn-windows.yml');
 assert.equal(p.version,'7.9.0');
 assert.equal(p.build.nsis.artifactName,'MoOLVa-7.9-Setup-${arch}.exe');
 assert.equal(p.build.portable.artifactName,'MoOLVa-7.9-Portable-${arch}.exe');
 assert.ok(html.includes("connect-src 'none'"));
 assert.ok(workflow.includes('scripts/voices_298.py'));
 assert.ok(workflow.includes('scripts/fill_missing76.py'));
 assert.ok(read('app/app.js').includes('ptitsy-nn.journal.v1'));
 assert.ok(read('app/ui3.js').includes('ptitsy-nn.ui3.settings.v1'));
});