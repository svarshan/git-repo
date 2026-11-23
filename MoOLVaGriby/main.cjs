'use strict';
const {app,BrowserWindow,shell,session,protocol,ipcMain,dialog,clipboard}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const {randomUUID}=require('node:crypto');
const {openProfile}=require('./profile41.cjs');
const {pathToFileURL}=require('node:url');
const {readMapRange}=require('./offline-map-file.cjs');
const regions=require('./map-regions.json');
const entry=path.join(__dirname,'index.html');
const entryUrl=pathToFileURL(entry).href;
protocol.registerSchemesAsPrivileged([{
 scheme:'moolva-map', privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}
}]);
app.setAppUserModelId('ru.moolva.griby');
app.commandLine.appendSwitch('lang','ru-RU');
const evidenceFlag=process.argv.find(x=>x.startsWith('--moolva-evidence-dir='));
const safeFlag=process.argv.includes('--moolva-safe-mode');
const profileCheck=evidenceFlag && process.argv.find(x=>x.startsWith('--moolva-profile-check='))?.split('=')[1];
if(process.env.PORTABLE_EXECUTABLE_DIR && !app.commandLine.hasSwitch('user-data-dir')){
 const profile=path.join(process.env.PORTABLE_EXECUTABLE_DIR,'MoOLVa-Griby-Data');
 try {
  fs.mkdirSync(profile,{recursive:true});
  const probe=path.join(profile,'.write-'+randomUUID());
  fs.closeSync(fs.openSync(probe,'wx'));
  fs.unlinkSync(probe);
  app.setPath('userData',profile);
 } catch {
  dialog.showErrorBox('MoOLVa Грибы','Нет доступа для записи рядом с EXE. Перенесите программу в папку, где можно сохранять личные находки.');
  app.exit(1);process.exit(1);
 }
}
if(!evidenceFlag&&!app.requestSingleInstanceLock()){app.quit();process.exit(0);}
const profilePath=app.getPath('userData');
let existingProfile=fs.existsSync(path.join(profilePath,'Local Storage'));
const profile=openProfile(profilePath,app.getVersion());
let win;
let allowLiveMap=false;
let partialMap;
let safeMode=safeFlag;
let recoveryUsed=false;
let launchWatchdog;
let readyTimer;
let profileError=false;
let lastIssue='';

function focusWindow(){
 if(!win||win.isDestroyed())return;
 if(win.isMinimized())win.restore();
 win.show();
 win.focus();
}
app.on('second-instance',focusWindow);

function recordIssue(reason){
 lastIssue=reason;
 try{profile.issue(reason);}catch{profileError=true;}
}
function openAtlas(){
 try{profile.begin(safeMode);}catch{profileError=true;}
 clearTimeout(readyTimer);
 clearTimeout(launchWatchdog);
 if(!evidenceFlag||profileCheck)launchWatchdog=setTimeout(()=>recoverWindow('start-timeout'),15000);
 win.loadFile(entry).catch(error=>{
   if((!evidenceFlag||profileCheck)&&error.code!=='ERR_ABORTED')recoverWindow('page-load-failed');
 });
}
function recoverWindow(reason){
 recordIssue(reason);
 clearTimeout(readyTimer);
 clearTimeout(launchWatchdog);
 if(!win||win.isDestroyed()||(evidenceFlag&&!profileCheck))return;
 if(!safeMode&&!recoveryUsed){
   recoveryUsed=true;
   safeMode=true;
   openAtlas();
   return;
 }
 dialog.showErrorBox('MoOLVa Грибы','Не удалось открыть атлас. Закройте программу и повторите запуск. Резервные копии находятся в папке MoOLVa-Griby-Data/Backups.');
 app.exit(2);
}
function checkRendererReady(){
 clearTimeout(readyTimer);
 readyTimer=setTimeout(()=>{
   clearTimeout(launchWatchdog);
   try{profile.ready();}catch{profileError=true;}
 },1200);
}
function createWindow(){
 win=new BrowserWindow({width:1420,height:920,minWidth:960,minHeight:680,autoHideMenuBar:true,show:false,backgroundColor:'#0a1512',
  icon:path.join(__dirname,'build','moolva-griby.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(({url})=>{
  if(/^https:\/\/www\.google\.com\/maps\//.test(url)||/^https:\/\/(commons\.wikimedia\.org|www\.inaturalist\.org|www\.gbif\.org|github\.com|www\.poison\.org|www\.mediawiki\.org|www\.nn\.ru|nn\.aif\.ru|niann\.ru|www\.openstreetmap\.org|www\.mushroomexpert\.com|www\.first-nature\.com|(?:old\.|www\.)?kerzhenskiy\.ru|www\.unn\.ru|mushrooms\.linnaeus\.naturalis\.nl|protomaps\.com)\//.test(url))shell.openExternal(url);
  return {action:'deny'};
 });
 win.webContents.on('will-navigate',(event,url)=>{if(url!==entryUrl)event.preventDefault();});
 win.once('ready-to-show',()=>win.show());
 win.webContents.on('did-finish-load',checkRendererReady);
 win.webContents.on('render-process-gone',(_event,details)=>recoverWindow('renderer-'+details.reason));
 win.on('unresponsive',()=>recordIssue('window-unresponsive'));
 win.on('closed',()=>{
   clearTimeout(readyTimer);
   clearTimeout(launchWatchdog);
   win=null;
 });
 if(profileCheck){
  verifyPortableProfile(evidenceFlag.slice('--moolva-evidence-dir='.length));
 }else if(evidenceFlag){
  const folder=evidenceFlag.slice('--moolva-evidence-dir='.length);
  const failure=setTimeout(()=>{fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'gui-error.txt'),'Electron screenshot timed out');app.exit(2);},65000);
  win.webContents.once('did-finish-load',async()=>{
   try{
    await new Promise(resolve=>setTimeout(resolve,1400));
    fs.mkdirSync(folder,{recursive:true});
    const image=await win.webContents.capturePage();
    const out=path.join(folder,'01-glavnaya.png');
    fs.writeFileSync(out,image.toPNG());
    const checks=await win.webContents.executeJavaScript('({species:window.MOOLVA_MUSHROOMS?.length||0, cards:document.querySelectorAll(".mush-card").length,features:!!window.MoOLVa20, title:document.title})',true);
    fs.writeFileSync(path.join(folder,'gui-smoke.json'),JSON.stringify({...checks,screenshot:out},null,2));
    if(checks.species<53||checks.cards<12||!checks.features)throw Error('Catalog failed GUI checks '+JSON.stringify(checks));
    const staticNav=await win.webContents.executeJavaScript(`(()=>{
      const btn=document.querySelector('#primary-map-nav');
      const page=document.querySelector('main > #expedition30');
      const rect=btn?.getBoundingClientRect();
      return {visibleEntries:[...document.querySelectorAll('#nav > button,#nav > details > summary')].filter(e=>e.getBoundingClientRect().height>0).length,
        buttonExists:!!btn, buttonLabel:btn?.textContent.trim()||'', mapPageExists:!!page,
        displayed:!!btn && !!rect && rect.width>30 && rect.height>18 && rect.top>=0 && rect.bottom<=window.innerHeight,
        secondInNav:btn?.parentElement?.querySelectorAll('button')?.[1]===btn};
    })()`,true);
    fs.writeFileSync(path.join(folder,'08-static-menu-check.json'),JSON.stringify(staticNav,null,2));
    if(!staticNav.buttonExists||!staticNav.mapPageExists||!staticNav.displayed||!staticNav.secondInNav||!staticNav.buttonLabel.includes('Карта') || staticNav.visibleEntries!==4)
      throw Error('Main map menu is missing or invisible '+JSON.stringify(staticNav));
    for(const [name,target] of [['02-opredelitel.png','id20'],['03-karta-nablyudenii.png','geo20'],['04-foto-pomoshchnik.png','photo20']]){
      await win.webContents.executeJavaScript('document.querySelector('+JSON.stringify('[data-stage20="'+target+'"]')+').click()');
      await new Promise(r=>setTimeout(r,200));
      fs.writeFileSync(path.join(folder,name),(await win.webContents.capturePage()).toPNG());
    }
    const smartAtlas=await win.webContents.executeJavaScript(`(()=>{
      const byId=id=>document.getElementById(id);
      const click=selector=>document.querySelector(selector).click();
      click('[data-page="catalog"]');
      const search=byId('search');
      const matches=(value,ids)=>{
        search.value=value;
        search.dispatchEvent(new Event('input'));
        return ids.every(id=>byId('cards').querySelector('[data-open="'+id+'"]'));
      };
      const synonyms=matches('обабок',['g003','g004']);
      const typo=matches('борвик',['g001']);
      const phrase=matches('губка под шляпкой',['g001'])&&!byId('cards').querySelector('[data-open="g031"]');
      matches('',[]);
      click('[data-goto20="id20"]');
      const first=byId('atlas40-question').querySelector('h3').textContent;
      click('[data-atlas-answer="pores"]');
      const next=byId('atlas40-question').querySelector('h3').textContent;
      const adaptive=first!==next && byId('id20').classList.contains('active') &&
        byId('atlas40-results').textContent.includes('Совпало') &&
        !byId('atlas40-results').querySelector('[data-open="g031"]');
      click('#atlas40-back');
      const back=byId('atlas40-question').querySelector('h3').textContent===first;
      click('[data-page="compare"]');
      byId('pickA').value='g005';
      byId('pickB').value='g006';
      click('#atlas40-differences');
      const rows=[...byId('atlas40-table').querySelectorAll('tbody tr')];
      const differences=rows.length===1 && rows[0].dataset.trait==='ring' &&
        rows[0].textContent.includes('Кольцо отсутствует');
      byId('pickA').value='g001';
      byId('pickB').value='g002';
      byId('pickB').dispatchEvent(new Event('change'));
      const maturePores=byId('atlas40-table').querySelector('[data-trait="poreTone"]').textContent.includes('Розовые');
      byId('pickA').value='g005';
      byId('pickB').value='g006';
      byId('pickB').dispatchEvent(new Event('change'));
      click('#comparison [data-open="g005"]');
      click('#detail [data-atlas-term="ring"]');
      const dialog=byId('atlas40-glossary');
      const glossary=dialog.open && byId('atlas40-term-name').textContent==='Кольцо' &&
        byId('atlas40-diagram').dataset.part==='ring';
      dialog.close();
      click('#closeModal');
      click('[data-page="compare"]');
      return {synonyms,typo,phrase,adaptive,back,differences,maturePores,glossary};
    })()`,true);
    fs.writeFileSync(path.join(folder,'11-smart-atlas.json'),JSON.stringify(smartAtlas,null,2));
    if(!Object.values(smartAtlas).every(Boolean))throw Error('Smart Atlas GUI failed '+JSON.stringify(smartAtlas));
    fs.writeFileSync(path.join(folder,'11-smart-atlas.png'),(await win.webContents.capturePage()).toPNG());
    const encyclopedia=await win.webContents.executeJavaScript(`(()=>{
      const get=id=>document.getElementById(id);
      const click=selector=>document.querySelector(selector).click();
      click('[data-page="lookalikes"]');
      const matrix=get('atlas50-comparison');
      const groups=get('atlas50-group').options.length;
      const multi=groups===5 && matrix.querySelectorAll('thead [data-open]').length===3 &&
        matrix.querySelector('[data-trait="poreTone"][data-relation="differs"]');
      click('#atlas50-differences');
      const filtered=!matrix.querySelector('[data-trait="surface"]');
      click('#atlas50-comparison [data-open="g001"]');
      const passport=Boolean(get('detail').querySelector('[data-atlas50-group="brown-boletes"]'));
      click('#detail [data-atlas50-group="brown-boletes"]');
      const linked=Boolean(get('lookalikes').classList.contains('active') && get('overlay').hidden);
      click('[data-page="catalog"]');
      const search=get('search');
      search.value='Ganoderma lucidum';
      search.dispatchEvent(new Event('input'));
      click('#cards [data-open]');
      const publication=Boolean(get('detail').querySelector('.atlas50-source a[href*="kerzhenskiy"]'));
      click('#closeModal');
      search.value='';
      search.dispatchEvent(new Event('input'));
      click('[data-goto20="id20"]');
      click('[data-atlas-answer="pores"]');
      const earlier=get('atlas40-question').querySelector('[data-atlas-edit="surface"]');
      earlier.value='gills';
      earlier.dispatchEvent(new Event('change'));
      const editable=Boolean(get('atlas40-results').querySelector('details') &&
        get('atlas40-results').textContent.includes('в атласе «Трубочки / поры»'));
      click('#atlas40-reset');
      click('[data-page="training"]');
      click('#atlas50-lesson [data-atlas50-answer]');
      const trainer=Boolean(get('atlas50-feedback').textContent && get('atlas50-next') &&
        localStorage.getItem('moolva-griby-atlas-v50-training'));
      click('[data-page="lookalikes"]');
      return {groups,multi:Boolean(multi),filtered,passport,linked,publication,editable,trainer};
    })()`,true);
    if(!Object.values(encyclopedia).every(Boolean))throw Error('Encyclopedia GUI failed '+JSON.stringify(encyclopedia));
    await win.webContents.executeJavaScript("document.querySelector('#atlas50-comparison').scrollIntoView()");
    fs.writeFileSync(path.join(folder,'14-encyclopedia.png'),(await win.webContents.capturePage()).toPNG());
    await win.webContents.executeJavaScript("document.querySelector('#primary-map-nav').click()");
    await new Promise(r=>setTimeout(r,250));
    fs.writeFileSync(path.join(folder,'05-expedition.png'),(await win.webContents.capturePage()).toPNG());
    const expedition=await win.webContents.executeJavaScript("({shown:document.querySelector('#expedition30')?.classList.contains('active'),reports:window.MoOLVaExpedition30?.reportData?.length||0,pins:document.querySelectorAll('#exp-map-pins .exp-pin').length})",true);
    fs.writeFileSync(path.join(folder,'expedition-smoke.json'),JSON.stringify(expedition,null,2));
    if(!expedition.shown||expedition.reports<10||expedition.pins<10)throw Error('Expedition map failed GUI checks '+JSON.stringify(expedition));
    const googleChecks=await win.webContents.executeJavaScript("({panel:!!document.querySelector('#gm31-panel'),url:window.MoOLVaGoogle31Core?.googleUrl(56.35,43.60)||'',hasPrivateLink:!!document.querySelector('#gm31-google-selected')})",true);
    fs.writeFileSync(path.join(folder,'google31-smoke.json'),JSON.stringify(googleChecks,null,2));
    if(!googleChecks.panel||!googleChecks.hasPrivateLink||!googleChecks.url.startsWith('https://www.google.com/maps/search/?api=1'))throw Error('Google Maps integration failed '+JSON.stringify(googleChecks));
    fs.writeFileSync(path.join(folder,'06-google-maps.png'),(await win.webContents.capturePage()).toPNG());
    const freeMap=await win.webContents.executeJavaScript(`(async()=>{document.querySelector('#primary-map-nav').click(); await new Promise(r=>setTimeout(r,800)); const api=window.MoOLVaFreeMap32; const map=api?.getMap?.(); const before=map?.getZoom()||0; const btnIn=document.querySelector('#fm32-map .leaflet-control-zoom-in'); const btnOut=document.querySelector('#fm32-map .leaflet-control-zoom-out'); const waitZoom=async(btn)=>{if(!map||!btn)return; const done=new Promise(resolve=>{map.once('zoomend',resolve);setTimeout(resolve,1400);});btn.click();await done;}; await waitZoom(btnIn); const after=map?.getZoom()||0; await waitZoom(btnOut); const afterOut=map?.getZoom()||0; return {leaflet:!!window.L, mapReady:!!map, before, after, afterOut, ...api?.getStatus?.(), townLabelsLayer:!!document.querySelector('#fm32-map .leaflet-tile-pane'), attribution:!!document.querySelector('#fm32-map .leaflet-control-attribution')};})()`,true);
    const mapByMenu=await win.webContents.executeJavaScript(`({
      pageActive:document.querySelector('#expedition30')?.classList.contains('active'),
      navSelected:document.querySelector('#primary-map-nav')?.classList.contains('selected'),
      mapCanvasDisplayed:(()=>{const e=document.querySelector('#fm32-map');return !!e&&!e.hidden&&e.getBoundingClientRect().width>100;})()
    })`,true);
    fs.writeFileSync(path.join(folder,'08-static-navigation.json'),JSON.stringify(mapByMenu,null,2));
    if(!mapByMenu.pageActive||!mapByMenu.navSelected||!mapByMenu.mapCanvasDisplayed)
      throw Error('Visible main map menu cannot open Leaflet '+JSON.stringify(mapByMenu));
    fs.writeFileSync(path.join(folder,'free-map32-smoke.json'),JSON.stringify(freeMap,null,2));
    if(!freeMap.leaflet||!freeMap.mapReady||freeMap.after!==freeMap.before+1||freeMap.afterOut!==freeMap.before||!freeMap.townLabelsLayer||!freeMap.attribution||freeMap.markerCount<10)
      throw Error('Leaflet map or zoom failed '+JSON.stringify(freeMap));
    const offline=await win.webContents.executeJavaScript(`(async()=>{
      const map=window.MoOLVaFreeMap32;
      const archive=await fetch('moolva-map://offline/nizhny-novgorod.pmtiles',{headers:{Range:'bytes=0-6'}});
      const signature=await archive.text();
      document.querySelector('#fm32-town').value='Семёнов';
      document.querySelector('#fm32-find').click();
      [...document.querySelectorAll('#fm32-results button')].find(button=>button.textContent.startsWith('Семёнов · город'))?.click();
      const center=map.getMap().getCenter();
      const hasGeography=x=>{
        const pixels=x.getContext('2d').getImageData(0,0,x.width,x.height).data;
        for(let i=4;i<pixels.length;i+=4)if(pixels[i]!==pixels[0]||pixels[i+1]!==pixels[1]||pixels[i+2]!==pixels[2])return true;
        return false;
      };
      let tiles=[],rendered=false;
      for(let i=0;i<50&&!rendered;i++){
        await new Promise(r=>setTimeout(r,100));
        tiles=[...document.querySelectorAll('#fm32-map canvas.leaflet-tile-loaded')].filter(x=>x.width&&x.height);
        rendered=tiles.some(hasGeography);
      }
      const packs=await window.MoOLVaMaps?.list();
      if(packs?.length!==6 || !packs.every(p=>p.state==='ready'))throw Error('Missing bundled map coverage');
      const header=await fetch('moolva-map://offline/nizhny-novgorod.pmtiles',{headers:{Range:'bytes=0-126'}});
      if(header.status!==206 || new Uint8Array(await header.arrayBuffer())[101]!==14)throw Error('Full detail map missing');
      return {status:archive.status,signature,rendered,tileCount:tiles.length,packCount:packs?.length||0,packPanelVisible:!document.getElementById('fm34-packs').hidden,semenov:center.lat>56.76&&center.lat<56.82&&center.lng>44.45&&center.lng<44.54,...map.getStatus()};
    })()`,true);
    fs.writeFileSync(path.join(folder,'09-offline-map.json'),JSON.stringify(offline,null,2));
    if(offline.status!==206||offline.signature!=='PMTiles'||!offline.rendered||!offline.semenov||offline.online||offline.localityCount<1000||offline.packCount!==6||!offline.packPanelVisible)
      throw Error('Offline map failed '+JSON.stringify(offline));
    fs.writeFileSync(path.join(folder,'07-free-interactive-map.png'),(await win.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(folder,'08-visible-map-menu.png'),(await win.webContents.capturePage()).toPNG());
    allowLiveMap=true;
    const live=await win.webContents.executeJavaScript(`(async()=>{
      const more=document.querySelector('#more-nav');
      more.querySelector('summary').click();
      const item=more.querySelector('[data-stage20="calendar20"]');
      if(!more.open || item.getBoundingClientRect().height===0)throw Error('Expanded menu is inaccessible');
      item.click();
      if(!document.querySelector('#calendar20.page.active')||more.open)throw Error('Calendar navigation failed');
      document.querySelector('#primary-map-nav').click();
      document.querySelector('#fm32-switch').click();
      for(let i=0;i<120;i++){
       const img=[...document.querySelectorAll('#fm32-map img.leaflet-tile-loaded')].find(x=>x.naturalWidth===256&&x.src.startsWith('https://tile.openstreetmap.org/'));
       if(img&&MoOLVaFreeMap32.getStatus().online)return {tile:img.src,width:img.naturalWidth,zoom:MoOLVaFreeMap32.getMap().getZoom(),menu:true};
       await new Promise(r=>setTimeout(r,100));
      }
      throw Error('OpenStreetMap rendering failed: '+JSON.stringify(MoOLVaFreeMap32.getStatus()));
    })()`,true);
    fs.writeFileSync(path.join(folder,'10-online-map.json'),JSON.stringify(live,null,2));
    fs.writeFileSync(path.join(folder,'10-online-map.png'),(await win.webContents.capturePage()).toPNG());
    partialMap={allowed:0,cancelled:0,completed:0,request:null};
    const fallback=await win.webContents.executeJavaScript(`(async()=>{
      const api=window.MoOLVaFreeMap32;
      const map=api.getMap();
      map.setView([56.35,43.50],14,{animate:false});
      const center=map.getCenter();
      const zoom=map.getZoom();
      for(let i=0;i<100;i++){
        const saved=map.getCenter();
        const status=api.getStatus();
        if(!status.online&&document.querySelector('#fm32-map canvas.leaflet-tile-loaded')){
          return {offline:true, zoomPreserved:map.getZoom()===zoom, centerPreserved:saved.distanceTo(center)<1};
        }
        await new Promise(r=>setTimeout(r,100));
      }
      throw Error('Partial coverage did not switch to the offline map '+JSON.stringify(api.getStatus()));
    })()`,true);
    const {allowed,cancelled,completed}=partialMap;
    const fallbackReport={...fallback,allowed,cancelled,completed};
    fs.writeFileSync(path.join(folder,'12-map-fallback.json'),JSON.stringify(fallbackReport,null,2));
    if(!fallback.centerPreserved||!fallback.zoomPreserved||!partialMap.completed||!partialMap.cancelled)
      throw Error('Partial map fallback failed '+JSON.stringify(fallbackReport));
    const nextLoad=()=>new Promise(resolve=>win.webContents.once('did-finish-load',resolve));
    let reloaded=nextLoad();
    await win.webContents.executeJavaScript(`(()=>{
      const payload={...MoOLVaAtlas50Current,version:2};
      const json=new File([JSON.stringify(payload)],'atlas-update.json',{type:'application/json'});
      const transfer=new DataTransfer();
      transfer.items.add(json);
      const input=document.getElementById('atlas50-package-file');
      input.files=transfer.files;
      input.dispatchEvent(new Event('change'));
    })()`,true);
    await reloaded;
    const installed=await win.webContents.executeJavaScript(`MoOLVaAtlas50Current.version===2 &&
      !document.getElementById('atlas50-package-rollback').hidden &&
      document.querySelectorAll('#atlas50-group option').length===5`);
    if(!installed)throw Error('Atlas data package was not activated after reload');
    reloaded=nextLoad();
    await win.webContents.executeJavaScript("document.getElementById('atlas50-package-rollback').click()");
    await reloaded;
    const rolledBack=await win.webContents.executeJavaScript('MoOLVaAtlas50Current.version===1');
    if(!rolledBack)throw Error('Atlas data package rollback failed');
    fs.writeFileSync(path.join(folder,'14-encyclopedia.json'),JSON.stringify({...encyclopedia,installed,rolledBack},null,2));
    clearTimeout(failure);app.exit(0);
   }catch(e){fs.writeFileSync(path.join(folder,'gui-error.txt'),String(e.stack||e));clearTimeout(failure);app.exit(3);}
  });
 }
 openAtlas();
}
function verifyPortableProfile(folder){
 const fail=error=>{
   fs.mkdirSync(folder,{recursive:true});
   fs.writeFileSync(path.join(folder,'gui-error.txt'),String(error.stack||error));
   app.exit(3);
 };
 const timeout=setTimeout(()=>fail(Error('Portable profile check timed out')),45000);
 win.webContents.once('did-finish-load',async()=>{
   try{
     if(profileCheck==='upgrade'){
       const legacy=await win.webContents.executeJavaScript("localStorage.getItem('moolva-map-mode')");
       if(legacy!=='online')throw Error('4.1.0 map preference not retained: '+legacy);
       const checkpoint=path.join(profilePath,'Backups','before-5.0.json');
       if(!fs.existsSync(checkpoint))throw Error('Legacy checkpoint is missing');
       await win.webContents.executeJavaScript(`(()=>{
         const search=document.getElementById('search');
         search.value='Boletus edulis';
         search.dispatchEvent(new Event('input'));
         document.querySelector('#cards [data-fav="g001"]').click();
         MoOLVaProfile41.setItem('moolva-map-mode','offline');
       })()`);
       const saved=await win.webContents.executeJavaScript(`JSON.parse(localStorage.getItem('moolva-griby-1.0-data')).favorites.includes('g001')`);
       if(!saved||profile.backupCount<3)throw Error('Changes were not backed up');
       clearTimeout(timeout);
       app.exit(0);
       return;
     }
     if(profileCheck!=='recover')throw Error('Unknown profile check');
     const recovered=await win.webContents.executeJavaScript(`(()=>{
       const journal=JSON.parse(localStorage.getItem('moolva-griby-1.0-data'));
       return journal?.favorites.includes('g001') &&
         document.getElementById('profile41-status').textContent.includes('восстановлены');
     })()`);
     if(!recovered)throw Error('Favorite was not recovered from a valid older snapshot; '+
       await win.webContents.executeJavaScript("document.getElementById('profile41-status').textContent"));
     win.webContents.once('render-process-gone',()=>{
       win.webContents.once('did-finish-load',async()=>{
         try{
           const safe=await win.webContents.executeJavaScript(`MoOLVaSafeMode &&
             document.querySelector('#primary-map-nav').hidden &&
             document.querySelector('#cards .mush-card') !== null`);
           if(!safe)throw Error('Renderer crash did not open the safe atlas');
           const report=await win.webContents.executeJavaScript('MoOLVaReliability.copyReport()');
           if(!report||!clipboard.readText().includes('renderer-'))throw Error('Crash diagnostics unavailable');
           fs.writeFileSync(path.join(folder,'13-profile.json'),JSON.stringify({
             upgradedFrom:'4.1.0', restoredFavorite:recovered, safeModeAfterCrash:safe, copiedDiagnostics:report,
             rollingSnapshots:profile.backupCount
           },null,2));
           clearTimeout(timeout);
           app.exit(0);
         }catch(error){fail(error);}
       });
     });
     win.webContents.forcefullyCrashRenderer();
   }catch(error){fail(error);}
 });
}
app.whenReady().then(()=>{
 const ses=session.defaultSession;
 if(evidenceFlag)ses.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(details,callback)=>{
   const osm=new URL(details.url).hostname==='tile.openstreetmap.org';
   if(!allowLiveMap||!osm)return callback({cancel:true});
   if(!partialMap)return callback({cancel:false});
   if(partialMap.allowed===0){
     partialMap.allowed++;
     partialMap.request=details.id;
     callback({cancel:false});
   }else{
     partialMap.cancelled++;
     callback({cancel:true});
   }
 });
 if(evidenceFlag)ses.webRequest.onCompleted({urls:['https://tile.openstreetmap.org/*']},details=>{
   if(partialMap?.request===details.id&&details.statusCode>=200&&details.statusCode<300)partialMap.completed++;
 });
 const mapFile=path.join(app.isPackaged ? process.resourcesPath : __dirname,'maps','nizhny-novgorod.pmtiles');
 safeMode=safeMode || (!evidenceFlag && profile.needsSafeMode);
 function isAtlasFrame(event){
   if(event.sender!==win?.webContents)return false;
   const caller=event.senderFrame, top=event.sender.mainFrame;
   // Only the main frame in the dedicated local window can use these channels.
   // Electron and Node may serialize the same Windows file URL differently.
   return Boolean(caller && top && caller.url.startsWith('file:') &&
     caller.routingId===top.routingId && caller.processId===top.processId);
 }
 ipcMain.handle('maps:list',event=>isAtlasFrame(event) ? regions.map(region=>({...region,state:'ready'})) : []);
 ipcMain.on('profile:config',event=>{
   event.returnValue=isAtlasFrame(event) ? {keys:profile.keys,safe:safeMode} : null;
 });
 ipcMain.on('profile:bootstrap',(event,values)=>{
   if(!isAtlasFrame(event)){
     event.returnValue={values:{},error:true};
     return;
   }
   let result={values:{},error:true};
   try{
     result={...profile.bootstrap(values,existingProfile),error:profileError};
     existingProfile=true;
   }catch{profileError=true;recordIssue('backup-bootstrap-failed');}
   event.returnValue=result;
 });
 ipcMain.on('profile:snapshot',(event,values)=>{
   let saved=false;
   if(isAtlasFrame(event)){
     try{
       profile.save(values);
       profileError=false;
       saved=true;
     }catch{profileError=true;recordIssue('backup-save-failed');}
   }
   event.returnValue=saved;
 });
 ipcMain.on('profile:restart',event=>{
   if(!isAtlasFrame(event)||!safeMode)return;
   safeMode=false;
   recoveryUsed=false;
   openAtlas();
 });
 ipcMain.handle('profile:copy-report',event=>{
   if(!isAtlasFrame(event))return false;
   const portable=process.env.PORTABLE_EXECUTABLE_DIR ? 'переносной' : 'обычный';
   clipboard.writeText([
     'MoOLVa Грибы '+app.getVersion(),
     'Система: '+process.platform+' '+os.release()+' ('+process.arch+')',
     'Профиль: '+portable+(profileError ? ', ошибка записи' : ', доступен для записи'),
     'Режим: '+(safeMode?'безопасный':'обычный'),
     'Резервных копий: '+profile.backupCount,
     'Последний сбой: '+(lastIssue||profile.lastIssue||'не зарегистрирован')
   ].join('\n'));
   return true;
 });
 protocol.handle('moolva-map',request=>{
   const url=new URL(request.url);
   if(url.host!=='offline'||url.pathname!=='/nizhny-novgorod.pmtiles'||url.search||request.method!=='GET')return new Response(null,{status:404});
   return readMapRange(mapFile,request.headers.get('Range'));
 });
 // OSM raster tile policy: app-identifying User-Agent and normal HTTP caching, no bulk fetching.
 ses.webRequest.onBeforeSendHeaders({urls:['https://tile.openstreetmap.org/*']},(details,callback)=>{
   details.requestHeaders['User-Agent']='MoOLVa-Griby/5.0.0 (+https://github.com/svarshan/git-repo)';
   callback({requestHeaders:details.requestHeaders});
 });
 createWindow();
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
