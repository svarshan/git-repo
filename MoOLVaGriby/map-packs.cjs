'use strict';
const {createReadStream} = require('node:fs');
const {mkdir, open, rename, stat, unlink} = require('node:fs/promises');
const {createHash} = require('node:crypto');
const path = require('node:path');
const regions = require('./map-regions.json');
const RELEASE = 'https://github.com/svarshan/git-repo/releases/download/moolva-griby-maps-20261116/';

async function fileSize(file) {
  try { return (await stat(file)).size; }
  catch (error) { if (error.code !== 'ENOENT') throw error; return 0; }
}

async function openReleaseAsset(name, options) {
  let url = new URL(name, RELEASE);
  for (let count = 0; count < 5; count++) {
    if (url.protocol !== 'https:' || !['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(url.hostname)) {
      throw new Error('Неподдерживаемый адрес пакета карты.');
    }
    const response = await fetch(url, {...options, redirect:'manual'});
    if (![301,302,303,307,308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) break;
    url = new URL(location, url);
  }
  throw new Error('Не удалось открыть хранилище карт.');
}

function createMapPacks(directory, request = openReleaseAsset) {
  const jobs = new Map();
  const byId = new Map(regions.map(region => [region.id,region]));
  let catalog;
  function filename(id) { return byId.has(id) ? path.join(directory,`${id}.pmtiles`) : null; }
  async function list() {
    return Promise.all(regions.map(async region => {
      const file = filename(region.id);
      const job = jobs.get(region.id);
      const downloaded = await fileSize(file);
      const received = downloaded || await fileSize(file+'.part');
      return {...region, received, total:job?.total || 0, state:downloaded?'ready':(job?.state || (received?'paused':'idle')), error:job?.error || ''};
    }));
  }
  async function manifest(signal) {
    if (catalog) return catalog;
    const response = await request('catalog.json',{signal});
    if (!response.ok) throw new Error('Каталог карт недоступен. Проверьте интернет и повторите попытку.');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Не удалось прочитать каталог карт.');
    catalog = new Map(rows.filter(x => byId.has(x?.id) && Number.isSafeInteger(x.size) && x.size>0 && x.size<=100_000_000 && /^[a-f0-9]{64}$/.test(x.sha256)).map(x=>[x.id,x]));
    return catalog;
  }
  async function transfer(id, job) {
    const signal=AbortSignal.any([job.controller.signal,AbortSignal.timeout(300_000)]);
    const entry=(await manifest(signal)).get(id);
    if (!entry) throw new Error('Этот пакет пока отсутствует в каталоге.');
    job.total=entry.size;
    await mkdir(directory,{recursive:true});
    const target=filename(id), part=target+'.part';
    let offset=await fileSize(part);
    if (offset>entry.size) { await unlink(part); offset=0; }
    if (offset<entry.size) {
      const headers=offset?{'Range':`bytes=${offset}-`}:{};
      const response=await request(`${id}.pmtiles`,{headers,signal});
      if (response.status===206 && response.headers.get('content-range')!==`bytes ${offset}-${entry.size-1}/${entry.size}`) {
        await response.body?.cancel();
        throw new Error('Сервер вернул неподходящий диапазон загрузки.');
      }
      if (![200,206].includes(response.status) || !response.body) throw new Error(`Загрузка карты недоступна (${response.status}).`);
      if (response.status===200) offset=0;
      const output=await open(part,offset?'a':'w');
      try {
        for await (const chunk of response.body) {
          if (offset+chunk.byteLength>entry.size) throw new Error('Размер файла отличается от каталога.');
          await output.writeFile(chunk);
          offset+=chunk.byteLength;
        }
      } finally { await output.close(); }
    }
    if (offset!==entry.size) throw new Error('Загрузка прервалась. Нажмите «Продолжить».');
    const hash=createHash('sha256');
    for await(const chunk of createReadStream(part)) hash.update(chunk);
    if (hash.digest('hex')!==entry.sha256) {
      await unlink(part);
      throw new Error('Контрольная сумма карты не совпала. Загрузите пакет заново.');
    }
    await rename(part,target);
  }
  async function start(id) {
    const file=filename(id);
    if (!file || jobs.get(id)?.state==='downloading') return false;
    const job={controller:new AbortController(),state:'downloading',total:0,error:''};
    jobs.set(id,job);
    try {
      if (!(await fileSize(file))) await transfer(id,job);
      job.state='ready';
    } catch (error) {
      job.state=job.controller.signal.aborted?'paused':'error';
      if(job.state==='error') job.error=error.name==='TimeoutError'?'Время загрузки истекло. Нажмите «Продолжить».':error.message;
    }
    return job.state==='ready';
  }
  function pause(id) { jobs.get(id)?.controller.abort(); }
  return {list,start,pause,filename};
}
module.exports={createMapPacks};
