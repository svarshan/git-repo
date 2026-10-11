# CI integration regression for the actual PowerShell update guard.
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:LOCALAPPDATA ("MoOLVaUpgradeTest_" + [guid]::NewGuid().ToString('N'))
$app = Join-Path $root 'Programs\MoOLVa'
$data = Join-Path $root 'Data'
$snapshot = Join-Path $root 'Snapshot'
$otherApp = Join-Path $root 'Unrelated'
$guard = Join-Path $PSScriptRoot 'upgrade_guard.ps1'
$foreignProcess = $null
try {
    New-Item -ItemType Directory -Path $app,$data,$otherApp -Force | Out-Null
    Set-Content -Path (Join-Path $app 'MoOLVaDesktop.exe') -Value 'old-app-build' -Encoding UTF8
    Set-Content -Path (Join-Path $data 'enterprise.sqlite3') -Value 'old-database-content' -Encoding UTF8
    # Use two real Windows processes with the identical executable NAME.
    # Only the process from the installation path is eligible for shutdown.
    Copy-Item "$env:WINDIR\System32\PING.EXE" (Join-Path $app 'MoOLVaServer.exe')
    Copy-Item "$env:WINDIR\System32\PING.EXE" (Join-Path $otherApp 'MoOLVaServer.exe')
    $owned = Start-Process -FilePath (Join-Path $app 'MoOLVaServer.exe') -ArgumentList '-t 127.0.0.1' -PassThru -WindowStyle Hidden
    $foreignProcess = Start-Process -FilePath (Join-Path $otherApp 'MoOLVaServer.exe') -ArgumentList '-t 127.0.0.1' -PassThru -WindowStyle Hidden
    Start-Sleep -Milliseconds 600
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $guard -Mode Prepare -InstallDir $app -DataDir $data -SnapshotDir $snapshot
    if ($LASTEXITCODE -ne 0) { throw 'Prepare failed' }
    $owned.Refresh()
    if (-not $owned.HasExited) { throw 'Own server is still running after Prepare' }
    $foreignProcess.Refresh()
    if ($foreignProcess.HasExited) { throw 'Unrelated process was stopped: unsafe update' }
    if (-not (Test-Path (Join-Path $snapshot 'snapshot.json'))) { throw 'Missing snapshot metadata' }
    Set-Content -Path (Join-Path $app 'MoOLVaDesktop.exe') -Value 'new-app-build' -Encoding UTF8
    Set-Content -Path (Join-Path $data 'enterprise.sqlite3') -Value 'changed-database-content' -Encoding UTF8
    $manifest = @{version='2.6.0';files=@{'MoOLVaDesktop.exe'=(Get-FileHash (Join-Path $app 'MoOLVaDesktop.exe') -Algorithm SHA256).Hash}}
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $app 'moolva_release_manifest.json') -Encoding UTF8
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $guard -Mode Validate -InstallDir $app -DataDir $data -SnapshotDir $snapshot
    if ($LASTEXITCODE -ne 0) { throw 'Manifest validation failed' }
    Set-Content -Path (Join-Path $app 'MoOLVaDesktop.exe') -Value 'CORRUPTED' -Encoding UTF8
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $guard -Mode Validate -InstallDir $app -DataDir $data -SnapshotDir $snapshot 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { throw 'Corruption was not detected' }
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $guard -Mode Rollback -InstallDir $app -DataDir $data -SnapshotDir $snapshot
    if ($LASTEXITCODE -ne 0) { throw 'Rollback failed' }
    $restoredApp = (Get-Content (Join-Path $app 'MoOLVaDesktop.exe') -Raw).Trim()
    $restoredData = (Get-Content (Join-Path $data 'enterprise.sqlite3') -Raw).Trim()
    if ($restoredApp -ne 'old-app-build' -or $restoredData -ne 'old-database-content') {
        throw 'Failed to restore previous application and data'
    }
    if (Test-Path (Join-Path $app 'moolva_release_manifest.json')) { throw 'Rollback did not remove newly installed files' }
    Write-Host 'MOOLVA_26_GUARD_TESTS_PASSED'
} finally {
    if ($null -ne $foreignProcess) {
        Stop-Process -Id $foreignProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($null -ne $owned) {
        Stop-Process -Id $owned.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 400
    Remove-Item $root -Recurse -Force -ErrorAction SilentlyContinue
}
