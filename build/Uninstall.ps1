<#
.SYNOPSIS
    Uninstalls .NET Bootcamp for the current user.

.DESCRIPTION
    Removes the application files, shortcuts, and the Apps & features entry.
    Learning progress in %LOCALAPPDATA%\DotNetBootcamp is KEPT unless -RemoveData is passed.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File Uninstall.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File Uninstall.ps1 -RemoveData
#>
[CmdletBinding()]
param(
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\DotNetBootcamp'),
    [switch]$RemoveData
)

$ErrorActionPreference = 'Stop'
$AppName = '.NET Bootcamp'
$RegKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\DotNetBootcamp'

Write-Host ""
Write-Host "Uninstalling $AppName" -ForegroundColor Magenta

Get-Process 'DotNetBootcamp' -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  closing running instance..." -ForegroundColor Cyan
    $_ | Stop-Process -Force
    Start-Sleep -Seconds 2
}

foreach ($link in @(
    (Join-Path ([Environment]::GetFolderPath('Desktop')) "$AppName.lnk"),
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$AppName.lnk")
)) {
    if (Test-Path $link) { Remove-Item $link -Force; Write-Host "  removed shortcut: $link" -ForegroundColor Cyan }
}

if (Test-Path $RegKey) { Remove-Item $RegKey -Recurse -Force; Write-Host "  removed Apps & features entry" -ForegroundColor Cyan }

if (Test-Path $InstallDir) {
    # the uninstaller may be running from inside the folder it is deleting
    $self = $PSCommandPath
    if ($self -and $self.StartsWith($InstallDir, [StringComparison]::OrdinalIgnoreCase)) {
        Start-Process powershell -ArgumentList @(
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
            "Start-Sleep -Seconds 2; Remove-Item -LiteralPath '$InstallDir' -Recurse -Force -ErrorAction SilentlyContinue"
        ) -WindowStyle Hidden
        Write-Host "  application files will be removed in a moment" -ForegroundColor Cyan
    } else {
        Remove-Item $InstallDir -Recurse -Force
        Write-Host "  removed $InstallDir" -ForegroundColor Cyan
    }
}

$dataDir = Join-Path $env:LOCALAPPDATA 'DotNetBootcamp'
if ($RemoveData) {
    if (Test-Path $dataDir) { Remove-Item $dataDir -Recurse -Force; Write-Host "  removed progress data" -ForegroundColor Yellow }
} elseif (Test-Path $dataDir) {
    Write-Host "  progress data kept at $dataDir (use -RemoveData to delete)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Uninstalled." -ForegroundColor Green
Write-Host ""
