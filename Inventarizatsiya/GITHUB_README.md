# Инвентаризация 1.0.1 — исправление запуска

Приложение Windows WPF .NET 8, каталог 768 товаров. Исходники включены в Inventarizatsiya/source.zip.

В workflow выполняется компиляция, два тестовых запуска WPF с открытием каждой вкладки и публикация установщика с EXE. При ошибке в `%LOCALAPPDATA%\\Inventarizatsiya\\logs\\startup.log` сохраняется полная диагностика, а база `%LOCALAPPDATA%\\Inventarizatsiya\\inventory.db` не удаляется при обновлении.
