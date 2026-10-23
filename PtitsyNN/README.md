# Птицы Нижегородской области — Windows 2.5

Настоящее **настольное приложение для Windows 10/11 x64**, а не сайт в браузере.

## Состав
- Перечень из **298 подтверждённых в исходном опубликованном списке видов** с русскими и научными названиями.
- Поиск по названию, фильтрация по группам и по наличию материалов.
- Фотографии реальных птиц, скачиваемые для сборки с Wikimedia Commons при наличии разрешённой лицензии и идентификации вида.
- **Настоящие записи пения/криков птиц**, а не TTS-имитация, по свободным лицензиям; отдельно можно озвучить текст системным голосом Windows.
- Русские статьи из Википедии при наличии идентифицируемого соответствия, с указанием источника и лицензии CC BY-SA 4.0.
- Дневник наблюдений, резервная копия JSON, экспорт CSV для Excel, избранное, полностью офлайн после установки.
- Авторы/лицензии/ссылка для каждого добавленного фото и аудио.
- Нейтральная отметка об отсутствии данных: ни вымышленных птиц, ни анимации, ни синтетических природных голосов.

## Сборка EXE
1. На GitHub откройте **Actions → Птицы НН — Windows EXE → Run workflow**.
2. Workflow на Windows загружает свободно лицензированные медиа по Wikimedia API и статьи Русской Википедии, создаёт локальную базу с отчётом комплектности.
3. После проверки исходников и базы создаёт **инсталлятор Setup.exe** и **portable.exe** через electron-builder/NSIS.
4. Скачайте артефакт **Ptitsy-NN-2.1-Windows** (ZIP), распакуйте и запустите установщик. Интернет для использования готовой программы не нужен.

**Важно:** программа не утверждает, что для всех 298 видов уже найдены фото, записи или полные статьи. Точные числа отражены в приложении и в `coverage.json` в артефакте. Загрузка может зависеть от доступности Wikimedia во время GitHub Actions. Не подменяйте отсутствие файла анимацией или записью другого вида.

Исходный региональный перечень: https://www.oiseaux.net/en/oiseaux/russia/famille.nizhegorodskaya.oblast.html . Данные и лицензии медиа: https://commons.wikimedia.org/ . Тексты: https://ru.wikipedia.org/ .

## Локальная сборка
Установите Node.js 22+ и Python 3.11+:
```powershell
cd PtitsyNN
python -m pip install requests
python scripts/make_catalog.py
npm install
npm test
npm run build:win
```
Инсталляторы будут в `dist`. EXE не подписан кодовым сертификатом издателя, поэтому Windows может показать SmartScreen; отключать системную защиту не нужно.

Личный дневник хранится в профиле Electron Windows. При удалении приложения рекомендуется предварительно экспортировать JSON.

## Источники и права
Исходники программы © MoOLVa. Текстовые материалы Википедии — CC BY-SA 4.0 (соответствующие авторы), и фото/аудио — на условиях указанных индивидуальных свободных лицензий. Коммерческое распространение требует соблюдения условий каждого файла и лицензии текстов. Авторы и ссылки сохранены в каталоге, не следует удалять их.


## Изменения версии 2.1 (22.10.2026)
- Более широкий подбор **настоящих фотографий**: Wikimedia Commons, фотографии на английских страницах Википедии и исследовательские наблюдения iNaturalist с подходящими лицензиями CC0/CC BY/CC BY-SA.
- Поиск **настоящих записей голосов** в Wikimedia Commons и iNaturalist по идентифицированному виду; поддержка xeno-canto API v3, если установлен GitHub Actions secret `XENO_CANTO_API_KEY`.
- Медиатека только офлайн: исходники, автор и лицензия сохраняются рядом с каждой записью в `app/data.js`.
- Если файл отсутствует или лицензия не разрешает распространение, у вида сохраняется отметка об отсутствии, вместо синтетических или неподходящих материалов.
- Кэш прежних лицензированных файлов и содержимого карточек сохраняется между сборками; новые запросы выполняются преимущественно для пустых карточек.
- В `data/coverage.json` отражаются реальные количества фотографий, записей и статей, а также распределение по источникам.
- Увеличено время выполнения GitHub Actions до 160 минут из-за проверки лицензий и внешних источников.

### Дополнительные голоса xeno-canto (необязательно)
xeno-canto API v3 требует бесплатный личный ключ. Для подключения своего ключа откройте GitHub → Settings → Secrets and variables → Actions → New repository secret, имя: `XENO_CANTO_API_KEY`, значение: личный ключ из https://xeno-canto.org/account . Без ключа сборка продолжает работать за счёт Wikimedia Commons и iNaturalist. Никогда не вставляйте ключ в код, лог или переписку. Голоса из xeno-canto включаются только если конкретная запись разрешена для распространения.


## Версия 2.2 — приоритет достоверности голосов птиц
- Звуки iNaturalist **не используются**: случайные наблюдения содержали разговоры и слишком тихую птицу.
- Приоритет: явно определённые по виду записи xeno-canto с разрешённой лицензией (при наличии личного API-ключа), затем категории аудиофайлов конкретного вида в Wikimedia Commons, затем поиск видовых записей Wikimedia.
- Автоматическое выравнивание громкости, высокочастотная фильтрация гула и ограничение длительности звучания выполняются перед упаковкой EXE.
- Если проверенной видовой записи не найдено — звуковая кнопка отключена. Не заменяем оригиналы синтетикой и случайным аудио.
- Все фото сохраняются вместе со сведениями об авторе, источнике и открытой лицензии.

## Version 2.4: world bird voice collection

Expanded licensed audio search to exact-species Wikimedia Commons audio categories, open field recordings from Russia and the British Library archived on Commons. Matches scientific binomials plus manually vetted taxonomic synonyms (e.g. Chloris chloris / Carduelis chloris). File-specific license, author and original source are mandatory. Mixed bird soundscapes, iNaturalist generic ambient audio and human speech are excluded by metadata checks. Recordings are normalized by the existing audio curator; unavailable licensed recordings remain explicitly missing instead of receiving a similar species' call. The optional xeno-canto API remains gated on XENO_CANTO_API_KEY in GitHub Secrets. See data/coverage.json for exact coverage after build.

Additional 2.4 source: Openverse (https://openverse.org/), restricted to individually licensed CC BY, CC BY-SA, CC0, or public-domain audio, with the exact scientific binomial in the sound's title. Only source links from Freesound, Wikimedia Commons and Internet Archive are permitted; other sound libraries must provide explicit offline redistribution permission. Openverse credits include creator, license, URL, and index information. All accepted audio is converted to normalized, offline-playable MP3 in curate_audio.py.


## MoOLVa 2.5 — «Голоса PRO»

- В каждой карточке встроен аудиоплеер: громкость, перемотка, повтор, замедление/ускорение с сохранением высоты тона.
- Отдельная вкладка «Сравнение голосов»: два выбранных вида, последовательное проигрывание без наложения.
- Пользователь может пометить запись как тихую, содержащую человеческую речь, шум либо ошибочный вид и выгрузить локальный JSON-отчёт. Никаких внешних отправок.
- Техническая экспертиза аудио в GitHub Actions на FFmpeg: проверка декодирования, громкости, тишины, одинаковых файлов для разных видов. Результаты: `data/audio-audit.csv`, `data/audio-audit.json`.
- Техническая проверка **не доказывает**, что на записи отсутствует человеческая речь или что птица определена правильно. Поле `audioHumanReviewed=0` отражает отсутствие индивидуального прослушивания человеком.
- Сохраняем предыдущую офлайн-базу реальных фотографий и статей, а для видов без допустимого звука не показываем подставной голос.
