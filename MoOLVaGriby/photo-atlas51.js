'use strict';

(function(root){
  const labels={
    top:'Верхняя сторона', side:'Сбоку', underside:'Нижняя сторона',
    details:'Деталь', general:'Ракурс не указан'
  };
  function entries(latin, curated, covers, extras, eligible){
    const photos=curated?.[latin] ?? [covers?.[latin],...(extras?.[latin]||[])];
    const seen=new Set();
    return photos.filter(photo=>{
      if(!eligible(photo)||seen.has(photo.source))return false;
      seen.add(photo.source);
      return true;
    });
  }
  function viewLabel(photo){
    const label=labels[photo.view]||labels.general;
    if(photo.viewBasis==='source-caption')return label+' · по подписи автора';
    if(photo.viewBasis==='visual-estimate')return label+' · ориентировочно';
    return label;
  }
  function licenseLink(license){
    const name=String(license||'').toLowerCase().replaceAll(' ','-');
    if(/^cc0/.test(name))return 'https://creativecommons.org/publicdomain/zero/1.0/';
    const cc=name.match(/^cc-(by(?:-sa)?)(?:-([1-4]\.0))?$/);
    if(!cc || !cc[2])return '';
    return 'https://creativecommons.org/licenses/'+cc[1]+'/'+cc[2]+'/';
  }
  const api={entries,viewLabel,licenseLink};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root) {
    root.MoOLVaPhotos51=api;
    api.active=latin=>entries(latin,root.MOOLVA_ATLAS_PHOTOS51,root.MOOLVA_PHOTOS,root.MOOLVA_GALLERY20,root.MoOLVa20Core.eligiblePhoto);
  }
})(typeof window==='undefined'?null:window);
