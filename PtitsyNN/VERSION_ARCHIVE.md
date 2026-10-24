# MoOLVa «Птицы Нижегородской области» — восстановление версий

> Архив GitHub хранит **исходники** в отдельных ветках и **готовые Windows EXE**
> в GitHub Releases. Временные Artifacts из Actions не служат долговременным архивом.

## Проверенные архивные исходники

- 5.0: [archive/ptitsy-5.0-source](https://github.com/svarshan/git-repo/tree/archive/ptitsy-5.0-source/PtitsyNN)
  (снимок коммита `53c303a08187f355eb3d68deca4fc23498b5ff97`).
- 6.0: [archive/ptitsy-6.0-source](https://github.com/svarshan/git-repo/tree/archive/ptitsy-6.0-source/PtitsyNN)
  (снимок коммита `c0a45e590ff23fc899d826d366322dd99a5bf2ed`).
- 6.3.1: [archive/ptitsy-6.3.1-source](https://github.com/svarshan/git-repo/tree/archive/ptitsy-6.3.1-source/PtitsyNN)
  (снимок коммита `704f8c579f6e9661c363e847d7afb143dccbd2b8`).

Архивная ветка — не копия Portable EXE, и снимок 5.0 **не гарантирует**
побайтового совпадения с ранее выданным EXE. Фотографии, аудио и веса AI
частично скачиваются или восстанавливаются из кэша во время сборки;
без внешних источников и кэшей воспроизведение может быть неполным.

## Как скачать EXE после успешной Windows-сборки

1. Перейдите на https://github.com/svarshan/git-repo/releases
2. Выберите нужную **PtitsyNN** версию (тег `ptitsy-vX.Y.Z`).
3. В разделе **Assets** скачайте `MoOLVa-X.Y.Z-Portable-x64.exe`
   или `MoOLVa-X.Y.Z-Setup-x64.exe`.
4. Скачайте `SHA256SUMS.txt`; для проверки:
   `Get-FileHash .\MoOLVa-X.Y.Z-Portable-x64.exe -Algorithm SHA256`
5. Сохраните собственную копию на SSD, флешке или в облачном хранилище.
   GitHub Releases более устойчивы к истечению срока Artifacts, но не заменяют
   независимое резервное копирование.

Если в Releases нет версии, сборка или публикация не завершилась —
не считайте её готовой.

## Что делать, если очередная сборка оборвалась

1. Откройте https://github.com/svarshan/git-repo/branches
2. Найдите `archive/ptitsy-...` и откройте нужную версию исходников.
3. При необходимости скачайте ZIP исходников через Code → Download ZIP,
   выбрав архивную ветку, или восстановите файлы в рабочую ветку.
4. Можно вручную запустить сборку из https://github.com/svarshan/git-repo/actions/workflows/ptitsy-nn-windows.yml
   через **Run workflow**, оставив `source_ref` пустым для master либо
   указав ветку из архива. У старых версий требования к сборке могут отличаться,
   поэтому восстановление с их исходниками не гарантирует успешный запуск
   обновлённого pipeline.

## Автоматическая защита нового выпуска

- Перед тяжёлой загрузкой медиа сохраняется неизменяемый по правилам CI
  снимок кода с SHA в `archive/ptitsy-X.Y.Z-build-SHA`.
- После успешных тестов и сборки проверяются оба EXE (>30 МБ) и их SHA256.
- Только после этого CI создаёт отдельный Release с тегом `ptitsy-vX.Y.Z`.
- Если Release с таким тегом уже есть, он **не перезаписывается**.
  Чтобы выложить изменённую версию, увеличьте номер версии в `package.json`.
- Ни одно новое обновление не удаляет прежние Releases или архивные ветки.

**Важно:** уже выданные вне GitHub EXE (например, локально собранная
6.3 RESTORED) не появляются в GitHub Releases автоматически.
