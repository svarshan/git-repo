param([switch]$UiSmokeTest)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$form=New-Object Windows.Forms.Form
$form.Text='MoOLVa — драйверы Windows Update'
$form.StartPosition='CenterScreen'; $form.Size=New-Object Drawing.Size(950,720); $form.MinimumSize=New-Object Drawing.Size(850,650)
$form.BackColor=[Drawing.Color]::FromArgb(16,23,36);$form.ForeColor=[Drawing.Color]::White
$label=New-Object Windows.Forms.Label
$label.SetBounds(20,15,880,58);$label.Text='Драйверы ищутся через Windows Update. Проверьте названия: автоматическое выявление прошивок не гарантирует их полного исключения.'
$form.Controls.Add($label)
$list=New-Object Windows.Forms.CheckedListBox
$list.SetBounds(20,80,890,340);$list.Anchor='Top,Left,Right';$list.CheckOnClick=$true
$list.HorizontalScrollbar=$true; $list.BackColor=[Drawing.Color]::FromArgb(28,39,55);$list.ForeColor=[Drawing.Color]::White
$form.Controls.Add($list)
$status=New-Object Windows.Forms.TextBox
$status.SetBounds(20,480,890,120);$status.Multiline=$true;$status.ScrollBars='Vertical';$status.ReadOnly=$true;$status.Anchor='Top,Left,Right'
$form.Controls.Add($status)
function Button([string]$text,[int]$x,[int]$width) {
 $b=New-Object Windows.Forms.Button;$b.Text=$text;$b.SetBounds($x,430,$width,38);$b.ForeColor=[Drawing.Color]::Black;$form.Controls.Add($b);return $b
}
$scan=Button 'Найти драйверы' 20 175
$select=Button 'Отметить доступные' 205 175
$install=Button 'Установить выбранные' 390 195
$save=Button 'Сохранить отчёт' 595 160
$script:job=$null;$script:items=@();$script:report=New-Object System.Collections.ArrayList
function Record([string]$line){$status.AppendText($line+"`r`n");[void]$script:report.Add($line)}
$scanScript={
 $ErrorActionPreference='Stop'
 try {
  [pscustomobject]@{kind='status';text='Поиск доступных драйверов. Пожалуйста, подождите...'}
  $session=New-Object -ComObject Microsoft.Update.Session
  $searcher=$session.CreateUpdateSearcher();$searcher.Online=$true
  $result=$searcher.Search("IsInstalled=0 and IsHidden=0 and Type='Driver'")
  foreach($u in $result.Updates){
   $firmware=($u.Title -match '(?i)firmware|\bbios\b|\buefi\b|прошивк|микропрограмм')
   $eligible=((-not $firmware) -and $u.EulaAccepted)
   $reason=if($firmware){'ВОЗМОЖНАЯ ПРОШИВКА: исключено'}elseif(-not $u.EulaAccepted){'Требует принятия лицензии в Windows Update'}else{'Доступен'}
   [pscustomobject]@{kind='driver';title=$u.Title;id=$u.Identity.UpdateID;revision=$u.Identity.RevisionNumber;eligible=$eligible;reason=$reason}
  }
  [pscustomobject]@{kind='status';text=('Поиск завершён. Найдено: '+$result.Updates.Count+'. Нулевой результат не гарантирует наличие всех драйверов.')}
 } catch { [pscustomobject]@{kind='error';text=('Ошибка поиска: '+$_.Exception.Message)} }
}
$installScript={param([string[]]$ids)
 $ErrorActionPreference='Stop'
 try {
  [pscustomobject]@{kind='status';text='Повторная проверка доступности выбранных драйверов...'}
  $session=New-Object -ComObject Microsoft.Update.Session
  $searcher=$session.CreateUpdateSearcher();$searcher.Online=$true
  $r=$searcher.Search("IsInstalled=0 and IsHidden=0 and Type='Driver'")
  $chosen=New-Object -ComObject Microsoft.Update.UpdateColl
  foreach($u in $r.Updates){
   $key=('{0}:{1}' -f $u.Identity.UpdateID,$u.Identity.RevisionNumber)
   if(($ids -contains $key) -and $u.EulaAccepted -and ($u.Title -notmatch '(?i)firmware|\bbios\b|\buefi\b|прошивк|микропрограмм')){[void]$chosen.Add($u)}
  }
  if($chosen.Count -eq 0){throw 'Выбранные обновления больше недоступны. Повторите поиск.'}
  [pscustomobject]@{kind='status';text=('Загрузка выбранных драйверов: '+$chosen.Count+'. Это может занять несколько минут.')}
  $downloader=$session.CreateUpdateDownloader();$downloader.Updates=$chosen;$download=$downloader.Download()
  $ready=New-Object -ComObject Microsoft.Update.UpdateColl
  for($i=0;$i -lt $chosen.Count;$i++){
   $u=$chosen.Item($i);$dr=$download.GetUpdateResult($i)
   if($u.IsDownloaded){[void]$ready.Add($u);[pscustomobject]@{kind='status';text=('Загружен: '+$u.Title)}}
   else{[pscustomobject]@{kind='error';text=('Не загружен: '+$u.Title+'; HRESULT '+$dr.HResult)}}
  }
  if($ready.Count -eq 0){throw 'Нет загруженных драйверов для установки.'}
  [pscustomobject]@{kind='status';text='Установка. Дождитесь завершения, не закрывайте окно.'}
  $installer=$session.CreateUpdateInstaller();$installer.Updates=$ready;$res=$installer.Install()
  $names=@('Не запущено','Выполняется','Успешно','Успешно с ошибками','Ошибка','Прервано')
  for($i=0;$i -lt $ready.Count;$i++){
   $ur=$res.GetUpdateResult($i);$n=[int]$ur.ResultCode;$text=if($n -ge 0 -and $n -lt $names.Count){$names[$n]}else{"Код $n"}
   [pscustomobject]@{kind='status';text=('{0}: {1}; HRESULT {2}' -f $ready.Item($i).Title,$text,$ur.HResult)}
  }
  if($res.RebootRequired){[pscustomobject]@{kind='status';text='Требуется перезагрузка. Сохраните работу и перезагрузите ПК самостоятельно.'}}
  [pscustomobject]@{kind='status';text='Проверьте оставшиеся ошибки в Диспетчере устройств.'}
 } catch {[pscustomobject]@{kind='error';text=('Ошибка: '+$_.Exception.Message)}}
}
$timer=New-Object Windows.Forms.Timer;$timer.Interval=500
$timer.Add_Tick({
 if($null -eq $script:job){return}
 foreach($e in @(Receive-Job -Job $script:job -ErrorAction SilentlyContinue)){
  if($e.kind -eq 'driver'){
   $script:items+=,$e;[void]$list.Items.Add(('{0} — {1}' -f $e.reason,$e.title),$false)
  } elseif($e.kind -in @('status','error')){Record $e.text}
 }
 if($script:job.State -in @('Completed','Failed','Stopped')){
  if($script:job.State -eq 'Failed'){Record ('Фоновая задача завершилась с ошибкой: '+$script:job.ChildJobs[0].JobStateInfo.Reason)}
  Remove-Job $script:job -Force -ErrorAction SilentlyContinue;$script:job=$null
  $scan.Enabled=$true;$select.Enabled=$true;$install.Enabled=$true;$save.Enabled=$true
 }
})
$timer.Start()
$scan.Add_Click({
 if($null -ne $script:job){return};$list.Items.Clear();$script:items=@();Record 'Начат поиск.'
 $scan.Enabled=$false;$select.Enabled=$false;$install.Enabled=$false;$save.Enabled=$false
 try {$script:job=Start-Job -ScriptBlock $scanScript} catch {Record ('Ошибка запуска: '+$_.Exception.Message);$scan.Enabled=$true;$select.Enabled=$true;$install.Enabled=$true;$save.Enabled=$true}
})
$select.Add_Click({for($i=0;$i -lt $script:items.Count;$i++){if($script:items[$i].eligible){$list.SetItemChecked($i,$true)}}})
$list.Add_ItemCheck({param($sender,$e) if($e.NewValue -eq [Windows.Forms.CheckState]::Checked -and -not $script:items[$e.Index].eligible){$e.NewValue=[Windows.Forms.CheckState]::Unchecked}})
$install.Add_Click({
 $ids=@(foreach($i in $list.CheckedIndices){'{0}:{1}' -f $script:items[$i].id,$script:items[$i].revision})
 if($ids.Count -eq 0){[void][Windows.Forms.MessageBox]::Show('Отметьте доступные драйверы.');return}
 $ok=[Windows.Forms.MessageBox]::Show("Установить выбранные драйверы: $($ids.Count)? Проверьте список на прошивки. Установка может потребовать перезагрузку.",'Подтверждение','YesNo','Warning')
 if($ok -ne [Windows.Forms.DialogResult]::Yes){return}
 $scan.Enabled=$false;$select.Enabled=$false;$install.Enabled=$false;$save.Enabled=$false
 try{$script:job=Start-Job -ScriptBlock $installScript -ArgumentList (,$ids)}catch{Record ('Ошибка запуска: '+$_.Exception.Message);$scan.Enabled=$true;$select.Enabled=$true;$install.Enabled=$true;$save.Enabled=$true}
})
$save.Add_Click({
 $d=New-Object Windows.Forms.SaveFileDialog;$d.Filter='Текстовый файл|*.txt';$d.FileName='MoOLVa_Drivers_Report.txt'
 if($d.ShowDialog() -eq 'OK'){
  $lines=@('MoOLVa — результаты драйверов',('Дата: '+(Get-Date)))+@($script:report)+@('','Устройства с ошибками:')
  try {$lines+=@(Get-CimInstance Win32_PnPEntity | Where-Object {$_.ConfigManagerErrorCode -ne 0} | ForEach-Object {"$($_.Name) — код $($_.ConfigManagerErrorCode)"})} catch {$lines+='Не удалось получить список устройств.'}
  [IO.File]::WriteAllLines($d.FileName,[string[]]$lines,(New-Object Text.UTF8Encoding($true)))
 }
})
$form.Add_FormClosing({param($sender,$e) if($null -ne $script:job){$e.Cancel=$true;[void][Windows.Forms.MessageBox]::Show('Дождитесь завершения текущей операции.')}})
Record 'Нажмите «Найти драйверы». Для работы необходим интернет и доступ к Windows Update.'
if($UiSmokeTest){$script:smokeTimer=New-Object Windows.Forms.Timer;$script:smokeTimer.Interval=1500;$script:smokeTimer.Add_Tick({$script:smokeTimer.Stop();$form.Close()});$script:smokeTimer.Start()}
[void]$form.ShowDialog()
$timer.Stop();$timer.Dispose()
