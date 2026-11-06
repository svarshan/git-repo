$ErrorActionPreference='Stop'
$resultPath=Join-Path (Resolve-Path dist).Path 'VHD-Format-Test.txt'
$vhd=Join-Path $env:RUNNER_TEMP ('MoOLVa-TEST-'+[guid]::NewGuid().ToString('N')+'.vhd')
$dp=Join-Path $env:RUNNER_TEMP ('MoOLVa-TEST-'+[guid]::NewGuid().ToString('N')+'.txt')
$attached=$false
try {
 $taken=@([IO.DriveInfo]::GetDrives() | ForEach-Object { $_.Name.Substring(0,1).ToUpperInvariant() })
 $letter=@('X','Y','Z','W','V','U','T','S','R','Q','P') | Where-Object {$_ -notin $taken} | Select-Object -First 1
 if(-not $letter){throw 'No unused drive letter'}
 @(('create vdisk file="{0}" maximum=128 type=expandable' -f $vhd),('select vdisk file="{0}"' -f $vhd),'attach vdisk','exit') | Set-Content -LiteralPath $dp -Encoding ASCII
 $diskpartOutput=(& diskpart.exe /s $dp 2>&1 | Out-String)
 if(-not (Test-Path -LiteralPath $vhd)){throw ('Virtual test disk was not created: '+$diskpartOutput)}
 $attached=$true
 $disk=@(Get-DiskImage -ImagePath $vhd -ErrorAction Stop | Get-Disk -ErrorAction Stop)
 if($disk.Count -ne 1 -or $disk[0].IsSystem -or $disk[0].IsBoot -or ([string]$disk[0].BusType -notmatch 'Virtual')){throw 'Refusing: attached disk is not a non-system virtual disk'}
 $number=[int]$disk[0].Number
 @(('select disk {0}' -f $number),'create partition primary','format fs=ntfs quick label=MOOLVA_TEST',('assign letter={0}' -f $letter),'exit') | Set-Content -LiteralPath $dp -Encoding ASCII
 & diskpart.exe /s $dp | Out-Null
 $volume=Get-Volume -DriveLetter $letter -ErrorAction Stop
 $part=Get-Partition -DriveLetter $letter -ErrorAction Stop
 $diskAgain=@(Get-DiskImage -ImagePath $vhd -ErrorAction Stop | Get-Disk -ErrorAction Stop)
 if($volume.FileSystemLabel -ne 'MOOLVA_TEST' -or $part.DiskNumber -ne $number -or $diskAgain.Count -ne 1 -or $diskAgain[0].Number -ne $number){throw 'Refusing: fixture identity mismatch'}
 $root=$letter+':\'
 Set-Content -Path (Join-Path $root 'fixture.txt') -Value 'test data' -Encoding ASCII
 $assembly=[Reflection.Assembly]::LoadFrom((Resolve-Path dist/MoOLVa-Windows-Master-3.1-Portable.exe).Path)
 $type=$assembly.GetType('MoOLVaMaster.UsbWriter',$true)
 $method=$type.GetMethod('FormatVolumeUnchecked',[Reflection.BindingFlags]'NonPublic,Static')
 if(-not $method){throw 'Format method not found'}
 [void]$method.Invoke($null,@($root))
 $out=Get-Volume -DriveLetter $letter -ErrorAction Stop
 $partAfter=Get-Partition -DriveLetter $letter -ErrorAction Stop
 if($partAfter.DiskNumber -ne $number -or $out.FileSystem -ne 'FAT32' -or $out.FileSystemLabel -ne 'MOOLVA_WIN' -or (Test-Path (Join-Path $root 'fixture.txt'))){throw 'Formatted virtual disk did not match expected result'}
 Set-Content -LiteralPath $resultPath -Value 'SUCCESS: product formatter formatted isolated VHD fixture as FAT32; physical USB not tested.' -Encoding UTF8
}catch{
 Set-Content -LiteralPath $resultPath -Value ('UNAVAILABLE OR FAILED: '+$_.ToString()) -Encoding UTF8
}finally{
 if($attached -and (Test-Path -LiteralPath $vhd)){
  @(('select vdisk file="{0}"' -f $vhd),'detach vdisk','exit') | Set-Content -LiteralPath $dp -Encoding ASCII
  & diskpart.exe /s $dp | Out-Null
 }
 Remove-Item -LiteralPath $dp -Force -ErrorAction SilentlyContinue
 Remove-Item -LiteralPath $vhd -Force -ErrorAction SilentlyContinue
}
Get-Content -LiteralPath $resultPath

exit 0
