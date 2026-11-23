'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const keys = {
  'moolva-griby-1.0-data':'journal',
  'moolva-griby-v3-private-points':'array',
  'moolva-griby-v3-private-track':'array',
  'moolva-griby-v2-my-coordinates':'array',
  'moolva-griby-v34-trips':'array',
  'moolva-griby-v2-photo-review':'object',
  'moolva-griby-last-place':'object',
  'moolva-map-mode':'mode',
  'moolva-griby-atlas-v50-pack':'object',
  'moolva-griby-atlas-v50-training':'object'
};
const limit = 12 * 1024 * 1024;
const historyLimit = 5;
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

function validValue(key, raw) {
  if (typeof raw !== 'string' || raw.length > limit) return false;
  if (keys[key] === 'mode') return raw === 'online' || raw === 'offline';
  try {
    const result = JSON.parse(raw);
    switch (keys[key]) {
      case 'journal': return isRecord(result) && Array.isArray(result.favorites) && Array.isArray(result.diary);
      case 'array': return Array.isArray(result);
      case 'object': return Boolean(isRecord(result));
      default: return false;
    }
  } catch {
    return false;
  }
}

function validValues(values) {
  if (!isRecord(values)) return {};
  return Object.fromEntries(Object.keys(keys)
    .filter(key => validValue(key,values[key])).map(key => [key,values[key]]));
}

function atomicJson(file, value) {
  const buffer = Buffer.from(JSON.stringify(value));
  if (buffer.length > limit) throw new Error('Profile backup exceeds the size limit');
  const temp = file + '.' + randomUUID() + '.tmp';
  let fd;
  try {
    fd = fs.openSync(temp,'wx',0o600);
    fs.writeFileSync(fd,buffer);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp,file);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    fs.rmSync(temp,{force:true});
  }
}

function readJson(file) {
  try {
    if (fs.statSync(file).size > limit) return null;
    return JSON.parse(fs.readFileSync(file,'utf8'));
  } catch {
    return null;
  }
}

function openProfile(profile, version) {
  const folder = path.join(profile,'Backups');
  const checkpoint = path.join(folder,'before-'+version.split('.').slice(0,2).join('.')+'.json');
  const runtimeFile = path.join(profile,'startup-state.json');
  let runtime = readJson(runtimeFile) || {};
  const files = () => fs.readdirSync(folder)
    .filter(name => /^snapshot-\d{13}-[a-f0-9-]{36}\.json$/.test(name))
    .sort().reverse();
  const load = file => {
    const raw = readJson(file);
    if (raw?.schema !== 1 || !isRecord(raw.values)) return null;
    const values = validValues(raw.values);
    return Object.keys(raw.values).length === Object.keys(values).length ? values : null;
  };
  const newestValid = backups => {
    for (const name of backups) {
      const values = load(path.join(folder,name));
      if (values) return {name,values};
    }
    return null;
  };
  function save(values) {
    if (!isRecord(values)) throw Error('Invalid profile snapshot');
    const cleaned = validValues(values);
    if (Object.keys(cleaned).length !== Object.keys(values).length) throw Error('Invalid profile values');
    fs.mkdirSync(folder,{recursive:true});
    const backups = files();
    const previous = newestValid(backups);
    if (previous && previous.name === backups[0] && JSON.stringify(previous.values) === JSON.stringify(cleaned)) return;
    const stamp = Math.max(Date.now(),Number(backups[0]?.slice(9,22) || 0)+1);
    atomicJson(path.join(folder,'snapshot-'+stamp+'-'+randomUUID()+'.json'),
      {schema:1,version,created:new Date().toISOString(),values:cleaned});
    for (const name of files().slice(historyLimit)) fs.rmSync(path.join(folder,name),{force:true});
  }
  function bootstrap(current, existingProfile) {
    fs.mkdirSync(folder,{recursive:true});
    const live = validValues(current);
    const backups = files();
    if (existingProfile && runtime.version!==version && !fs.existsSync(checkpoint) && Object.keys(live).length) {
      atomicJson(checkpoint,{schema:1,version,created:new Date().toISOString(),values:live});
    }
    const previous = newestValid(backups)?.values || load(checkpoint) || {};
    const values = {...previous,...live};
    save(values);
    if(runtime.version!==version)writeRuntime({...runtime,version});
    return {values,recovered:Object.keys(values).filter(key => !Object.hasOwn(live,key)).length};
  }
  function writeRuntime(next) {
    runtime = next;
    atomicJson(runtimeFile,runtime);
  }
  function begin(safe) {
    const last = runtime.pending ? Number(runtime.failures || 0) : 0;
    writeRuntime({...runtime,pending:true,failures:safe ? Math.max(1,last) : last+1,lastIssue:runtime.lastIssue || ''});
  }
  function ready() {
    writeRuntime({...runtime,pending:false,failures:0,lastIssue:runtime.lastIssue || ''});
  }
  function issue(reason) {
    writeRuntime({...runtime,lastIssue:reason});
  }
  return {
    keys:Object.keys(keys), bootstrap, save, begin, ready, issue,
    get needsSafeMode() { return runtime.pending === true && runtime.failures >= 2; },
    get lastIssue() { return runtime.lastIssue || ''; },
    get backupCount() { return fs.existsSync(folder) ? files().filter(name => load(path.join(folder,name))).length : 0; }
  };
}

module.exports = {openProfile};
