# MoOLVa Windows Master Portable 1.3 - native Windows desktop utility
# Requires Windows PowerShell 5.1, Windows 10/11, .NET Windows Forms
# No disks, partitions or BIOS settings are changed by this application.
# Copyright (c) 2026 MoOLVa - educational / personal use.

$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
} catch {
    Write-Host "Для запуска требуется Windows и .NET Framework: $_" -ForegroundColor Red
    Read-Host 'Нажмите Enter'
    exit 1
}
[System.Windows.Forms.Application]::EnableVisualStyles()

function Color([string]$hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
$script:Bg = Color '#101724'
$script:PanelBg = Color '#172235'
$script:SidebarBg = Color '#0C1320'
$script:Text = Color '#F4F6FA'
$script:Muted = Color '#BAC5D6'
$script:Yellow = Color '#FFC447'
$script:Border = Color '#2A3B53'

$script:Manufacturers = [ordered]@{
    'HP (ноутбуки / ПК)' = @{
        Boot = 'Esc, затем F9'; Bios = 'Esc, затем F10'
        Steps = '1. Полностью выключите ПК и вставьте загрузочную флешку.\r\n2. Включите устройство и сразу несколько раз нажимайте Esc — откроется Startup Menu.\r\n3. Нажмите F9 — Boot Device Options.\r\n4. Выберите пункт вида UEFI: USB... и нажмите Enter.\r\n5. Для настройки BIOS вместо F9 нажмите F10.\r\nЗачем: F9 выбирает загрузку с флешки один раз, без изменения порядка загрузки.'
        Url='https://support.hp.com/ch-de/document/ish_6930187-6931079-16?fallbackLocale=us-en&validated=true'
        Drivers='https://support.hp.com/drivers'
    }
    'Dell / Alienware' = @{
        Boot='F12'; Bios='F2'
        Steps='1. Вставьте установочную флешку в выключенный компьютер.\r\n2. Включите его и нажимайте F12 сразу при появлении логотипа Dell.\r\n3. Выберите One-time Boot Menu: UEFI USB Storage Device (или название флешки).\r\n4. Нажмите Enter.\r\n5. F2 открывает BIOS/UEFI для просмотра параметров.\r\nЗачем: F12 временно выбирает устройство загрузки и не меняет настройки BIOS.'
        Url='https://www.dell.com/support/kbdoc/en-us/000126121/access-uefi-bios-system-setup-from-windows-on-your-dell-system'
        Drivers='https://www.dell.com/support/home/drivers'
    }
    'Lenovo IdeaPad / Yoga' = @{
        Boot='F12 / Fn+F12 / Novo'; Bios='F2 / Fn+F2 / Novo'
        Steps='1. Подключите загрузочную флешку и выключите ноутбук.\r\n2. При запуске часто нажимайте F12 или Fn+F12.\r\n3. Выберите UEFI USB и нажмите Enter.\r\n4. Если F12 не срабатывает, проверьте кнопку Novo (доступна не на всех моделях).\r\n5. Через Novo Boot Menu выберите Boot Menu. Для BIOS используйте F2/Fn+F2 или BIOS Setup из Novo.\r\nЗачем: загрузка через F12/Novo обычно не требует постоянных изменений в BIOS.'
        Url='https://smartsupport.lenovo.com/in/en/solutions/ht500207'
        Drivers='https://pcsupport.lenovo.com/'
    }
    'Lenovo ThinkPad / ThinkCentre' = @{
        Boot='F12 / Fn+F12'; Bios='F1'
        Steps='1. Выключите компьютер, подключите флешку.\r\n2. Включите и быстро нажимайте F12 (при необходимости Fn+F12) у логотипа Lenovo.\r\n3. Выберите UEFI USB и нажмите Enter.\r\n4. Для входа в BIOS обычно используют F1.\r\n5. Если списка нет, проверьте в BIOS настройку Boot Device List F12 Option.\r\nЗачем: выбор устройства действует только на одну загрузку.'
        Url='https://support.lenovo.com/pk/en/solutions/ht104668'
        Drivers='https://pcsupport.lenovo.com/'
    }
    'ASUS (ноутбуки / ПК)' = @{
        Boot='Esc (часть ноутбуков) / F8 в BIOS'; Bios='F2 (часть ПК: Del)'
        Steps='1. Выключите ноутбук ASUS и вставьте установочную флешку.\r\n2. Для входа в BIOS на ноутбуке удерживайте F2, затем нажмите кнопку питания.\r\n3. В интерфейсе UEFI откройте Boot Menu (часто клавиша F8).\r\n4. Выберите UEFI: USB... и нажмите Enter.\r\n5. На ряде ноутбуков Boot Menu можно открыть удержанием Esc при включении.\r\nВажно: клавиши и названия пунктов зависят от модели; сверьтесь с руководством ASUS.\r\nЗачем: разовая загрузка с флешки для запуска установщика.'
        Url='https://www.asus.com/global/support/faq/1013017/'
        Drivers='https://www.asus.com/support/download-center/'
    }
    'Acer' = @{
        Boot='F12 (иногда нужно включить в BIOS)'; Bios='F2 (на ПК также Del)'
        Steps='1. Подключите подготовленную USB-флешку.\r\n2. Сразу после включения нажимайте F12 — откроется Boot Menu.\r\n3. Выберите USB-накопитель и нажмите Enter.\r\n4. Если F12 не открывает меню, войдите в BIOS клавишей F2 (на настольных ПК может быть Del).\r\n5. Проверьте, доступна ли опция F12 Boot Menu. Не меняйте другие настройки без необходимости.\r\nЗачем: загрузиться с нужного устройства только один раз.'
        Url='https://community.acer.com/en/kb/articles/12915-changing-boot-order'
        Drivers='https://www.acer.com/support'
    }
    'MSI' = @{
        Boot='F11'; Bios='Del'
        Steps='1. Выключите компьютер и подключите USB-флешку.\r\n2. При включении быстро нажимайте F11 до появления выбора загрузки.\r\n3. Выберите UEFI: USB... и нажмите Enter.\r\n4. Для BIOS при старте нажимайте Delete (Del).\r\n5. В BIOS не изменяйте режимы накопителя, Secure Boot или TPM без ясной причины.\r\nЗачем: F11 позволяет однократно выбрать загрузочное устройство.'
        Url='https://ru.msi.com/support/technical_details/MB_Boot_OS_Entry'
        Drivers='https://www.msi.com/support/download'
    }
    'Samsung Galaxy Book' = @{
        Boot='F10'; Bios='F2'
        Steps='1. Полностью выключите Galaxy Book, подключите загрузочную USB-флешку.\r\n2. При включении сразу многократно нажимайте F10.\r\n3. В списке устройств выберите флешку и подтвердите выбор.\r\n4. Для входа в BIOS нажмите F2 при старте.\r\n5. Если F10 не работает, проверьте официальный материал именно для вашей модели.\r\nЗачем: выбрать USB только для текущей загрузки.'
        Url='https://www.samsung.com/us/support/answer/ANS10002820/'
        Drivers='https://www.samsung.com/global/galaxybooks-downloadcenter/'
    }
    'Huawei MateBook (проверить модель)' = @{
        Boot='F12 (для ряда моделей)'; Bios='F2 (для ряда моделей)'
        Steps='1. Уточните полную модель MateBook на наклейке или в Windows.\r\n2. Подключите загрузочную флешку и перезагрузите ПК.\r\n3. На ряде моделей F12 открывает меню загрузки, F2 — BIOS.\r\n4. Выберите загрузку UEFI USB, если она доступна.\r\n5. Если сочетание не подходит, найдите руководство именно для модели.\r\nЗачем: разные поколения MateBook могут иметь разный UEFI и настройки.'
        Url='https://consumer.huawei.com/cn/support/content/zh-cn15827647/'
        Drivers='https://consumer.huawei.com/en/support/'
    }
    'Gigabyte (материнские платы / ПК)' = @{
        Boot='F12'; Bios='Del'
        Steps='1. Подключите подготовленный USB-накопитель.\r\n2. Включите ПК и несколько раз нажмите F12 до загрузки Windows.\r\n3. Выберите UEFI: USB... и нажмите Enter.\r\n4. Для входа в BIOS нажимайте Del в начале запуска.\r\n5. На некоторых системах клавиши отображаются снизу стартового экрана.\r\nЗачем: F12 выбирает устройство однократно.'
        Url='https://download.gigabyte.com/FileList/Manual/desktop_pc_manual_aorus-prime-3-ap351_1002_e.pdf'
        Drivers='https://www.gigabyte.com/Support'
    }
}
$script:Software = [ordered]@{
  'Google Chrome'='Google.Chrome'
  'Mozilla Firefox'='Mozilla.Firefox'
  '7-Zip'='7zip.7zip'
  'VLC Media Player'='VideoLAN.VLC'
  'Notepad++'='Notepad++.Notepad++'
  'Visual Studio Code'='Microsoft.VisualStudioCode'
  'Microsoft PowerToys'='Microsoft.PowerToys'
  'LibreOffice'='TheDocumentFoundation.LibreOffice'
  'Telegram Desktop'='Telegram.TelegramDesktop'
  'SumatraPDF'='SumatraPDF.SumatraPDF'
}

$script:InstallSteps = @(
  @{Title='01 / Согласование и сохранение данных'; Body='Спросите, какие данные нужно сохранить: Рабочий стол, Документы, Загрузки, фотографии, закладки браузера, почтовые архивы, ключи программ. Согласуйте с владельцем чистую установку или обновление и версию Windows. Создайте резервную копию на внешний носитель, затем проверьте, что файлы открываются. Если включён BitLocker, убедитесь, что владелец имеет ключ восстановления. Не удаляйте ничего до подтверждения сохранности данных.'},
  @{Title='02 / Проверка совместимости и лицензии'; Body='Определите модель ПК, процессор, объём ОЗУ и свободное место. Проверьте поддержку Windows 11 в PC Health Check, наличие TPM 2.0 и UEFI/Secure Boot. Уточните редакцию Windows, соответствующую лицензии клиента. Windows 10 завершила обычную поддержку 14 октября 2025 года; предпочтительна совместимая Windows 11. Не обходите системные требования без информированного согласия и оценки рисков.'},
  @{Title='03 / Проверка готового загрузочного носителя'; Body='У вас уже есть загрузочные Windows, поэтому создавать флешку заново не требуется. Подключите свой USB-носитель, откройте раздел «Мои носители» и проверьте, виден ли он в системе. Выясните, какая редакция и версия Windows находится на флешке, и поддерживается ли выбранным компьютером режим UEFI. Наличие файлов setup.exe, boot.wim или ISO — лишь косвенные признаки: реальную загрузку проверьте через Boot Menu. Ничего не форматируйте без отдельного решения.'},
  @{Title='04 / Загрузка установщика (Boot Menu)'; Body='Вставьте флешку в компьютер клиента. Полностью выключите ПК, включите и многократно нажмите клавишу Boot Menu, указанную для его производителя. Выберите пункт UEFI с именем флешки. Однократный выбор загрузки предпочтительнее изменения BIOS. Если не получается, откройте раздел «Производители». Не меняйте Secure Boot, TPM, контроллер хранения и режим UEFI без необходимости.'},
  @{Title='05 / Установка Windows — осторожно с разделами'; Body='Выберите язык и раскладку, нажмите «Установить». Укажите подходящий выпуск и действующую лицензию. Если нужна чистая установка, внимательно определите целевой физический диск по объёму и назначению. УДАЛЕНИЕ РАЗДЕЛОВ УНИЧТОЖАЕТ ДАННЫЕ: ничего не удаляйте при сомнениях. Если ранее был согласован способ с сохранением файлов, не подменяйте его чистой установкой. Дождитесь установки и перезагрузок; не выбирайте флешку вновь, когда Windows запускается с диска.'},
  @{Title='06 / Первоначальная настройка'; Body='Выберите регион, раскладки и параметры приватности совместно с владельцем. Подключите сеть. Предоставьте клиенту возможность самостоятельно войти в свою учётную запись Microsoft и настроить PIN; не запрашивайте и не сохраняйте пароли. Проверьте активацию Windows и наличие шифрования устройства. Уточните, нужны ли клиенту синхронизация и резервное копирование.'},
  @{Title='07 / Драйверы, приложения, обновления'; Body='Откройте Windows Update и установите рекомендованные обновления. Проверьте Диспетчер устройств: неизвестных устройств быть не должно. Драйверы загружайте через Windows Update и официальный сайт производителя по точной модели. Не пользуйтесь сомнительными «пакетами драйверов». Через раздел «Программы» установите согласованный набор, затем просмотрите доступные обновления WinGet.'},
  @{Title='08 / Контроль качества и передача клиенту'; Body='Проверьте сеть, Wi-Fi, Bluetooth, звук, камеру, микрофон, USB, печать (если нужно), спящий режим и диски. Перезапустите ПК: Windows должна загружаться без флешки. Проверьте активацию и отсутствие жёлтых знаков в Диспетчере устройств. Зафиксируйте выполненную работу в разделе «Отчёт» и передайте клиенту его данные и рекомендации.'}
)

function LabelText([string]$txt, [int]$x, [int]$y, [int]$w, [int]$h, [int]$size=12, [bool]$bold=$false, [System.Drawing.Color]$fg=$script:Text) {
    $l = New-Object System.Windows.Forms.Label
    $l.Text=$txt; $l.Location=New-Object System.Drawing.Point($x,$y)
    $l.Size=New-Object System.Drawing.Size($w,$h)
    $l.ForeColor=$fg; $l.BackColor=[System.Drawing.Color]::Transparent
    $style= if($bold){[System.Drawing.FontStyle]::Bold}else{[System.Drawing.FontStyle]::Regular}
    $l.Font=New-Object System.Drawing.Font('Segoe UI',$size,$style)
    return $l
}
function MakeButton([string]$txt,[int]$x,[int]$y,[int]$w,[int]$h,[scriptblock]$action,[bool]$primary=$false) {
    $b=New-Object System.Windows.Forms.Button
    $b.Text=$txt; $b.Location=New-Object System.Drawing.Point($x,$y)
    $b.Size=New-Object System.Drawing.Size($w,$h)
    $b.FlatStyle='Flat'; $b.FlatAppearance.BorderSize=0; $b.Cursor='Hand'
    $b.Font=New-Object System.Drawing.Font('Segoe UI',10,[System.Drawing.FontStyle]::Bold)
    $b.BackColor=if($primary){$script:Yellow}else{$script:PanelBg}
    $b.ForeColor=if($primary){$script:SidebarBg}else{$script:Text}
    $b.Add_Click($action)
    return $b
}
function MakeTextBox([int]$x,[int]$y,[int]$w,[int]$h,[bool]$multi=$true) {
    $t = New-Object System.Windows.Forms.TextBox
    $t.Location=New-Object System.Drawing.Point($x,$y); $t.Size=New-Object System.Drawing.Size($w,$h)
    $t.Multiline=$multi; $t.ReadOnly=$true; $t.ScrollBars=if($multi){'Vertical'}else{'None'}
    $t.ForeColor=$script:Text; $t.BackColor=$script:PanelBg; $t.BorderStyle='FixedSingle'
    $t.Font=New-Object System.Drawing.Font('Segoe UI',11)
    return $t
}
function AddHeading([string]$title,[string]$subtitle) {
    $script:Content.Controls.Clear()
    $script:Content.Controls.Add((LabelText $title 32 22 925 48 23 $true))
    $script:Content.Controls.Add((LabelText $subtitle 35 71 925 50 10 $false $script:Muted))
}
function ShowMessage([string]$msg,[string]$title='MoOLVa Windows Master') {
    [void][System.Windows.Forms.MessageBox]::Show($msg,$title,'OK','Information')
}
function AskYes([string]$msg) {
    return ([System.Windows.Forms.MessageBox]::Show($msg,'Подтверждение','YesNo','Warning') -eq [System.Windows.Forms.DialogResult]::Yes)
}
function OpenSafeUrl([string]$url) {
    if ($url -notmatch '^https://') { ShowMessage 'Разрешены только официальные HTTPS-ссылки.'; return }
    try { Start-Process $url } catch { ShowMessage "Не получилось открыть браузер: $_" }
}
function HasWinget {
    return ($null -ne (Get-Command winget.exe -ErrorAction SilentlyContinue))
}
function StartWinget([string]$args) {
    if (-not (HasWinget)) {
        ShowMessage 'WinGet не найден. Установите или обновите «Установщик приложений» (App Installer) через Microsoft Store, затем перезапустите программу.'
        return
    }
    # Only fixed arguments or checked package identifiers defined in this script reach this function.
    try { Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k',"winget $args") }
    catch { ShowMessage "Не удалось запустить WinGet: $_" }
}
function GetHardware {
    $d=[ordered]@{}
    $d['Имя ПК']=$env:COMPUTERNAME
    try { $cs=Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop; $d['Производитель']=$cs.Manufacturer; $d['Модель']=$cs.Model; $d['ОЗУ (ГБ)']=[math]::Round($cs.TotalPhysicalMemory/1GB,1) } catch { $d['Модель']='Нет данных' }
    try { $os=Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop; $d['Windows']=$os.Caption; $d['Сборка']=$os.BuildNumber } catch {}
    try { $cpu=Get-CimInstance -ClassName Win32_Processor -ErrorAction Stop | Select-Object -First 1; $d['Процессор']=$cpu.Name } catch {}
    try { $bios=Get-CimInstance -ClassName Win32_BIOS -ErrorAction Stop; $d['BIOS']=$bios.SMBIOSBIOSVersion; $d['Серийный номер']=$bios.SerialNumber } catch {}
    try { $drv=Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction Stop; foreach($disk in $drv) { $d["Диск $($disk.DeviceID) свободно (ГБ)"]=[math]::Round($disk.FreeSpace/1GB,1) } } catch {}
    return $d
}
function FormatHardware {
    $h=GetHardware
    return (($h.GetEnumerator() | ForEach-Object { '{0}: {1}' -f $_.Key,$_.Value }) -join "`r`n")
}
function GetDeviceProblems {
    try {
        $bad=@(Get-CimInstance Win32_PnPEntity -ErrorAction Stop | Where-Object { $_.ConfigManagerErrorCode -ne 0 })
        if ($bad.Count -eq 0) { return 'Устройства с кодами ошибок не обнаружены (по данным Windows). Проверьте Диспетчер устройств вручную.' }
        return (($bad | Select-Object -First 60 | ForEach-Object { '{0} (код {1})' -f $_.Name, $_.ConfigManagerErrorCode }) -join "`r`n")
    } catch { return "Не получилось прочитать устройства: $_" }
}
function ShowHome {
    AddHeading 'Рабочее место мастера MoOLVa' 'Ваш личный рабочий инструмент для обслуживания компьютеров клиентов.'
    $script:Content.Controls.Add((LabelText 'КОМПЬЮТЕР, НА КОТОРОМ ЗАПУЩЕНА ПРОГРАММА' 35 125 850 25 10 $true $script:Yellow))
    $t=MakeTextBox 35 156 912 278; $t.Text=FormatHardware
    $script:Content.Controls.Add($t)
    $script:Content.Controls.Add((MakeButton 'Мастер установки Windows' 35 455 278 52 { ShowInstall } $true))
    $script:Content.Controls.Add((MakeButton 'Инструкции по производителям' 325 455 288 52 { ShowBrands }))
    $script:Content.Controls.Add((MakeButton 'Программы и обновления' 624 455 322 52 { ShowApps }))
    $script:Content.Controls.Add((LabelText 'ВАЖНО: приложение не форматирует диски, не меняет BIOS и не запускает установку Windows без вашего участия.' 35 534 900 74 11 $false $script:Muted))
    $script:Content.Controls.Add((MakeButton 'Создать флешку Windows' 35 628 290 44 { ShowUsbGuide } $true))
    $script:Content.Controls.Add((MakeButton 'Драйверы и интернет' 337 628 290 44 { ShowDrivers }))
    $script:Content.Controls.Add((MakeButton 'Мои USB / ISO' 640 628 290 44 { ShowMedia }))
}
function UpdateInstall {
    $s=$script:InstallSteps[$script:Step]
    $script:StepHead.Text=$s.Title
    $script:StepBody.Text=$s.Body
    $script:StepCount.Text=('Шаг {0} из {1}' -f ($script:Step+1),$script:InstallSteps.Count)
    $script:PrevButton.Enabled=($script:Step -gt 0)
    $script:NextButton.Text=if($script:Step -eq ($script:InstallSteps.Count-1)){'В начало'}else{'Следующий шаг  >'}
}
# Media inventory reads storage metadata only. It never modifies, formats or boots disks.
function GetUsbInventory {
    $lines=New-Object System.Collections.Generic.List[string]
    [void]$lines.Add('ПОДКЛЮЧЁННЫЕ USB-ДИСКИ (только чтение):')
    try {
        $usbDisks=@(Get-Disk -ErrorAction Stop | Where-Object { [string]$_.BusType -eq 'USB' })
        if($usbDisks.Count -eq 0) { [void]$lines.Add('USB-диски не обнаружены. Подключите носитель и нажмите «Обновить».') }
        foreach($d in $usbDisks) {
            $gb=[math]::Round([double]$d.Size/1GB,1)
            [void]$lines.Add(('Диск №{0}: {1}; {2} ГБ; {3}' -f $d.Number,$d.FriendlyName,$gb,$d.PartitionStyle))
            try {
                $parts=@(Get-Partition -DiskNumber $d.Number -ErrorAction Stop)
                foreach($p in $parts) {
                    if(-not $p.DriveLetter) { continue }
                    $root=('{0}:\' -f $p.DriveLetter)
                    $partsText=('{0}  {1} ГБ' -f $root,[math]::Round([double]$p.Size/1GB,1))
                    try {
                        $v=$p | Get-Volume -ErrorAction Stop
                        $partsText+=(' — {0} ({1})' -f $v.FileSystemLabel,$v.FileSystem)
                    } catch {}
                    [void]$lines.Add(('  ' + $partsText))
                    $bootWim=Test-Path -LiteralPath (Join-Path $root 'sources\boot.wim') -PathType Leaf
                    $uefi=Test-Path -LiteralPath (Join-Path $root 'efi\boot\bootx64.efi') -PathType Leaf
                    $setup=Test-Path -LiteralPath (Join-Path $root 'setup.exe') -PathType Leaf
                    if($bootWim -or $uefi -or $setup) {
                        $hints=New-Object System.Collections.Generic.List[string]
                        if($bootWim){[void]$hints.Add('sources\boot.wim')}
                        if($uefi){[void]$hints.Add('UEFI bootx64.efi')}
                        if($setup){[void]$hints.Add('setup.exe')}
                        [void]$lines.Add(('  Файлы установщика: ' + ($hints -join ', ')))
                    }
                }
            } catch { [void]$lines.Add(('  Разделы недоступны: ' + $_.Exception.Message)) }
        }
    } catch {
        [void]$lines.Add(('Не удалось получить список USB-дисков: ' + $_.Exception.Message))
    }
    [void]$lines.Add('')
    [void]$lines.Add('Наличие файлов Windows не гарантирует загрузку. Проверяйте флешку через Boot Menu конкретного устройства.')
    return ($lines -join "`r`n")
}
function GetImageFolderInventory([string]$folder) {
    if([string]::IsNullOrWhiteSpace($folder)) { return 'Папка с вашими ISO пока не выбрана. Укажите её при необходимости.' }
    if(-not (Test-Path -LiteralPath $folder -PathType Container)) { return 'Папка недоступна: '+$folder }
    $lines=New-Object System.Collections.Generic.List[string]
    [void]$lines.Add(('МОЯ ПАПКА: ' + $folder))
    try {
        # Enumerate one nesting level to avoid scanning an entire client disk.
        $files=@(Get-ChildItem -LiteralPath $folder -File -ErrorAction Stop | Where-Object { $_.Extension -in @('.iso','.wim','.esd') })
        $subdirs=@(Get-ChildItem -LiteralPath $folder -Directory -ErrorAction SilentlyContinue | Select-Object -First 30)
        foreach($sub in $subdirs) {
            $files+=@(Get-ChildItem -LiteralPath $sub.FullName -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in @('.iso','.wim','.esd') })
        }
        $files=@($files | Sort-Object FullName | Select-Object -First 60)
        if($files.Count -eq 0) { [void]$lines.Add('Файлы ISO, WIM или ESD в папке и её ближайших подпапках не найдены.') }
        foreach($f in $files) {
            [void]$lines.Add(('{0}  — {1} ГБ' -f $f.FullName,[math]::Round([double]$f.Length/1GB,2)))
        }
        if($files.Count -ge 60) { [void]$lines.Add('Показаны первые 60 файлов.') }
    } catch { [void]$lines.Add(('Ошибка чтения папки: ' + $_.Exception.Message)) }
    [void]$lines.Add('')
    [void]$lines.Add('Список файлов — справочный: ISO/WIM/ESD не подключаются и не запускаются автоматически.')
    return ($lines -join "`r`n")
}
function ShowMedia {
    AddHeading 'Мои загрузочные Windows и инструменты' 'Вы уже подготовили загрузочные Windows. Здесь — проверка подключённых USB и вашей папки с образами.'
    $script:Content.Controls.Add((LabelText 'USB-ДИСКИ И ПРИЗНАКИ УСТАНОВОЧНОГО НОСИТЕЛЯ' 35 123 905 28 10 $true $script:Yellow))
    $script:UsbInfo=MakeTextBox 35 154 912 221
    $script:Content.Controls.Add($script:UsbInfo)
    $script:Content.Controls.Add((MakeButton 'Обновить список USB' 35 389 285 45 { $script:UsbInfo.Text=GetUsbInventory } $true))
    $script:Content.Controls.Add((LabelText 'МОИ ISO / WIM / ESD (НЕОБЯЗАТЕЛЬНО)' 35 459 900 27 10 $true $script:Yellow))
    $script:ImageInfo=MakeTextBox 35 488 912 146
    $script:Content.Controls.Add($script:ImageInfo)
    $script:Content.Controls.Add((MakeButton 'Выбрать папку с образами' 35 645 310 45 {
        $dlg=New-Object System.Windows.Forms.FolderBrowserDialog
        $dlg.Description='Выберите папку, где хранятся ваши ISO, WIM или ESD. Программа ничего не изменит.'
        if($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            $script:ImageFolder=$dlg.SelectedPath
            $script:ImageInfo.Text=GetImageFolderInventory $script:ImageFolder
        }
        $dlg.Dispose()
    }))
    $script:Content.Controls.Add((MakeButton 'Открыть выбранную папку' 358 645 280 45 {
        if($script:ImageFolder -and (Test-Path -LiteralPath $script:ImageFolder -PathType Container)) {
            try { Start-Process -FilePath 'explorer.exe' -ArgumentList @($script:ImageFolder) }
            catch { ShowMessage "Не удалось открыть папку: $_" }
        } else { ShowMessage 'Сначала выберите папку с образами.' }
    }))
    $script:Content.Controls.Add((LabelText 'Это инвентаризация. Приложение не переписывает загрузочные флешки, не монтирует ISO и не изменяет разделы дисков.' 35 706 910 55 10 $false $script:Muted))
    $script:UsbInfo.Text=GetUsbInventory
    $script:ImageInfo.Text=GetImageFolderInventory $script:ImageFolder
}

function ShowInstall {
    AddHeading 'Установка Windows — пошаговый мастер' 'Каждый этап объясняет, что делать и зачем; важные решения остаются за мастером и клиентом.'
    $script:Content.Controls.Add((LabelText 'ПРОВЕРЬТЕ ДЕЙСТВИЯ ДО РАБОТЫ С ДИСКАМИ' 35 122 910 28 10 $true $script:Yellow))
    $script:StepHead=LabelText '' 35 168 915 54 18 $true
    $script:Content.Controls.Add($script:StepHead)
    $script:StepBody=MakeTextBox 35 235 910 320
    $script:Content.Controls.Add($script:StepBody)
    $script:StepCount=LabelText '' 35 574 220 40 11 $false $script:Muted
    $script:Content.Controls.Add($script:StepCount)
    $script:PrevButton=MakeButton '< Назад' 480 570 190 46 { if($script:Step -gt 0){$script:Step--; UpdateInstall} }
    $script:NextButton=MakeButton 'Следующий шаг >' 681 570 263 46 { if($script:Step -lt $script:InstallSteps.Count-1){$script:Step++}else{$script:Step=0}; UpdateInstall } $true
    $script:Content.Controls.Add($script:PrevButton); $script:Content.Controls.Add($script:NextButton)
    $script:Content.Controls.Add((MakeButton 'Перейти к клавишам BIOS / Boot Menu' 35 634 390 45 { ShowBrands }))
    $script:Content.Controls.Add((MakeButton 'Мои готовые Windows / USB' 440 634 350 45 { ShowMedia }))
    UpdateInstall
}
function UpdateBrands {
    $key=[string]$script:BrandCombo.SelectedItem
    if ([string]::IsNullOrWhiteSpace($key) -or -not $script:Manufacturers.Contains($key)) { return }
    $b=$script:Manufacturers[$key]
    $script:BrandBoot.Text='BOOT MENU:  '+$b.Boot
    $script:BrandBios.Text='BIOS / UEFI:  '+$b.Bios
    $script:BrandInstructions.Text=($b.Steps -replace '\\r\\n',"`r`n")
}
function ShowBrands {
    AddHeading 'Производители и клавиши загрузки' 'Выберите производителя. Приведены типичные способы — для конкретной модели проверяйте документацию.'
    $script:BrandCombo=New-Object System.Windows.Forms.ComboBox
    $script:BrandCombo.Location=New-Object System.Drawing.Point(35,129)
    $script:BrandCombo.Size=New-Object System.Drawing.Size(570,38)
    $script:BrandCombo.DropDownStyle='DropDown'; $script:BrandCombo.AutoCompleteMode='SuggestAppend'; $script:BrandCombo.AutoCompleteSource='ListItems'; $script:BrandCombo.Font=New-Object System.Drawing.Font('Segoe UI',12)
    $script:BrandCombo.BackColor=$script:PanelBg; $script:BrandCombo.ForeColor=$script:Text
    foreach($key in $script:Manufacturers.Keys){[void]$script:BrandCombo.Items.Add($key)}
    $script:BrandCombo.Add_SelectedIndexChanged({ UpdateBrands })
    $script:Content.Controls.Add($script:BrandCombo)
    $script:BrandBoot=LabelText '' 35 196 910 46 19 $true $script:Yellow
    $script:BrandBios=LabelText '' 35 254 910 46 17 $true
    $script:Content.Controls.Add($script:BrandBoot); $script:Content.Controls.Add($script:BrandBios)
    $script:BrandInstructions=MakeTextBox 35 325 911 280
    $script:Content.Controls.Add($script:BrandInstructions)
    $script:Content.Controls.Add((MakeButton 'Официальная инструкция' 35 626 275 48 { $b=$script:Manufacturers[[string]$script:BrandCombo.SelectedItem]; OpenSafeUrl $b.Url } $true))
    $script:Content.Controls.Add((MakeButton 'Официальные драйверы' 326 626 280 48 { $b=$script:Manufacturers[[string]$script:BrandCombo.SelectedItem]; OpenSafeUrl $b.Drivers }))
    $script:Content.Controls.Add((LabelText 'Совет: выбирайте UEFI USB в разовом Boot Menu; не отключайте защиту без причины.' 35 700 900 42 10 $false $script:Muted))
    $script:Content.Controls.Add((MakeButton 'Вход в BIOS из Windows / Linux' 35 755 390 48 { ShowFirmwareGuide }))
    $script:Content.Controls.Add((MakeButton 'Копировать клавиши BIOS / Boot' 430 755 425 48 {[Windows.Forms.Clipboard]::SetText($script:BrandBoot.Text+"`r`n"+$script:BrandBios.Text)}))
    $script:BrandCombo.SelectedIndex=0
}
function ShowFirmwareGuide {
    AddHeading 'Вход в BIOS / UEFI' 'Способ зависит от модели, режима загрузки и настроек компьютера.'
    $box=MakeTextBox 35 132 910 470
    $box.Text=@'
ОБЩИЙ СПОСОБ ДЛЯ WINDOWS И LINUX
Выключите компьютер. При включении сразу несколько раз нажимайте клавишу BIOS для конкретной модели. Например, для HP часто Esc, затем F10; для Dell — F2. Клавиши приведены в разделе «Производители». Они зависят от модели.

WINDOWS 10 / 11
Параметры → Система → Восстановление → Особые варианты загрузки → Перезагрузить сейчас. Затем: Поиск и устранение неисправностей → Дополнительные параметры → Параметры встроенного ПО UEFI → Перезагрузить. В Windows 10 путь к восстановлению может находиться в разделе «Обновление и безопасность». Сохраните открытые файлы перед перезагрузкой.

LINUX С SYSTEMD И UEFI
Сохраните работу и в терминале выполните: sudo systemctl reboot --firmware-setup
Команда сразу перезагрузит компьютер. Она работает только при поддержке со стороны UEFI и системы. В некоторых системах доступен пункт Firmware Settings в меню загрузки. Если способ недоступен — используйте клавишу производителя при включении.

BIOS и BOOT MENU — разные меню: Boot Menu выбирает загрузочное устройство, BIOS/UEFI открывает настройки компьютера. Установка ОС не определяет клавишу входа.
'@
    $script:Content.Controls.Add($box)
    $script:Content.Controls.Add((MakeButton 'Назад к производителям' 35 630 310 48 { ShowBrands }))
}
function ShowUsbGuide {
    AddHeading 'Установочная флешка Windows' 'Мастер Microsoft загрузит Windows и создаст установочный носитель.'
    $box=MakeTextBox 35 125 910 330
    $box.Text=@'
1. Используйте отдельную флешку для установщика Windows. Данные на ней будут удалены Microsoft Media Creation Tool. Не выбирайте флешку, на которой находятся MoOLVa или нужные вам файлы.

2. Подключите интернет и установочную флешку. Откройте официальную страницу Windows 10 или Windows 11 кнопкой ниже.

3. Найдите «Создание установочного носителя» и скачайте средство Microsoft. Запустите его, прочитайте условия и следуйте шагам. Выберите нужную редакцию, язык и USB-устройство, внимательно проверьте его размер и букву.

4. Дождитесь завершения работы средства Microsoft. Если нужна ISO-копия, на странице Microsoft выберите доступный вариант ISO или соответствующую опцию средства.

У Windows 8 / 8.1 отдельная страница ISO при последней проверке была недоступна. Лицензия Windows приобретается отдельно. Поддержка Windows 8.1 и обычная поддержка Windows 10 завершены.

ВАЖНО: запись выполняет средство Microsoft, а не MoOLVa. Если носитель мультизагрузочный, форматирование удалит его содержимое.
'@
    $script:Content.Controls.Add($box)
    $script:Content.Controls.Add((MakeButton 'Скачать Windows 11' 35 480 265 48 { OpenSafeUrl 'https://www.microsoft.com/en-us/software-download/windows11' } $true))
    $script:Content.Controls.Add((MakeButton 'Скачать Windows 10' 315 480 265 48 { OpenSafeUrl 'https://www.microsoft.com/en-us/software-download/windows10' }))
    $script:Content.Controls.Add((MakeButton 'Все загрузки Microsoft' 595 480 300 48 { OpenSafeUrl 'https://www.microsoft.com/en-us/software-download' }))
    $script:Content.Controls.Add((MakeButton 'Посмотреть мои USB' 35 550 265 48 { ShowMedia }))
}
function TestMicrosoftConnection {
    try {
        $req=[System.Net.WebRequest]::Create('https://www.microsoft.com/')
        $req.Method='HEAD'; $req.Timeout=8000
        $response=$req.GetResponse()
        try { ShowMessage ("Сайт Microsoft доступен. HTTP: " + [int]$response.StatusCode + ". Это не гарантирует доступ к Windows Update.") 'Проверка соединения' }
        finally { $response.Close() }
    } catch {
        ShowMessage ("Не удалось открыть сайт Microsoft: " + $_.Exception.Message + "`r`nПроверьте Wi-Fi, сетевой кабель, прокси или откройте страницу в браузере. Эта проверка не определяет причину проблемы.") 'Проверка соединения'
    }
}
function ShowDownloads {
    AddHeading 'Скачать Windows' 'Официальные страницы Microsoft открываются в браузере. Потребуются интернет и соответствующая лицензия.'
    $script:Content.Controls.Add((MakeButton 'Windows 11 — Microsoft' 35 140 380 54 { OpenSafeUrl 'https://www.microsoft.com/en-us/software-download/windows11' } $true))
    $script:Content.Controls.Add((MakeButton 'Windows 10 — Microsoft' 35 211 380 54 { OpenSafeUrl 'https://www.microsoft.com/en-us/software-download/windows10' }))
    $script:Content.Controls.Add((MakeButton 'Страница загрузок Microsoft' 35 282 380 54 { OpenSafeUrl 'https://www.microsoft.com/en-us/software-download' }))
    $box=MakeTextBox 35 365 910 210
    $box.Text="Windows 8 / 8.1: в момент подготовки отдельная страница ISO Windows 8.1 вернула ошибку 404. Проверяйте доступность на странице Microsoft; используйте только законно полученный образ. Windows 8.1 не получает обновления безопасности с 2023 года; обычная поддержка Windows 10 завершена в 2025 году.`r`n`r`nСсылки открывают страницы, а не начинают скачивание сразу. Выбор языка, редакции и загрузка выполняются на сайте Microsoft. Образы в приложение не включены."
    $script:Content.Controls.Add($box)
}
function ShowApps {
    AddHeading 'Быстрая установка программ' 'Отмечайте программы, согласованные с клиентом. Установка выполняется через Microsoft WinGet.'
    $script:SoftwareBoxes=@()
    $i=0
    foreach ($key in $script:Software.Keys) {
        $col=($i % 2); $row=[math]::Floor($i/2)
        $cb=New-Object System.Windows.Forms.CheckBox
        $cb.Text=$key; $cb.AutoSize=$false
        $cb.Location=New-Object System.Drawing.Point((35 + $col*450),(135 + $row*62))
        $cb.Size=New-Object System.Drawing.Size(420,44)
        $cb.ForeColor=$script:Text; $cb.Font=New-Object System.Drawing.Font('Segoe UI',12)
        $cb.Tag=$script:Software[$key]
        $script:Content.Controls.Add($cb)
        $script:SoftwareBoxes+=,$cb
        $i++
    }
    $script:Content.Controls.Add((MakeButton 'Установить выбранные' 35 490 300 53 {
        $selected=@($script:SoftwareBoxes | Where-Object { $_.Checked })
        if($selected.Count -eq 0){ShowMessage 'Отметьте хотя бы одну программу.'; return}
        if(-not (AskYes ("Установить программы: `r`n`r`n" + (($selected | ForEach-Object {$_.Text}) -join "`r`n") + "`r`n`r`nУстановщики могут запросить согласие и права администратора."))){return}
        # Open sequential installs in one cmd window; use predefined safe Winget package IDs.
        $parts=@(); foreach($item in $selected){ $parts += ('winget install --id "{0}" --exact --source winget' -f $item.Tag) }
        if(-not (HasWinget)){ShowMessage 'Команда winget не найдена. Обновите App Installer через Microsoft Store.'; return}
        try { Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k',($parts -join ' & ')) }
        catch { ShowMessage "Ошибка запуска: $_" }
    } $true))
    $script:Content.Controls.Add((MakeButton 'Проверить доступные обновления' 351 490 330 53 { StartWinget 'upgrade' }))
    $script:Content.Controls.Add((MakeButton 'Обновить все через WinGet' 35 560 300 50 {
        if(AskYes 'Обновить ВСЕ программы, для которых WinGet нашёл обновления? Перед этим сохраните открытые документы. Некоторые установщики могут закрыть приложения или попросить перезапуск.') { StartWinget 'upgrade --all' }
    }))
    $script:Content.Controls.Add((LabelText 'Обновления WinGet охватывают только распознаваемые им приложения. Windows Update и драйверы проверяются отдельно. Установка может потребовать согласия с лицензиями.' 35 632 895 75 11 $false $script:Muted))
}
function ShowDrivers {
    AddHeading 'Драйверы и неизвестные устройства' 'Используйте Windows Update и официальные страницы производителя по точной модели.'
    $script:Content.Controls.Add((MakeButton 'Открыть Диспетчер устройств' 35 132 315 47 { try { Start-Process 'devmgmt.msc' } catch { ShowMessage "Ошибка: $_" } } $true))
    $script:Content.Controls.Add((MakeButton 'Открыть Windows Update' 365 132 285 47 { try { Start-Process 'ms-settings:windowsupdate' } catch { ShowMessage "Ошибка: $_" } }))
    $script:Content.Controls.Add((MakeButton 'Проверить устройства' 667 132 282 47 { $script:DriverResult.Text=GetDeviceProblems }))
    $script:DriverResult=MakeTextBox 35 205 912 240
    $script:DriverResult.Text='Нажмите «Проверить устройства». Если у устройств есть ошибки, ищите их драйверы на сайте производителя по точной модели ноутбука или материнской платы.'
    $script:Content.Controls.Add($script:DriverResult)
    $script:Content.Controls.Add((LabelText 'БЫСТРЫЙ ПЕРЕХОД К ПРОИЗВОДИТЕЛЮ' 35 477 850 30 11 $true $script:Yellow))
    $script:Content.Controls.Add((MakeButton 'Выбрать производителя' 35 520 300 48 { ShowBrands }))
    $script:Content.Controls.Add((MakeButton 'Найти и установить драйверы' 360 520 340 48 {
        $helper=Join-Path $PSScriptRoot 'Драйверы_Windows_Update.ps1'
        if(-not (Test-Path -LiteralPath $helper)){ShowMessage 'Не найден файл поиска драйверов. Распакуйте весь архив.'; return}
        try { Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File', ('"{0}"' -f $helper)) } catch { ShowMessage "Не удалось запустить поиск: $_" }
    } $true))
    $script:Content.Controls.Add((MakeButton 'Проверить интернет' 35 720 265 48 { TestMicrosoftConnection }))
    $script:Content.Controls.Add((MakeButton 'Настройки сети Windows' 315 720 300 48 { try { Start-Process 'ms-settings:network' } catch { ShowMessage "Ошибка: $_" } }))
    $script:Content.Controls.Add((MakeButton 'Создать флешку Windows' 35 780 350 48 { ShowUsbGuide }))
    $script:Content.Controls.Add((LabelText 'Не используйте случайные драйвер-паки. Не обновляйте BIOS без конкретной причины: сбой может нарушить загрузку и потребовать ключ восстановления BitLocker.' 35 610 900 90 11 $false $script:Muted))
}
function ShowDiagnostics {
    AddHeading 'Диагностика и системная информация' 'Собирается локально. Данные не отправляются в интернет и не передаются разработчику.'
    $script:DiagBox=MakeTextBox 35 136 913 425
    $script:DiagBox.Text=(FormatHardware) + "`r`n`r`nУСТРОЙСТВА С ОШИБКАМИ:`r`n" + (GetDeviceProblems)
    $script:Content.Controls.Add($script:DiagBox)
    $script:Content.Controls.Add((MakeButton 'Обновить результаты' 35 583 277 53 { $script:DiagBox.Text=(FormatHardware) + "`r`n`r`nУСТРОЙСТВА С ОШИБКАМИ:`r`n" + (GetDeviceProblems) } $true))
    $script:Content.Controls.Add((MakeButton 'Сохранить диагностику в TXT' 332 583 335 53 { SaveTextFile $script:DiagBox.Text 'Диагностика_MoOLVa.txt' }))
    $script:Content.Controls.Add((MakeButton 'Проверка активации Windows' 35 660 300 46 { try { Start-Process 'ms-settings:activation' } catch { ShowMessage "Ошибка: $_" } }))
}
function SaveTextFile([string]$text,[string]$default) {
    $dlg=New-Object System.Windows.Forms.SaveFileDialog
    $dlg.Filter='Текстовые файлы (*.txt)|*.txt';$dlg.FileName=$default
    if($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        try { [System.IO.File]::WriteAllText($dlg.FileName,$text,(New-Object System.Text.UTF8Encoding($true))); ShowMessage ('Файл сохранён: ' + $dlg.FileName) }
        catch { ShowMessage "Ошибка сохранения: $_" }
    }
}
function ShowReport {
    AddHeading 'Отчёт об обслуживании клиента' 'Отметьте выполненные этапы и сохраните текстовый акт. Информация остаётся на этом ПК.'
    $script:Content.Controls.Add((LabelText 'Клиент / номер заявки (необязательно)' 35 124 550 26 10 $true $script:Muted))
    $script:Customer=New-Object System.Windows.Forms.TextBox
    $script:Customer.Location=New-Object System.Drawing.Point(35,157);$script:Customer.Size=New-Object System.Drawing.Size(690,37)
    $script:Customer.Font=New-Object System.Drawing.Font('Segoe UI',12)
    $script:Customer.BackColor=$script:PanelBg;$script:Customer.ForeColor=$script:Text
    $script:Content.Controls.Add($script:Customer)
    $script:ReportChecks=@()
    $items=@('Согласие клиента получено','Резервная копия проверена','Совместимость и лицензия проверены','Windows установлена / обновлена','Драйверы проверены','Windows Update выполнен','Программы установлены / обновлены','Проверены звук, сеть, устройства','Windows активирована','Тестовая перезагрузка успешна')
    for($i=0;$i -lt $items.Count;$i++){
        $cb=New-Object System.Windows.Forms.CheckBox
        $cb.Text=$items[$i];$cb.Location=New-Object System.Drawing.Point((35 + ($i % 2)*452),(217 + [math]::Floor($i/2)*61))
        $cb.Size=New-Object System.Drawing.Size(446,42);$cb.ForeColor=$script:Text
        $cb.Font=New-Object System.Drawing.Font('Segoe UI',11)
        $script:Content.Controls.Add($cb);$script:ReportChecks+=,$cb
    }
    $script:Content.Controls.Add((MakeButton 'Сформировать и сохранить отчёт' 35 565 380 53 {
        $lines=New-Object System.Collections.Generic.List[string]
        [void]$lines.Add('MoOLVa Windows Master — акт обслуживания')
        [void]$lines.Add(('Дата: {0}' -f (Get-Date -Format 'dd.MM.yyyy HH:mm')))
        [void]$lines.Add(('Клиент / заказ: {0}' -f $script:Customer.Text))
        [void]$lines.Add('')
        [void]$lines.Add('Информация о компьютере:')
        [void]$lines.Add((FormatHardware))
        [void]$lines.Add('')
        [void]$lines.Add('Отметки мастера (не автоматическая проверка):')
        foreach($cb in $script:ReportChecks){[void]$lines.Add(('{0} {1}' -f $(if($cb.Checked){'[X]'}else{'[ ]'}),$cb.Text))}
        [void]$lines.Add('')
        [void]$lines.Add('Ответственный мастер: ____________________')
        [void]$lines.Add('Подтверждение клиента: __________________')
        SaveTextFile ($lines -join "`r`n") 'Отчет_MoOLVa.txt'
    } $true))
    $script:Content.Controls.Add((LabelText 'Отчёт — это запись действий мастера, а не автоматическая гарантия успешности установки. Не вводите пароли клиента в приложение.' 35 646 910 80 11 $false $script:Muted))
}

# Версия 1.4: новые страницы перекрывают одноименные функции 1.3.
function ShowHome {
    AddHeading 'MoOLVa Windows Master 1.4 PRO' 'Выберите, что вы хотите сделать.'
    $script:Content.Controls.Add((MakeButton '1. Подготовить Windows и флешку' 35 135 430 78 { ShowUsbGuide } $true))
    $script:Content.Controls.Add((MakeButton '2. Настроить компьютер клиента' 480 135 430 78 { ShowDrivers }))
    $t=MakeTextBox 35 245 875 250; $t.Text=FormatHardware; $script:Content.Controls.Add($t)
    $script:Content.Controls.Add((MakeButton 'BIOS / Boot Menu' 35 525 270 48 { ShowBrands }))
    $script:Content.Controls.Add((MakeButton 'Сеть и диагностика' 320 525 270 48 { ShowDiagnostics }))
    $script:Content.Controls.Add((MakeButton 'Отчёт клиенту' 605 525 270 48 { ShowReport }))
    $script:Content.Controls.Add((LabelText 'Для поиска драйверов и скачивания файлов нужен интернет. Перед записью Windows сохраните данные установочной флешки.' 35 610 860 75 11 $false $script:Muted))
}
function OpenDriverWindow {
    $helper=Join-Path $PSScriptRoot 'Драйверы_Windows_Update.ps1'
    if(-not (Test-Path -LiteralPath $helper)){ShowMessage 'Модуль драйверов не найден.';return}
    try {Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-STA','-File', ('"{0}"' -f $helper))}
    catch {ShowMessage "Окно драйверов не запущено: $_"}
}
function ShowDrivers {
    AddHeading 'Настройка компьютера' 'Драйверы, подключение к интернету и сведения об устройствах.'
    $script:Content.Controls.Add((MakeButton 'Найти и установить драйверы' 35 125 420 55 {OpenDriverWindow} $true))
    $script:Content.Controls.Add((MakeButton 'Диспетчер устройств' 470 125 330 55 {try {Start-Process 'devmgmt.msc'} catch {ShowMessage "Ошибка: $_"}}))
    $script:DriverResult=MakeTextBox 35 205 875 195
    $script:DriverResult.Text=(FormatHardware)+"`r`n`r`n"+(GetDeviceProblems)
    $script:Content.Controls.Add($script:DriverResult)
    $script:Content.Controls.Add((MakeButton 'Обновить устройства' 35 420 270 45 {$script:DriverResult.Text=(FormatHardware)+"`r`n`r`n"+(GetDeviceProblems)}))
    $script:Content.Controls.Add((MakeButton 'Поддержка производителя' 320 420 300 45 {ShowBrands}))
    $script:Content.Controls.Add((MakeButton 'Проверить интернет' 35 490 270 45 {TestMicrosoftConnection}))
    $script:Content.Controls.Add((MakeButton 'Настройки сети и Wi-Fi' 320 490 300 45 {try {Start-Process 'ms-settings:network'} catch {ShowMessage "Ошибка: $_"}}))
    $script:Content.Controls.Add((MakeButton 'Windows Update' 635 490 250 45 {try {Start-Process 'ms-settings:windowsupdate'} catch {ShowMessage "Ошибка: $_"}}))
    $script:Content.Controls.Add((LabelText 'Если сеть не работает из-за отсутствия драйвера, подключите кабель или USB-модем, либо скачайте сетевой драйвер с сайта производителя на другом ПК.' 35 560 875 85 11 $false $script:Muted))
}
function ShowUsbGuide {
    AddHeading 'Загрузка Windows и установочная флешка' 'Скачивание файла в MoOLVa; запись флешки — через средство Microsoft.'
    $script:Content.Controls.Add((MakeButton 'Показать USB-накопители' 35 125 275 48 {ShowMedia}))
    $script:Content.Controls.Add((MakeButton 'Открыть Microsoft Windows 11' 325 125 300 48 {OpenSafeUrl 'https://www.microsoft.com/en-us/software-download/windows11'}))
    $script:Content.Controls.Add((MakeButton 'Windows 10' 640 125 260 48 {OpenSafeUrl 'https://www.microsoft.com/en-us/software-download/windows10'}))
    $script:Content.Controls.Add((LabelText '1. Средство Microsoft: скачайте его прямо в выбранную вами папку.' 35 195 850 30 11 $true))
    $script:Content.Controls.Add((MakeButton 'Скачать средство Windows 11' 35 232 380 48 {StartMasterDownload 'https://go.microsoft.com/fwlink/?linkid=2156295' 'MediaCreationTool_Windows11.exe'} $true))
    $script:Content.Controls.Add((MakeButton 'Скачать средство Windows 10' 430 232 380 48 {StartMasterDownload 'https://go.microsoft.com/fwlink/?LinkId=691209' 'MediaCreationTool_Windows10.exe'}))
    $script:Content.Controls.Add((LabelText '2. ISO: на сайте Microsoft выберите версию и язык, скопируйте временную ссылку на ISO и вставьте её ниже.' 35 310 875 62 11 $false $script:Muted))
    $script:IsoUrl=New-Object Windows.Forms.TextBox;$script:IsoUrl.SetBounds(35,380,875,32);$script:IsoUrl.Font=New-Object Drawing.Font('Segoe UI',10);$script:Content.Controls.Add($script:IsoUrl)
    $script:Content.Controls.Add((MakeButton 'Скачать ISO внутри MoOLVa' 35 430 380 48 {StartMasterDownload $script:IsoUrl.Text 'Windows.iso'}))
    $script:Content.Controls.Add((MakeButton 'Отменить загрузку' 430 430 260 48 {CancelMasterDownload}))
    $script:DownloadStatus=LabelText 'Ожидание загрузки' 35 500 875 55 11 $false $script:Yellow;$script:Content.Controls.Add($script:DownloadStatus)
    $script:Content.Controls.Add((LabelText 'Запись: запустите скачанное средство Microsoft и выберите отдельную флешку. Все данные на ней будут удалены. Проверяйте букву и размер! Windows 8.1: отдельная страница ISO Microsoft при проверке недоступна.' 35 570 875 110 11 $false $script:Muted))
}
function StartMasterDownload([string]$url,[string]$suggested) {
    if($null -ne $script:BitsJob){ShowMessage 'Дождитесь завершения текущей загрузки.';return}
    try {$u=[uri]$url} catch {ShowMessage 'Введите корректную ссылку HTTPS от Microsoft.';return}
    $hostName=$u.DnsSafeHost.ToLowerInvariant()
    $allowed=($u.Scheme -eq 'https') -and ($hostName -eq 'microsoft.com' -or $hostName.EndsWith('.microsoft.com') -or $hostName -eq 'software-download.microsoft.com' -or $hostName.EndsWith('.prss.microsoft.com')) -and [string]::IsNullOrEmpty($u.UserInfo)
    if(-not $allowed){ShowMessage 'Разрешены только HTTPS-ссылки Microsoft. Получите ссылку на официальной странице.';return}
    $dlg=New-Object Windows.Forms.SaveFileDialog;$dlg.FileName=$suggested;$dlg.Filter='Все файлы|*.*';$dlg.OverwritePrompt=$true
    if($dlg.ShowDialog() -ne 'OK'){return}
    $dest=$dlg.FileName
    if(Test-Path -LiteralPath $dest){ShowMessage 'Выберите новое имя файла: существующий файл не перезаписывается.';return}
    $temp=$dest+'.moolva-'+[guid]::NewGuid().ToString('N')+'.part'
    try {
      Import-Module BitsTransfer -ErrorAction Stop
      $script:BitsJob=Start-BitsTransfer -Source $u.AbsoluteUri -Destination $temp -Asynchronous -ErrorAction Stop
      $script:BitsTemp=$temp;$script:BitsDestination=$dest;$script:DownloadIsTool=($suggested -like '*.exe')
      $script:DownloadTimer.Start();$script:DownloadStatus.Text='Подготовка загрузки...'
    } catch {if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue};$script:BitsJob=$null;ShowMessage "Не удалось начать загрузку: $_"}
}
function CancelMasterDownload {
 if($null -eq $script:BitsJob){ShowMessage 'Нет активной загрузки.';return}
 try {Remove-BitsTransfer -BitsJob $script:BitsJob -Confirm:$false -ErrorAction Stop} catch {}
 if(Test-Path -LiteralPath $script:BitsTemp){Remove-Item -LiteralPath $script:BitsTemp -Force -ErrorAction SilentlyContinue}
 $script:BitsJob=$null;$script:DownloadTimer.Stop()
 if($script:DownloadStatus -and -not $script:DownloadStatus.IsDisposed){$script:DownloadStatus.Text='Загрузка отменена.'}
}
function PollMasterDownload {
 if($null -eq $script:BitsJob){$script:DownloadTimer.Stop();return}
 try {
  $j=Get-BitsTransfer -Id $script:BitsJob.Id -ErrorAction Stop
  if($j.BytesTotal -gt 0){$desc=('Загрузка: {0:N1}%  ({1:N1} МБ)' -f (100.0*$j.BytesTransferred/$j.BytesTotal),($j.BytesTransferred/1MB))}else{$desc=('Загрузка: {0:N1} МБ; {1}' -f ($j.BytesTransferred/1MB),$j.JobState)}
  if($script:DownloadStatus -and -not $script:DownloadStatus.IsDisposed){$script:DownloadStatus.Text=$desc}
  if($j.JobState -eq 'Transferred'){
   Complete-BitsTransfer -BitsJob $j -ErrorAction Stop
   if($script:DownloadIsTool){$sig=Get-AuthenticodeSignature -FilePath $script:BitsTemp;if($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch '(?i)Microsoft') {Remove-Item -LiteralPath $script:BitsTemp -Force;throw 'Цифровая подпись Microsoft не подтверждена; файл удалён.'}}
   [IO.File]::Move($script:BitsTemp,$script:BitsDestination)
   $script:BitsJob=$null;$script:DownloadTimer.Stop();ShowMessage ('Скачано: '+$script:BitsDestination)
  } elseif($j.JobState -in @('Error','Cancelled','Suspended')) {
   $message="Загрузка остановлена: $($j.JobState). $($j.ErrorDescription)"
   Remove-BitsTransfer -BitsJob $j -Confirm:$false -ErrorAction SilentlyContinue
   if(Test-Path -LiteralPath $script:BitsTemp){Remove-Item -LiteralPath $script:BitsTemp -Force -ErrorAction SilentlyContinue}
   $script:BitsJob=$null;$script:DownloadTimer.Stop();ShowMessage $message
  }
 } catch {
  $msg=$_;if($null -ne $script:BitsJob){Remove-BitsTransfer -BitsJob $script:BitsJob -Confirm:$false -ErrorAction SilentlyContinue}
  if($script:BitsTemp -and (Test-Path -LiteralPath $script:BitsTemp)){Remove-Item -LiteralPath $script:BitsTemp -Force -ErrorAction SilentlyContinue}
  $script:DownloadTimer.Stop();$script:BitsJob=$null;ShowMessage "Ошибка загрузки: $msg"
 }
}

$script:Form=New-Object System.Windows.Forms.Form
$script:Form.Text='MoOLVa Windows Master Portable 1.4 PRO | Помощник компьютерного мастера'
$script:Form.ClientSize=New-Object System.Drawing.Size(1260,810)
$script:Form.MinimumSize=New-Object System.Drawing.Size(1130,760)
$script:Form.StartPosition='CenterScreen'
$script:Form.BackColor=$script:Bg
$script:Form.Font=New-Object System.Drawing.Font('Segoe UI',10)

$side=New-Object System.Windows.Forms.Panel
$side.Dock='Left';$side.Width=245;$side.BackColor=$script:SidebarBg
$script:Form.Controls.Add($side)
$side.Controls.Add((LabelText 'MoOLVa' 27 32 185 48 25 $true $script:Yellow))
$side.Controls.Add((LabelText 'WINDOWS MASTER' 28 80 193 30 10 $true $script:Muted))
$links=@(
  @('Главная', { ShowHome }),
  @('Мастер Windows', { $script:Step=0; ShowInstall }),
  @('Мои USB / ISO', { ShowMedia }),
  @('Производители', { ShowBrands }),
  @('Программы', { ShowApps }),
  @('Драйверы', { ShowDrivers }),
  @('Диагностика', { ShowDiagnostics }),
  @('Отчёт клиенту', { ShowReport })
)
for($i=0;$i -lt $links.Count;$i++) {
    $entry=$links[$i]
    $b=MakeButton $entry[0] 18 (145+$i*62) 208 51 $entry[1]
    $b.TextAlign='MiddleLeft'
    $side.Controls.Add($b)
}
$side.Controls.Add((LabelText 'v1.4 PRO  •  Portable' 23 718 204 30 9 $false $script:Muted))
$script:Content=New-Object System.Windows.Forms.Panel
$script:Content.Dock='Fill';$script:Content.AutoScroll=$true
$script:Content.BackColor=$script:Bg
$script:Form.Controls.Add($script:Content)
$script:Content.BringToFront()
$script:BitsJob=$null
$script:DownloadTimer=New-Object System.Windows.Forms.Timer
$script:DownloadTimer.Interval=700
$script:DownloadTimer.Add_Tick({ PollMasterDownload })
$script:Form.Add_FormClosing({param($sender,$e) if($null -ne $script:BitsJob){$e.Cancel=$true;ShowMessage 'Дождитесь завершения загрузки.'}})
$script:Step=0
$script:ImageFolder=''
ShowHome
[void]$script:Form.ShowDialog()
