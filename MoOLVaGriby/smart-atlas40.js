'use strict';

(function (root) {
  const questions = {
    surface: {
      label: 'Нижняя поверхность',
      prompt: 'Что видно под шляпкой?',
      values: {pores:'Трубочки / поры', gills:'Пластинки', folds:'Складки / жилки', spines:'Шипики', other:'Иное строение'}
    },
    cap: {
      label: 'Поверхность шляпки',
      prompt: 'Как выглядит поверхность шляпки?',
      values: {slimy:'Слизистая', scaly:'С чешуйками', flakes:'С хлопьями', cracked:'Растрескавшаяся', cells:'Ячеистая', lobed:'С крупными извилистыми складками'}
    },
    stem: {
      label: 'Поверхность ножки',
      prompt: 'Какой рисунок заметен на ножке?',
      values: {net:'Сетка', scales:'Чешуйки', velvet:'Бархатистая'}
    },
    ring: {
      label: 'Кольцо на ножке',
      prompt: 'Заметно ли кольцо на ножке?',
      values: {yes:'Кольцо описано', no:'Кольцо отсутствует'}
    },
    volva: {
      label: 'Вольва у основания',
      prompt: 'Видна ли вольва у основания ножки?',
      values: {yes:'Вольва описана', no:'Вольва отсутствует'}
    },
    capColor: {
      label: 'Окраска шляпки',
      prompt: 'Какой основной цвет шляпки?',
      values: {brown:'Коричневая / бурая', orange:'Оранжевая', red:'Красная', green:'Зеленоватая', pale:'Светлая / белая', pink:'Розовая', grey:'Серая', yellow:'Жёлтая', dark:'Тёмная', redOrange:'Красно-оранжевая'}
    },
    poreTone: {
      label: 'Цвет пор у зрелого гриба',
      prompt: 'Какого цвета поры у зрелого гриба?',
      values: {olive:'Желтовато-оливковые', pink:'Розовые', yellow:'Жёлтые'}
    },
    shape: {
      label: 'Форма плодового тела',
      prompt: 'Какой формы плодовое тело?',
      values: {sphere:'Шаровидная', cells:'Ячеистая шляпка', lobes:'Извилисто-лопастная шляпка',
        funnel:'Воронковидная', shelf:'Боковая полка', hoof:'Копытообразная', round:'Округлая', growth:'Растрескавшийся нарост'}
    },
    bodyTone: {
      label: 'Окраска плодового тела',
      prompt: 'Какой цвет преобладает у плодового тела?',
      values: {dark:'Тёмная или чёрная', pale:'Светлая', multi:'Разноцветные зоны', sulphur:'Серно-жёлтая'}
    },
    gillShape: {
      label: 'Форма пластинок',
      prompt: 'Как расположены пластинки?',
      values: {down:'Спускаются по ножке', forked:'Раздваиваются'}
    }
  };

  // Traits use the base atlas, structural groups, and the cited sources below.
  // Missing entries remain unknown; for example, a disappearing ring is never coded as absent.
  const profiles = {
    g001:{stem:'net',capColor:'brown',poreTone:'olive'}, g002:{stem:'net',poreTone:'pink'},
    g003:{stem:'scales',capColor:'brown'}, g004:{stem:'scales',capColor:'redOrange'},
    g005:{cap:'slimy',ring:'yes',capColor:'brown'}, g006:{cap:'slimy',ring:'no',poreTone:'yellow'},
    g007:{capColor:'brown',poreTone:'yellow'}, g008:{cap:'cracked'}, g010:{gillShape:'forked',capColor:'orange'},
    g011:{shape:'funnel',bodyTone:'dark'},
    g015:{capColor:'pale',shape:'funnel'}, g016:{capColor:'pink'}, g017:{capColor:'pale'}, g018:{cap:'slimy',capColor:'dark'},
    g019:{cap:'cracked',capColor:'green'}, g020:{volva:'no',capColor:'green'}, g021:{capColor:'red'}, g022:{volva:'no'},
    g024:{cap:'scaly',ring:'yes'}, g025:{cap:'scaly'},
    g026:{surface:'gills',gillShape:'down'}, g027:{surface:'gills'},
    g028:{surface:'gills',stem:'velvet',capColor:'orange'}, g029:{surface:'gills'}, g030:{surface:'gills',capColor:'brown'},
    g031:{ring:'yes',volva:'yes'}, g032:{ring:'yes',volva:'yes'},
    g033:{cap:'flakes',capColor:'red'}, g034:{cap:'flakes',capColor:'brown'}, g036:{ring:'yes',volva:'yes',capColor:'yellow'},
    g037:{gillShape:'down'}, g040:{gillShape:'down',capColor:'pale'},
    g042:{cap:'cells',shape:'cells'}, g043:{cap:'lobed',shape:'lobes'}, g044:{shape:'sphere'}, g045:{shape:'sphere'},
    g046:{surface:'pores',shape:'shelf',bodyTone:'multi'}, g047:{surface:'pores',shape:'hoof'},
    g048:{surface:'pores',shape:'round',bodyTone:'pale'}, g049:{shape:'growth',bodyTone:'dark'},
    g050:{surface:'pores',shape:'shelf',bodyTone:'sulphur'}, g053:{capColor:'grey'}
  };
  const traitSources = {
    g001:'https://www.mushroomexpert.com/boletus_edulis.html',
    g002:'https://mushrooms.linnaeus.naturalis.nl/linnaeus_ng/app/views/species/nsr_taxon.php?id=100547',
    g007:'https://www.mushroomexpert.com/imleria_badia.html'
  };
  const surfaces = {
    Трубчатые:'pores', Пластинчатые:'gills', Складчатые:'folds', Шиповатые:'spines',
    Млечники:'gills', Мухоморы:'gills', Паутинники:'gills', Сумчатые:'other', Гастероидные:'other'
  };
  const aliases = {
    g001:['боровик','беловик'], g002:['горчак'],
    g003:['березовик','обабок'], g004:['осиновик','обабок'],
    g005:['масленок обыкновенный'], g010:['говорушка оранжевая'], g013:['рыжик сосновый'],
    g017:['волнушка белая'], g026:['устричный гриб'], g028:['фламмулина','зимний опенок'],
    g031:['мухомор зеленый'], 
    g044:['дождевик шиповатый'], g045:['головач гигантский'], g049:['березовый гриб']
  };
  const glossary = {
    gills: {title:'Пластинки', part:'surface', desc:'Тонкие радиальные перегородки под шляпкой. Их форму и место соединения с ножкой описывают отдельно.'},
    pores: {title:'Трубочки и поры', part:'pores', desc:'Трубочки образуют слой под шляпкой. Их открытые концы видны снаружи как мелкие отверстия — поры.'},
    folds: {title:'Складки', part:'surface', desc:'Рельефные жилки под шляпкой. Они заметно толще тонких пластинок и могут ветвиться.'},
    spines: {title:'Шипики', part:'surface', desc:'Вытянутые выступы на нижней поверхности плодового тела.'},
    ring: {title:'Кольцо', part:'ring', desc:'Остаток частного покрывала вокруг ножки. У некоторых видов кольцо меняется или исчезает с возрастом.'},
    volva: {title:'Вольва', part:'volva', desc:'Остаток общего покрывала у основания ножки. У некоторых видов он имеет вид мешочка, чашечки или ободка.'},
    down: {title:'Нисходящие пластинки', part:'down', desc:'Пластинки, которые продолжаются ниже места соединения шляпки с ножкой.'},
    net: {title:'Сетка на ножке', part:'net', desc:'Пересекающиеся выступающие линии на поверхности ножки, образующие рисунок из ячеек.'}
  };
  function glossaryFor(species) {
    const profile = traitsOf(species);
    return [profile.surface,profile.ring && 'ring',profile.volva && 'volva',profile.gillShape,profile.stem]
      .filter(key => Object.hasOwn(glossary,key));
  }
  const naturalSurface = {
    pores:/\b(?:pores|porous)\b|губк|трубоч|трубчат|порист|(?:^| )пор[ыа](?: |$)/u,
    gills:/пластин/u, folds:/складк|складчат|жилк/u, spines:/шипик/u
  };
  const normalize = value => String(value ?? '').toLowerCase().replaceAll('ё','е')
    .normalize('NFC').replace(/[^a-zа-я0-9]+/gu,' ').trim();
  const labelValue = (key,value) => questions[key].values[value];
  const traitsOf = species => ({
    surface:Object.hasOwn(surfaces,species.group) ? surfaces[species.group] : undefined,
    ...profiles[species.id]
  });

  function comparison(first, second, differencesOnly) {
    const left = traitsOf(first);
    const right = traitsOf(second);
    return Object.entries(questions).flatMap(([key, question]) => {
      const a = left[key];
      const b = right[key];
      const differs = Boolean(a && b && a !== b);
      if ((!a && !b) || (differencesOnly && !differs)) return [];
      return [{key, label:question.label, a:labelValue(key,a), b:labelValue(key,b), differs}];
    });
  }

  function identify(species, answers, skipped) {
    const selected = Object.entries(answers).filter(([key,value]) => Object.hasOwn(questions,key) &&
      Object.hasOwn(questions[key].values,value));
    const assessed = species.map(item => {
      const profile = traitsOf(item);
      const matched = selected.filter(([key,value]) => profile[key] === value).map(([key]) => key);
      const unknown = selected.filter(([key,value]) => !profile[key] ||
        ((key==='ring'||key==='volva') && value==='no' && profile[key]==='yes')).map(([key]) => key);
      const conflicts = selected.filter(([key]) => !matched.includes(key) && !unknown.includes(key)).map(([key]) => key);
      return {item,profile,matched,unknown,conflicts};
    });
    const compatible = assessed.filter(row => row.conflicts.length===0);
    const ranked = compatible.filter(row => row.matched.length)
      .sort((a,b) => b.matched.length-a.matched.length || a.item.name.localeCompare(b.item.name,'ru'));
    const pool = selected.length && ranked.length ? ranked : compatible;
    const possible = Object.keys(questions).filter(key => !Object.hasOwn(answers,key) && !skipped.includes(key));
    let next = selected.length ? undefined : possible[0];
    let best = 0;
    for (const key of possible) {
      const counts = Object.keys(questions[key].values).map(value =>
        pool.filter(row => row.profile[key] === value).length);
      const known = counts.reduce((total,count) => total + count,0);
      const score = known ** 2 - counts.reduce((total,count) => total + count ** 2,0);
      if ((!next || selected.length) && score > best) {
        next = key;
        best = score;
      }
    }
    return {ranked, next, excluded:assessed.filter(row=>row.conflicts.length), undocumented:compatible.length-ranked.length};
  }

  function editDistance(first, second) {
    let row = Array.from({length:second.length+1},(_,i) => i);
    for (const [i,character] of Array.from(first).entries()) {
      const next = [i+1];
      for (let j=1;j<=second.length;j++) {
        next[j] = Math.min(row[j]+1,next[j-1]+1,row[j-1]+Number(character!==second[j-1]));
      }
      row = next;
    }
    return row[second.length];
  }

  function makeSearch(species, transliterate) {
    const index = [...species].sort((a,b) => a.name.localeCompare(b.name,'ru')).map(item => {
      const name = [item.name,item.latin,...(aliases[item.id] || [])].map(normalize);
      const exact = [...new Set([...name,...name.map(transliterate)])];
      const text = normalize([item.group,item.traits,item.habitat].join(' '));
      return {item, exact, words:new Set(exact.flatMap(part => part.split(' '))), text, translit:transliterate(text)};
    });
    return function search(input, allowed) {
      const query = normalize(input).slice(0,100);
      const rows = index.filter(row => allowed.has(row.item));
      if (!query) return rows.map(row => row.item);
      const surface = Object.entries(naturalSurface).find(([,rule]) => rule.test(query))?.[0];
      let remaining = query;
      if (surface) {
        const filler = new Set(['под','шляпкой','шляпку','шляпки','шляпка','гриб','грибы','у','и','с','со','на','есть']);
        remaining = query.split(' ').filter(word => !filler.has(word) && !naturalSurface[surface].test(word)).join(' ');
      }
      const tokens = (surface ? remaining : query).split(' ').filter(Boolean);
      const simple = rows.map(row => {
        if (row.exact.includes(query)) return {item:row.item,score:4};
        if (surface && traitsOf(row.item).surface !== surface) return null;
        if (!tokens.length) return {item:row.item,score:2};
        if (tokens.every(token => row.exact.some(name => name.includes(token)))) return {item:row.item,score:3};
        if (tokens.every(token => row.text.includes(token) || row.translit.includes(token))) return {item:row.item,score:1};
        return null;
      }).filter(Boolean);
      if (simple.length) return simple.sort((a,b) => b.score-a.score).map(row => row.item);
      if (surface || !tokens.length || tokens.length>4) return [];
      return rows.filter(row => tokens.every(token => token.length<=24 && [...row.words].some(word =>
        word === token || (token.length>=4 && Math.abs(word.length-token.length)<=2 &&
          editDistance(token,word) <= (token.length>=8 ? 2 : 1))))).map(row => row.item);
    };
  }

  const api = {questions, glossary, glossaryFor, aliases, traitSources, labelValue, traitsOf, comparison, identify, makeSearch};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MoOLVaAtlas40 = api;
})(typeof window === 'undefined' ? null : window);
