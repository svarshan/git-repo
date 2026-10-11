/* Node regression suite for MoOLVa's global employee selector.
   No npm packages; runs on stock GitHub Windows runner. */
'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const pickerCode = fs.readFileSync(path.join(__dirname,'staff_picker302.js'),'utf8');
const context = {
  window:{},
  document:{readyState:'loading',addEventListener(){}},
  console
};
vm.createContext(context);
vm.runInContext('let state={venue:7,employees23:['+
  '{"name":"Анна Иванова","position":"Повар"},'+
  '{"name":"Пётр Смирнов","position":"Кладовщик"},'+
  '{"name":"Анна Иванова","position":"Повар"}],employees222:['+
  '{"name":"Мария Зайцева","position":"Заведующая"}]};\n'+pickerCode,context);
const picker = context.window.MoOLVaStaffPicker302;
assert(picker,'Global staff picker not installed');
const names=picker.people();
assert.deepStrictEqual(names.map(x=>x.name).sort(), ['Анна Иванова','Мария Зайцева','Пётр Смирнов'].sort());
function field(id,placeholder,label,attrs={}) {
  return {
    tagName:'INPUT',type:attrs.type||'text',id,name:attrs.name||'',
    placeholder:placeholder||'',disabled:!!attrs.disabled,readOnly:!!attrs.readOnly,
    labels:label?[{textContent:label}]:[],
    getAttribute(k){return attrs[k]||null;},
    closest(sel){if(sel==='.o22-employee') return attrs.o22?{}:null;return null;}
  };
}
for (const [id,ph,lab] of [
  ['schedule-owner','ФИО ответственного','Ответственный'],
  ['produce-actor','ФИО','Ответственный'],
  ['e30-sender','ФИО','Передающий смену'],
  ['e30-recipient','ФИО','Получатель'],
  ['o22-employee-deputy','ФИО заместителя','Заместитель'],
  ['anything','Фамилия имя отчество','ФИО работника']
]) assert(picker.isNameField(field(id,ph,lab)), 'Missing chooser in '+id);
for (const [id,ph,lab] of [
  ['acc-password','Введите пароль','Пароль'],
  ['field-signature','ФИО','Подпись ответственного'],
  ['customer-inn','ИНН','ИНН организации'],
  ['batch-number','Номер партии','Номер партии'],
  ['calendar-date','2026-10-11','Дата'],
  ['search-product','Поиск товара','Наименование товара']
]) assert(!picker.isNameField(field(id,ph,lab)), 'Unsafe chooser in '+id);
assert(!picker.isNameField(field('disabled-staff','ФИО','','',{disabled:true})));
assert(!picker.isNameField(field('amount-owner','Ответственный','',{type:'number'})));
vm.runInContext('state={venue:9,employees23:[{name:"Елена Петрова",position:"Повар"}]};',context);
assert.deepStrictEqual(picker.people().map(x=>x.name),['Елена Петрова'],
  'Employee list leaked across enterprise switch');
vm.runInContext('state={venue:0,employees23:[{name:"Случайный человек"}]};',context);
assert.strictEqual(picker.people().length,0,'People shown without enterprise selected');
const ui=fs.readFileSync(path.join(__dirname,'..','moolva301','quick31_ui.js'),'utf8');
new Function(ui);
assert(ui.includes('✓ Сохранить фактическое значение'));
assert(!ui.includes('id="q31-confirm"'),'Quick journal still has redundant checkbox');
assert(ui.includes('confirmed:true'),'Explicit save must confirm actual measurement');
assert(ui.includes('profile()?.title||$q'), 'Quick preset should derive its title');
console.log('STAFF_PICKER_302_TESTS_OK — universal FIO, venue isolation, no signatures, simpler journal');