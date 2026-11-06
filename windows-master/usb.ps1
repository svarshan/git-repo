param([switch]$UiSmokeTest,[switch]$SafetySmokeTest)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$form=New-Object Windows.Forms.Form
$form.Text='MoOLVa 2.0 — создание USB UEFI';$form.Size=New-Object Drawing.Size(940,720);$form.StartPosition='CenterScreen'
function Label([string]$text,[int]$x,[int]$y,[int]$w,[int]$h){$l=New-Object Windows.Forms.Label;$l.Text=$text;$l.SetBounds($x,$y,$w,$h);$form.Controls.Add($l);return $l}
function Button([string]$text,[int]$x,[int]$y,[int]$w){$b=New-Object Windows.Forms.Button;$b.Text=$text;$b.SetBounds($x,$y,$w,38);$form.Controls.Add($b);return $b}
[void](Label '1. Выберите ISO Windows. Запись поддерживает UEFI; будут удалены ВСЕ разделы выбранного USB.' 20 15 870 30)
$iso=New-Object Windows.Forms.TextBox;$iso.SetBounds(20,50,690,28);$form.Controls.Add($iso)
$browse=Button 'Выбрать ISO' 720 44 170
[void](Label '2. Выберите USB и проверьте модель, объём и серийный номер:' 20 105 850 28)
$disks=New-Object Windows.Forms.ComboBox;$disks.SetBounds(20,138,690,35);$disks.DropDownStyle='DropDownList';$form.Controls.Add($disks)
$refresh=Button 'Обновить USB' 720 132 170
$detail=New-Object Windows.Forms.TextBox;$detail.SetBounds(20,190,870,105);$detail.Multiline=$true;$detail.ReadOnly=$true;$detail.ScrollBars='Vertical';$form.Controls.Add($detail)
[void](Label '3. Для подтверждения введите точно: УДАЛИТЬ НОМЕР_ДИСКА (например УДАЛИТЬ 2)' 20 310 870 25)
$confirm=New-Object Windows.Forms.TextBox;$confirm.SetBounds(20,345,480,28);$form.Controls.Add($confirm)
$start=Button 'Записать флешку' 520 338 190
$verify=Button 'Проверить файлы' 720 338 170
$status=New-Object Windows.Forms.TextBox;$status.SetBounds(20,400,870,235);$status.Multiline=$true;$status.ReadOnly=$true;$status.ScrollBars='Vertical';$form.Controls.Add($status)
$script:targets=@();$script:job=$null
function Log([string]$m){$status.AppendText($m+"`r`n")}
function RefreshTargets {
 $disks.Items.Clear();$script:targets=@()
 try {
  foreach($d in @(Get-Disk | Where-Object { $_.BusType -eq 'USB' -and -not $_.IsBoot -and -not $_.IsSystem -and -not $_.IsReadOnly -and -not $_.IsOffline })){
   $parts=@(Get-Partition -DiskNumber $d.Number -ErrorAction SilentlyContinue | Where-Object DriveLetter | ForEach-Object {"$($_.DriveLetter):"})
   $row=[pscustomobject]@{number=[int]$d.Number;size=[uint64]$d.Size;unique=[string]$d.UniqueId;serial=[string]$d.SerialNumber;path=[string]$d.Path;name=[string]$d.FriendlyName;letters=($parts -join ', ')}
   $script:targets+=,$row;[void]$disks.Items.Add(('Диск {0} | {1} | {2:N1} ГБ | {3} | S/N: {4}' -f $row.number,$row.name,($row.size/1GB),$row.letters,$row.serial))
  }
  if($disks.Items.Count -gt 0){$disks.SelectedIndex=0}else{Log 'USB-накопители для записи не найдены.'}
 }catch{Log ('Ошибка получения USB: '+$_.Exception.Message)}
}
$disks.Add_SelectedIndexChanged({if($disks.SelectedIndex -ge 0){$d=$script:targets[$disks.SelectedIndex];$detail.Text="Диск: $($d.number)`r`nМодель: $($d.name)`r`nОбъём: $([math]::Round($d.size/1GB,2)) ГБ`r`nБуквы: $($d.letters)`r`nСерийный номер: $($d.serial)`r`nИдентификатор: $($d.unique)";$confirm.Clear()}})
$browse.Add_Click({$d=New-Object Windows.Forms.OpenFileDialog;$d.Filter='Образ ISO|*.iso';if($d.ShowDialog() -eq 'OK'){$iso.Text=$d.FileName}})
$refresh.Add_Click({RefreshTargets})
$verify.Add_Click({
 if($disks.SelectedIndex -lt 0){return}
 $t=$script:targets[$disks.SelectedIndex];$found=$false
 foreach($p in @(Get-Partition -DiskNumber $t.number -ErrorAction SilentlyContinue | Where-Object DriveLetter)){
  $root=([string]$p.DriveLetter)+':\';$boot=Test-Path (Join-Path $root 'sources\boot.wim');$efi=(Test-Path (Join-Path $root 'efi\boot\bootx64.efi')) -or (Test-Path (Join-Path $root 'efi\boot\bootaa64.efi'))
  $setup=Test-Path (Join-Path $root 'setup.exe');$wim=(Test-Path (Join-Path $root 'sources\install.wim')) -or (Test-Path (Join-Path $root 'sources\install.esd')) -or (Test-Path (Join-Path $root 'sources\install.swm'))
  Log ("Проверка $root : setup=$setup; boot.wim=$boot; EFI=$efi; install=$wim. Наличие файлов не гарантирует загрузку.");$found=$true
 }
 if(-not $found){Log 'Нет доступного раздела с буквой.'}
})
$worker={param($chosen,$isoPath,$exePath)
 $ErrorActionPreference='Stop';$mountedByUs=$false
 function DiskForPath([string]$p){
  $root=[IO.Path]::GetPathRoot([IO.Path]::GetFullPath($p));if($root -notmatch '^[A-Za-z]:\\$'){throw 'ISO и MoOLVa должны находиться на локальных дисках с буквами.'}
  return [int](Get-Partition -DriveLetter $root[0] -ErrorAction Stop).DiskNumber
 }
 function CheckTarget($expected,$isoFile,$launcher){
  $current=Get-Disk -Number $expected.number -ErrorAction Stop
  if($current.BusType -ne 'USB' -or $current.IsBoot -or $current.IsSystem -or $current.IsReadOnly -or $current.IsOffline){throw 'Выбранный диск больше не соответствует безопасным условиям USB.'}
  if([string]::IsNullOrWhiteSpace($expected.unique) -or [string]::IsNullOrWhiteSpace($expected.serial) -or [string]::IsNullOrWhiteSpace($expected.path)){throw 'У USB нет достаточных идентификаторов; используйте другое средство записи.'}
  if([string]$current.UniqueId -ne $expected.unique -or [string]$current.SerialNumber -ne $expected.serial -or [string]$current.Path -ne $expected.path -or [uint64]$current.Size -ne $expected.size){throw 'USB изменился после выбора. Обновите список.'}
  $copies=@(Get-Disk | Where-Object {([string]$_.UniqueId -eq $expected.unique) -or ([string]$_.Path -eq $expected.path)})
  if($copies.Count -ne 1){throw 'Идентификатор USB неоднозначен.'}
  if((DiskForPath $isoFile) -eq $expected.number -or (DiskForPath $launcher) -eq $expected.number -or (DiskForPath $env:SystemRoot) -eq $expected.number){throw 'Целевой USB содержит Windows, ISO или MoOLVa. Выберите другую флешку.'}
  foreach($page in @(Get-CimInstance Win32_PageFileUsage -ErrorAction Stop)){if((DiskForPath $page.Name) -eq $expected.number){throw 'Целевой диск используется файлом подкачки.'}}
 }
 try {
  if(-not (Test-Path -LiteralPath $isoPath -PathType Leaf)){throw 'ISO не найден.'}
  if([string]::IsNullOrWhiteSpace($exePath) -or -not (Test-Path -LiteralPath $exePath -PathType Leaf)){throw 'Не удалось проверить расположение программы. Запускайте официальный Portable EXE.'}
  foreach($command in @('Get-Disk','Get-Partition','Get-DiskImage','Mount-DiskImage','Dismount-DiskImage','Clear-Disk','Initialize-Disk','New-Partition','Format-Volume','robocopy.exe','dism.exe')){if(-not (Get-Command $command -ErrorAction SilentlyContinue)){throw ('Не найдена необходимая команда: '+$command)}}
  CheckTarget $chosen $isoPath $exePath
  [pscustomobject]@{kind='status';text='Подключение ISO и предварительная проверка...'}
  $image=Get-DiskImage -ImagePath $isoPath -ErrorAction Stop
  if(-not $image.Attached){$image=Mount-DiskImage -ImagePath $isoPath -PassThru -ErrorAction Stop;$mountedByUs=$true}
  $vol=@($image | Get-Volume | Where-Object DriveLetter | Select-Object -First 1)
  if($vol.Count -ne 1){throw 'Не удалось определить букву подключённого ISO.'}
  $source=([string]$vol[0].DriveLetter)+':\'
  $efi=(Test-Path (Join-Path $source 'efi\boot\bootx64.efi')) -or (Test-Path (Join-Path $source 'efi\boot\bootaa64.efi'))
  if(-not $efi -or -not (Test-Path (Join-Path $source 'setup.exe')) -or -not (Test-Path (Join-Path $source 'sources\boot.wim'))){throw 'В ISO нет необходимых файлов установщика Windows для UEFI.'}
  $imageWim=Join-Path $source 'sources\install.wim';$imageEsd=Join-Path $source 'sources\install.esd'
  if(-not (Test-Path $imageWim) -and -not (Test-Path $imageEsd) -and -not (Test-Path (Join-Path $source 'sources\install.swm'))){throw 'Не найден install.wim, install.esd или install.swm.'}
  $files=@(Get-ChildItem -LiteralPath $source -File -Recurse -Force -ErrorAction Stop)
  $fatLimit=[uint64]4294967295;$wimSplit=$false
  foreach($f in $files){if([uint64]$f.Length -gt $fatLimit){if($f.FullName -ieq $imageWim){$wimSplit=$true}else{throw ('Файл превышает 4 ГБ и не поддерживается для FAT32: '+$f.FullName)}}}
  $sum=($files | Measure-Object -Property Length -Sum).Sum
  $partitionBytes=[uint64][math]::Min(([double]$chosen.size - 268435456),[double](30GB))
  if($partitionBytes -lt 4GB -or $sum+512MB -gt $partitionBytes){throw 'На создаваемом FAT32-разделе недостаточно места для ISO.'}
  CheckTarget $chosen $isoPath $exePath
  [pscustomobject]@{kind='status';text=('Очистка USB-диска '+$chosen.number+' и создание FAT32-раздела...')}
  Clear-Disk -Number $chosen.number -RemoveData -RemoveOEM -Confirm:$false -ErrorAction Stop
  Initialize-Disk -Number $chosen.number -PartitionStyle MBR -ErrorAction Stop | Out-Null
  $p=New-Partition -DiskNumber $chosen.number -Size $partitionBytes -AssignDriveLetter -IsActive -ErrorAction Stop
  $p | Format-Volume -FileSystem FAT32 -NewFileSystemLabel 'MOOLVA_WIN' -Confirm:$false -Force -ErrorAction Stop | Out-Null
  $destination=([string]$p.DriveLetter)+':\'
  if($destination -notmatch '^[A-Z]:\\$'){throw 'Не удалось определить букву нового раздела.'}
  [pscustomobject]@{kind='status';text='Копирование установочных файлов. Это может занять много времени...'}
  $args=@($source,$destination,'/E','/COPY:DAT','/DCOPY:DAT','/R:1','/W:1','/NFL','/NDL','/NJH','/NJS','/NP')
  if($wimSplit){$args+=@('/XF',$imageWim)}
  & robocopy.exe @args | Out-Null;$rc=$LASTEXITCODE
  if($rc -ge 8){throw ('Ошибка копирования robocopy: '+$rc)}
  if($wimSplit){
   [pscustomobject]@{kind='status';text='Разделение большого install.wim на части для FAT32...'}
   & dism.exe '/English' '/Split-Image' ("/ImageFile:$imageWim") ("/SWMFile:$($destination)sources\install.swm") '/FileSize:3800' | Out-Null
   if($LASTEXITCODE -ne 0){throw ('Ошибка разделения DISM: '+$LASTEXITCODE)}
  }
  $ok=(Test-Path (Join-Path $destination 'setup.exe')) -and (Test-Path (Join-Path $destination 'sources\boot.wim')) -and ((Test-Path (Join-Path $destination 'efi\boot\bootx64.efi')) -or (Test-Path (Join-Path $destination 'efi\boot\bootaa64.efi'))) -and ((Test-Path (Join-Path $destination 'sources\install.wim')) -or (Test-Path (Join-Path $destination 'sources\install.esd')) -or (Test-Path (Join-Path $destination 'sources\install.swm')))
  if(-not $ok){throw 'Копирование завершено, но обязательные файлы не найдены.'}
  [pscustomobject]@{kind='success';text=('Готово: '+$destination+' Основные файлы найдены. Проверьте реальную загрузку через UEFI Boot Menu.')}
 }catch{[pscustomobject]@{kind='error';text=('Операция не завершена: '+$_.Exception.Message+'. Если очистка уже началась, флешку потребуется подготовить заново.')}}
 finally{if($mountedByUs){Dismount-DiskImage -ImagePath $isoPath -ErrorAction SilentlyContinue | Out-Null}}
}
if($SafetySmokeTest){
 $dummy1=[IO.Path]::GetTempFileName();$dummy2=[IO.Path]::GetTempFileName()
 try {
  $expected=[pscustomobject]@{number=7;size=[uint64](16GB);unique='expected-id';serial='serial-7';path='virtual-path'}
  function Get-Disk { [CmdletBinding()] param($Number) return $script:fakeDisk }
  function Get-Partition { [CmdletBinding()] param($DriveLetter) return [pscustomobject]@{DiskNumber=7} }
  function Get-CimInstance { [CmdletBinding()] param($ClassName) return @() }
  function Clear-Disk { [CmdletBinding()] param($Number,[switch]$RemoveData,[switch]$RemoveOEM) throw 'DESTRUCTIVE STEP REACHED' }
  $scenarios=@(
   @{boot=$true;system=$false;bus='USB';uid='expected-id';expect='безопасным условиям'},
   @{boot=$false;system=$true;bus='USB';uid='expected-id';expect='безопасным условиям'},
   @{boot=$false;system=$false;bus='SATA';uid='expected-id';expect='безопасным условиям'},
   @{boot=$false;system=$false;bus='USB';uid='changed-id';expect='USB изменился'},
   @{boot=$false;system=$false;bus='USB';uid='expected-id';expect='содержит Windows'}
  )
  foreach($case in $scenarios){
   $script:fakeDisk=[pscustomobject]@{Number=7;BusType=$case.bus;IsBoot=$case.boot;IsSystem=$case.system;IsReadOnly=$false;IsOffline=$false;UniqueId=$case.uid;SerialNumber='serial-7';Path='virtual-path';Size=[uint64](16GB)}
   $result=@(& $worker $expected $dummy1 $dummy2)
   if(-not @($result|Where-Object {$_.kind -eq 'error' -and $_.text.Contains($case.expect)}).Count){throw ('Safety scenario failed: '+$case.expect+' / '+($result|Out-String))}
  }
  Write-Output 'USB safety scenarios passed';exit 0
 } catch {Write-Error $_;exit 1} finally{Remove-Item $dummy1,$dummy2 -Force -ErrorAction SilentlyContinue}
}
$timer=New-Object Windows.Forms.Timer;$timer.Interval=500
$timer.Add_Tick({if($null -eq $script:job){return};foreach($e in @(Receive-Job $script:job -ErrorAction SilentlyContinue)){if($e.text){Log $e.text}}
 if($script:job.State -in @('Completed','Failed','Stopped')){if($script:job.State -eq 'Failed'){Log ('Ошибка фонового процесса: '+$script:job.ChildJobs[0].JobStateInfo.Reason)};Remove-Job $script:job -Force -ErrorAction SilentlyContinue;$script:job=$null;$start.Enabled=$true;$refresh.Enabled=$true;$browse.Enabled=$true;$disks.Enabled=$true;$verify.Enabled=$true}})
$timer.Start()
$start.Add_Click({
 if($disks.SelectedIndex -lt 0){[void][Windows.Forms.MessageBox]::Show('Выберите USB.');return}
 $t=$script:targets[$disks.SelectedIndex];$expected=('УДАЛИТЬ {0}' -f $t.number)
 if($confirm.Text.Trim() -cne $expected){[void][Windows.Forms.MessageBox]::Show(('Введите точно: '+$expected));return}
 if(-not (Test-Path -LiteralPath $iso.Text -PathType Leaf)){[void][Windows.Forms.MessageBox]::Show('Выберите существующий ISO.');return}
 $msg="Будут уничтожены ВСЕ разделы и данные на USB:`r`nДиск $($t.number): $($t.name), $([math]::Round($t.size/1GB,1)) ГБ`r`nБуквы: $($t.letters)`r`nСерийный номер: $($t.serial)`r`n`r`nПродолжить?"
 if([Windows.Forms.MessageBox]::Show($msg,'Окончательное подтверждение','YesNo','Warning') -ne 'Yes'){return}
 $start.Enabled=$false;$refresh.Enabled=$false;$browse.Enabled=$false;$disks.Enabled=$false;$verify.Enabled=$false;$confirm.Clear()
 try{$script:job=Start-Job -ScriptBlock $worker -ArgumentList @($t,$iso.Text,$env:MOOLVA_LAUNCHER_PATH);Log 'Проверка перед записью...'}catch{$start.Enabled=$true;$refresh.Enabled=$true;$browse.Enabled=$true;$disks.Enabled=$true;$verify.Enabled=$true;Log ('Ошибка: '+$_.Exception.Message)}
})
$form.Add_FormClosing({param($sender,$e) if($null -ne $script:job){$e.Cancel=$true;[void][Windows.Forms.MessageBox]::Show('Дождитесь окончания записи.')}})
if($UiSmokeTest){$script:smoke=New-Object Windows.Forms.Timer;$script:smoke.Interval=1500;$script:smoke.Add_Tick({$script:smoke.Stop();$form.Close()});$script:smoke.Start()}else{RefreshTargets}
[void]$form.ShowDialog();$timer.Stop();$timer.Dispose()
