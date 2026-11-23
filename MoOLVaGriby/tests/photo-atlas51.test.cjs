'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const atlas=require('../photo-atlas51.js');
const {eligiblePhoto}=require('../core20.js');

const picture={file:'media/gallery/inat-123.jpg',source:'https://www.inaturalist.org/photos/123',license:'CC-BY'};

test('curated galleries filter duplicate and unlicensed photos and preserve legacy fallbacks',()=>{
 const legacy={ 'Test mushroom':picture };
 const alternate={...picture,file:'media/gallery/inat-124.jpg'};
 assert.deepEqual(atlas.entries('Test mushroom',{ 'Test mushroom':[picture,alternate,
   {...picture,source:'https://www.inaturalist.org/photos/125',license:'CC-BY-NC'}] },legacy,{},eligiblePhoto),[picture]);
 assert.deepEqual(atlas.entries('Test mushroom',{},legacy,{},eligiblePhoto),[picture]);
 assert.deepEqual(atlas.entries('Test mushroom',{ 'Test mushroom':[] },legacy,{},eligiblePhoto),[]);
});

test('credits distinguish recorded views from unclassified shots and link explicit license versions',()=>{
 assert.equal(atlas.viewLabel({view:'underside',viewBasis:'reviewed'}),'Нижняя сторона');
 assert.equal(atlas.viewLabel({view:'top',viewBasis:'source-caption'}),'Верхняя сторона · по подписи автора');
 assert.equal(atlas.viewLabel({}),'Ракурс не указан');
 assert.equal(atlas.licenseLink('CC BY-SA 3.0'),'https://creativecommons.org/licenses/by-sa/3.0/');
 assert.equal(atlas.licenseLink('CC-BY'),'');
});
