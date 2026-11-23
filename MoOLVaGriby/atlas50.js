'use strict';

(function (root) {
  const names = /^[A-Z][a-z-]{1,30} [a-z-]{2,30}$/;
  const regions = new Set(['Древесные','Сумчатые','Шиповатые','Другие','Пластинчатые','Трубчатые']);
  const sourceHosts = new Set(['www.first-nature.com','www.mushroomexpert.com','mushrooms.linnaeus.naturalis.nl',
    'old.kerzhenskiy.ru','kerzhenskiy.ru','www.kerzhenskiy.ru','www.unn.ru','www.gbif.org','www.inaturalist.org']);
  const publicationHosts = new Set(['old.kerzhenskiy.ru','kerzhenskiy.ru','www.kerzhenskiy.ru','www.unn.ru']);
  const maxSize = 512 * 1024;

  function sourceUrl(text,hosts=sourceHosts) {
    try {
      const url = new URL(text);
      if (url.protocol === 'https:' && hosts.has(url.hostname) && !url.username && !url.password && !url.port &&
          typeof text === 'string' && text.length<400) return url.href;
    } catch { /* Invalid or unsupported source. */ }
    return '';
  }

  function validate(input) {
    const fail = () => { throw new Error('Некорректный пакет данных атласа.'); };
    const str = (x,n) => typeof x==='string' && x.trim().length>0 && x.length<=n;
    const unique = xs => new Set(xs).size === xs.length;
    if (input?.schema!==1 || !Number.isSafeInteger(input.version) || input.version<1 ||
        input.region!=='Нижегородская область' || !Array.isArray(input.groups) ||
        !Array.isArray(input.publications) || input.groups.length<1 || input.groups.length>40 ||
        input.publications.length>250) fail();
    const groups=input.groups.map(group => {
      if (!group || !/^[a-z0-9-]{2,40}$/.test(group.id) || !str(group.title,90) || !str(group.description,350) ||
          !Array.isArray(group.entries) || group.entries.length<3 || group.entries.length>6) fail();
      const entries=group.entries.map(entry => {
        if(!Array.isArray(entry) || entry.length!==3 || !names.test(entry[0]) || !str(entry[1],350) ||
            !sourceUrl(entry[2])) fail();
        return [entry[0],entry[1],sourceUrl(entry[2])];
      });
      if(!unique(entries.map(x=>x[0]))) fail();
      return {id:group.id,title:group.title,description:group.description,entries};
    });
    if(!unique(groups.map(g=>g.id))) fail();
    const publications=input.publications.map(p => {
      if (!p || !names.test(p.latin) || !str(p.name,100) || !regions.has(p.group) || !str(p.note,400) ||
          !sourceUrl(p.url,publicationHosts)) fail();
      return {latin:p.latin,name:p.name,group:p.group,note:p.note,url:sourceUrl(p.url,publicationHosts)};
    });
    if(!unique(publications.map(p=>p.latin))) fail();
    return {schema:1,version:input.version,region:input.region,groups,publications};
  }

  function readPackage(text) {
    if (typeof text !== 'string' || text.length>maxSize) throw Error('Пакет превышает 512 КБ.');
    return validate(JSON.parse(text));
  }

  function resolvePackages(bundled,saved) {
    const base=validate(bundled);
    try {
      const current=saved?.current && validate(saved.current);
      return current && current.version>=base.version ? current : base;
    } catch {
      return base;
    }
  }

  function createCatalog(data,species) {
    const byLatin=new Map(species.map(item=>[item.latin,item]));
    for(const pub of data.publications) {
      const existing=byLatin.get(pub.latin);
      if(existing){
        if(existing.group==='Региональные публикации'){
          Object.assign(existing,{name:pub.name,group:pub.group,traits:'Описание региональной публикации приведено ниже.'});
        }
      } else {
        const card={id:'region50-'+pub.latin.toLowerCase().replace(' ','-'), name:pub.name,latin:pub.latin,
          group:pub.group,risk:'неопределён',months:[],habitat:'Сведения о регионе приведены в источниках.',
          traits:'Справочная карточка региональной публикации.',similar:''};
        species.push(card);
        byLatin.set(card.latin,card);
      }
    }
    return data.groups.map(group=>({...group,entries:group.entries.flatMap(([latin,note,source])=>{
      const item=byLatin.get(latin);
      return item?[{item,note,source}]:[];
    })})).filter(group=>group.entries.length>=3);
  }

  function matrix(group,atlas) {
    const profiles=group.entries.map(entry=>atlas.traitsOf(entry.item));
    return Object.entries(atlas.questions).flatMap(([key,q])=>{
      const values=profiles.map(profile=>atlas.labelValue(key,profile[key]) || '');
      const known=values.filter(Boolean);
      if(!known.length) return [];
      const status=new Set(known).size>1?'differs':known.length<values.length?'partial':'same';
      return [{key,label:q.label,values,status,incomplete:known.length<values.length}];
    });
  }

  function practice(groups,atlas) {
    const out=[];
    for(const group of groups) {
      const rows=matrix(group,atlas);
      for(const row of rows) {
        if(row.status!=='differs'||row.incomplete)continue;
        for(const [index,value] of row.values.entries()) {
          if(row.values.filter(x=>x===value).length!==1)continue;
          out.push({id:group.id+'/'+row.key+'/'+group.entries[index].item.id,group,row,index,value});
        }
      }
    }
    return out;
  }

  const api={maxSize,validate,sourceUrl,readPackage,resolvePackages,createCatalog,matrix,practice};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.MoOLVaAtlas50=api;
    let saved;
    try{saved=JSON.parse(root.localStorage.getItem('moolva-griby-atlas-v50-pack')||'null');}catch{ /* Use built-in data. */ }
    root.MoOLVaAtlas50Current=resolvePackages(root.MoOLVaAtlas50Data,saved);
  }
})(typeof window === 'undefined' ? null : window);
