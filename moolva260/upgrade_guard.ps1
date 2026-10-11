# MoOLVa 2.6 PRO update guard — Windows PowerShell 5.1 compatible.
# Exit code != 0 aborts the installer. Never delete a user's data without a snapshot.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidateSet('Prepare','Validate','Rollback')][string]$Mode,
    [Parameter(Mandatory=$true)][string]$InstallDir,
    [Parameter(Mandatory=$true)][string]$DataDir,
    [Parameter(Mandatory=$true)][string]$SnapshotDir
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function NormalizedPath([string]$p) {
    return [IO.Path]::GetFullPath($p).TrimEnd([char]'\')
}
function IsUnder([string]$candidate, [string]$parent) {
    return $candidate.StartsWith($parent + '\', [StringComparison]::OrdinalIgnoreCase)
}
function SafeCopy([string]$src, [string]$dst, [switch]$Mirror) {
    if (-not (Test-Path -LiteralPath $src -PathType Container)) { throw "Missing source: $src" }
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
    $mode = if ($Mirror) { '/MIR' } else { '/E' }
    & robocopy.exe $src $dst $mode /COPY:DAT /DCOPY:DAT /XJ /R:2 /W:1 /NP /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Backup/restore copy failed (robocopy $LASTEXITCODE): $src" }
}
function StopOwnProcesses([string]$base) {
    $names = @('MoOLVaDesktop.exe','MoOLVaServer.exe')
    $running = @(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop | Where-Object {
        $_.Name -in $names -and $_.ExecutablePath -and (IsUnder (NormalizedPath $_.ExecutablePath) $base)
    })
    foreach ($p in $running) {
        $proc = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
        if ($null -ne $proc) {
            try { [void]$proc.CloseMainWindow() } catch {}
        }
    }
    foreach ($p in $running) {
        try {
            $proc = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
            if ($null -ne $proc) {
                if (-not $proc.WaitForExit(8000)) {
                    Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
                    $proc.WaitForExit(5000) | Out-Null
                }
            }
        } catch {
            if (Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue) { throw }
        }
    }
    $left = @(Get-CimInstance -ClassName Win32_Process | Where-Object {
        $_.Name -in $names -and $_.ExecutablePath -and (IsUnder (NormalizedPath $_.ExecutablePath) $base)
    })
    if ($left.Count -gt 0) { throw 'MoOLVa is still running: stop update to protect open database files' }
}
function ValidateManifest([string]$base) {
    $manifestFile = Join-Path $base 'moolva_release_manifest.json'
    if (-not (Test-Path -LiteralPath $manifestFile -PathType Leaf)) { throw 'Missing release manifest' }
    $manifest = Get-Content -LiteralPath $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.version -ne '2.6.0') { throw 'Release version mismatch in manifest' }
    foreach ($item in $manifest.files.PSObject.Properties) {
        $rel = [string]$item.Name
        if ([IO.Path]::IsPathRooted($rel) -or $rel.Contains('..')) { throw 'Unsafe manifest path' }
        $file = Join-Path $base $rel
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing installed file: $rel" }
        $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
        if ($hash -ine [string]$item.Value) { throw "Corrupted installed file: $rel" }
    }
}
try {
    $app = NormalizedPath $InstallDir
    $data = NormalizedPath $DataDir
    $snapshot = NormalizedPath $SnapshotDir
    $local = NormalizedPath $env:LOCALAPPDATA
    if (-not (IsUnder $app $local) -or -not (IsUnder $data $local) -or -not (IsUnder $snapshot $local)) {
        throw 'Update paths must be beneath current-user LocalAppData'
    }
    if ($app -ieq $data -or (IsUnder $app $data) -or (IsUnder $data $app) -or
        (IsUnder $snapshot $app) -or (IsUnder $snapshot $data) -or
        (IsUnder $app $snapshot) -or (IsUnder $data $snapshot)) {
        throw 'Update directories overlap; refusing unsafe backup'
    }
    $metadata = Join-Path $snapshot 'snapshot.json'
    if ($Mode -eq 'Prepare') {
        if (Test-Path -LiteralPath $snapshot) { throw 'Snapshot directory already exists' }
        StopOwnProcesses $app
        New-Item -ItemType Directory -Path $snapshot -Force | Out-Null
        $hasApp = Test-Path -LiteralPath (Join-Path $app 'MoOLVaDesktop.exe') -PathType Leaf
        $hasData = Test-Path -LiteralPath $data -PathType Container
        if ($hasApp) { SafeCopy $app (Join-Path $snapshot 'application') }
        if ($hasData) { SafeCopy $data (Join-Path $snapshot 'userdata') }
        $record = @{app=$app;data=$data;hasApp=$hasApp;hasData=$hasData;created=(Get-Date).ToString('o')}
        $record | ConvertTo-Json | Set-Content -LiteralPath $metadata -Encoding UTF8
        Write-Output 'MOOLVA_UPGRADE_PREPARED'
    } elseif ($Mode -eq 'Rollback') {
        if (-not (Test-Path -LiteralPath $metadata -PathType Leaf)) { throw 'Cannot roll back without complete snapshot metadata' }
        $record = Get-Content -LiteralPath $metadata -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($record.app -ine $app -or $record.data -ine $data) { throw 'Snapshot belongs to a different installation' }
        StopOwnProcesses $app
        if ($record.hasApp) { SafeCopy (Join-Path $snapshot 'application') $app -Mirror }
        if ($record.hasData) { SafeCopy (Join-Path $snapshot 'userdata') $data -Mirror }
        Write-Output 'MOOLVA_UPGRADE_ROLLED_BACK'
    } else {
        ValidateManifest $app
        Write-Output 'MOOLVA_UPGRADE_VALIDATED'
    }
} catch {
    Write-Error ("MOOLVA_UPGRADE_ERROR: " + $_.Exception.Message)
    exit 1
}
exit 0
