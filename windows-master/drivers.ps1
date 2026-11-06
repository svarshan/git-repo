# MoOLVa Windows Master: driver discovery via Windows Update Agent.
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding
try {
  Write-Host 'MoOLVa — поиск драйверов через Windows Update' -ForegroundColor Cyan
  Write-Host 'Потребуется интернет. Поиск может занять несколько минут.'
  $session=New-Object -ComObject Microsoft.Update.Session
  $searcher=$session.CreateUpdateSearcher()
  $searcher.Online=$true
  # Searcher's default update service follows this PC's Windows Update / WSUS policy.
  $result=$searcher.Search("IsInstalled=0 and IsHidden=0 and Type='Driver'")
  $updates=New-Object -ComObject Microsoft.Update.UpdateColl
  $skipped=0
  foreach($u in $result.Updates) {
    # Firmware can be classified as Driver. Treat names only as an extra precaution;
    # the operator must review the list before installation.
    if($u.Title -match '(?i)firmware|\bbios\b|\buefi\b|прошивк|микропрограмм') {
      Write-Host ("ПРОПУЩЕНО (возможная прошивка): " + $u.Title) -ForegroundColor Yellow
      $skipped++; continue
    }
    if(-not $u.EulaAccepted) {
      Write-Host ("ПРОПУЩЕНО (требуется принятие лицензии в Windows Update): " + $u.Title) -ForegroundColor Yellow
      $skipped++; continue
    }
    [void]$updates.Add($u)
  }
  if($result.Warnings.Count -gt 0){ Write-Host 'Windows Update вернул предупреждения. Проверьте настройки обновления, если список неполный.' -ForegroundColor Yellow }
  if($updates.Count -eq 0) {
    Write-Host 'Подходящие доступные драйверы не найдены. Это не означает, что все драйверы установлены.' -ForegroundColor Yellow
    Write-Host 'Проверьте Диспетчер устройств и сайт производителя по точной модели.'
  } else {
    Write-Host "`nНАЙДЕНО: $($updates.Count). Проверьте список, в том числе наличие прошивок."
    for($i=0;$i -lt $updates.Count;$i++) { Write-Host ("{0}. {1}" -f ($i+1),$updates.Item($i).Title) }
    Write-Host "`nУстановка может изменить работу оборудования и потребовать перезагрузку."
    Write-Host 'Если в списке есть прошивка или есть сомнения, отмените и используйте Windows Update вручную.'
    $answer=Read-Host 'Введите ДА для загрузки и установки ВСЕХ перечисленных драйверов'
    if($answer.Trim().ToUpperInvariant() -ne 'ДА') { Write-Host 'Установка отменена.'; return }
    $downloader=$session.CreateUpdateDownloader()
    $downloader.Updates=$updates
    Write-Host 'Загрузка...'
    $download=$downloader.Download()
    Write-Host ("Общий код загрузки: {0}" -f $download.ResultCode)
    $ready=New-Object -ComObject Microsoft.Update.UpdateColl
    for($i=0;$i -lt $updates.Count;$i++) {
      $u=$updates.Item($i)
      $dr=$download.GetUpdateResult($i)
      if($u.IsDownloaded) { [void]$ready.Add($u) }
      else { Write-Host ("Не загружен: {0}; код результата {1}; HRESULT {2}" -f $u.Title,$dr.ResultCode,$dr.HResult) -ForegroundColor Yellow }
    }
    if($ready.Count -eq 0){ Write-Host 'Нет загруженных драйверов для установки.'; return }
    $installer=$session.CreateUpdateInstaller()
    $installer.Updates=$ready
    Write-Host 'Установка... Дождитесь завершения.'
    $installed=$installer.Install()
    $names=@('Не запущено','Выполняется','Успешно','Успешно с ошибками','Ошибка','Прервано')
    for($i=0;$i -lt $ready.Count;$i++) {
      $itemResult=$installed.GetUpdateResult($i)
      $code=[int]$itemResult.ResultCode
      $label=if($code -ge 0 -and $code -lt $names.Count){$names[$code]}else{"Код $code"}
      Write-Host ("{0}: {1}; HRESULT {2}" -f $ready.Item($i).Title,$label,$itemResult.HResult)
    }
    if($installed.RebootRequired){ Write-Host 'Требуется перезагрузка. Перезагрузите компьютер самостоятельно после сохранения работы.' -ForegroundColor Yellow }
    Write-Host 'Проверьте оставшиеся ошибки устройств в Диспетчере устройств.'
  }
} catch {
  Write-Host ("Ошибка: " + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'Проверьте интернет, доступ к Windows Update, службы и ограничения организации. Затем используйте официальный сайт производителя.'
} finally {
  Write-Host ''
  [void](Read-Host 'Нажмите Enter, чтобы закрыть окно')
}
