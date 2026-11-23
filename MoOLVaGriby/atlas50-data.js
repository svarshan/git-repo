'use strict';

(function (root) {
  const firstNature = latin => 'https://www.first-nature.com/fungi/'+latin.toLowerCase().replace(' ','-')+'.php';
  const reserve = 'https://old.kerzhenskiy.ru/krasnaya-kniga/rasteniya-i-griby/';
  const data = {
    schema:1,
    version:1,
    region:'Нижегородская область',
    groups:[
      {
        id:'brown-boletes',
        title:'Белый гриб и похожие трубчатые',
        description:'Сравните цвет пор с возрастом и рисунок ножки.',
        entries:[
          ['Boletus edulis','Светлые поры постепенно желтеют и приобретают оливковый оттенок. На ножке описана мелкая сетка.','https://www.mushroomexpert.com/boletus_edulis.html'],
          ['Tylopilus felleus','У зрелых плодовых тел поры розовеют. На ножке заметна тёмная сетка.','https://mushrooms.linnaeus.naturalis.nl/linnaeus_ng/app/views/species/nsr_taxon.php?id=100547'],
          ['Imleria badia','Светло-жёлтые поры часто синеют от надавливания. На ножке могут быть неглубокие продольные морщинки.','https://www.mushroomexpert.com/imleria_badia.html']
        ]
      },
      {
        id:'chanterelles',
        title:'Лисички и похожие светло-жёлтые грибы',
        description:'Самый полезный для сравнения признак здесь — строение нижней стороны.',
        entries:[
          ['Cantharellus cibarius','Снизу тупые складки, которые спускаются по ножке.',firstNature('Cantharellus cibarius')],
          ['Hygrophoropsis aurantiaca','Снизу тонкие пластинки, которые часто разветвляются.',firstNature('Hygrophoropsis aurantiaca')],
          ['Hydnum repandum','Снизу густые мягкие шипики.',firstNature('Hydnum repandum')]
        ]
      },
      {
        id:'pale-gilled',
        title:'Светлые пластинчатые грибы',
        description:'Изучите основание ножки и цвет пластинок зрелых грибов. В этой группе есть смертельно ядовитые виды.',
        entries:[
          ['Agaricus campestris','Пластинки розовые в молодости и темнеют с возрастом. Вольва отсутствует.',firstNature('Agaricus campestris')],
          ['Agaricus xanthodermus','В описании отмечено пожелтение основания ножки. Пластинки темнеют по мере созревания.',firstNature('Agaricus xanthodermus')],
          ['Amanita phalloides','Пластинки обычно белые, у основания ножки мешковидные остатки общего покрывала.',firstNature('Amanita phalloides')],
          ['Amanita virosa','Белые пластинки и мешковидная вольва. Окраска сама по себе недостаточна для сравнения.',firstNature('Amanita virosa')]
        ]
      },
      {
        id:'wood-clusters',
        title:'Мелкие грибы на древесине',
        description:'Несколько видов растут группами на древесине. Кольцо у части грибов меняется или исчезает с возрастом.',
        entries:[
          ['Armillaria mellea','В справочнике описаны светлый споровый отпечаток и остатки покрывала.',firstNature('Armillaria mellea')],
          ['Flammulina velutipes','Нижняя часть ножки тёмная и бархатистая, споровый отпечаток белый.',firstNature('Flammulina velutipes')],
          ['Hypholoma fasciculare','У молодых грибов пластинки желтоватые, позднее они приобретают зеленовато-оливковый оттенок.',firstNature('Hypholoma fasciculare')],
          ['Galerina marginata','Споровый отпечаток ржаво-коричневый. Кольцо бывает тонким и исчезает.','https://www.mushroomexpert.com/galerina_marginata.html']
        ]
      },
      {
        id:'milk-caps',
        title:'Рыжики и волосистые млечники',
        description:'На сравнение влияют характер опушения края шляпки и изменения окраски.',
        entries:[
          ['Lactarius deliciosus','Оранжевая окраска и концентрические зоны на шляпке.',firstNature('Lactarius deliciosus')],
          ['Lactarius deterrimus','На оранжевой шляпке с возрастом могут появляться зеленоватые участки.',firstNature('Lactarius deterrimus')],
          ['Lactarius torminosus','Край шляпки заметно опушён. Цвет часто розоватый с концентрическими полосами.',firstNature('Lactarius torminosus')]
        ]
      }
    ],
    publications:[
      {latin:'Ganoderma lucidum', name:'Трутовик лакированный', group:'Древесные',
       note:'Керженский заповедник приводит этот вид в списке редких грибов, отмеченных на его территории.',url:reserve},
      {latin:'Helvella lacunosa', name:'Лопастник ямчатый', group:'Сумчатые',
       note:'Керженский заповедник включает этот вид в опубликованный перечень своих находок.',url:reserve},
      {latin:'Hericium clathroides', name:'Герициум разветвлённый', group:'Шиповатые',
       note:'Керженский заповедник отмечает вид на древесине лиственных пород.',url:reserve},
      {latin:'Clavariadelphus pistillaris', name:'Клавариадельфус пестиковый', group:'Другие',
       note:'В опубликованном перечне Керженского заповедника указаны две находки.',url:reserve},
      {latin:'Aporpium macroporum', name:'Апорпиум крупнопоровый', group:'Древесные',
       note:'В перечне Керженского заповедника указана единичная находка.',url:reserve}
    ]
  };
  if (typeof module === 'object' && module.exports) module.exports = data;
  if (root) root.MoOLVaAtlas50Data = data;
})(typeof window === 'undefined' ? null : window);
