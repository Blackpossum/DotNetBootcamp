<#
.SYNOPSIS
    Installs .NET Bootcamp for the current user (no administrator rights required).

.DESCRIPTION
    Copies the application to %LOCALAPPDATA%\Programs\DotNetBootcamp, creates Desktop and
    Start Menu shortcuts, and registers an entry in Windows "Apps & features" so it can be
    uninstalled like any other program.

    Your learning progress lives separately in %LOCALAPPDATA%\DotNetBootcamp and is never
    touched by install, reinstall, or uninstall (unless you pass -RemoveData to Uninstall.ps1).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File Install.ps1
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File Install.ps1 -InstallDir "D:\Apps\DotNetBootcamp"
#>
[CmdletBinding()]
param(
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\DotNetBootcamp'),
    [switch]$NoDesktopShortcut,
    [switch]$NoStartMenuShortcut
)

$ErrorActionPreference = 'Stop'
$AppName = '.NET Bootcamp'
$ExeName = 'DotNetBootcamp.exe'
$RegKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\DotNetBootcamp'

function Write-Step($text) { Write-Host "  $text" -ForegroundColor Cyan }

Write-Host ""
Write-Host "Installing $AppName" -ForegroundColor Magenta
Write-Host ""

# ---- locate the payload -------------------------------------------------------------------
$candidates = @(
    (Join-Path $PSScriptRoot 'app'),                              # packaged zip layout
    (Join-Path (Split-Path $PSScriptRoot -Parent) 'dist'),        # repo layout (build\Install.ps1)
    (Join-Path $PSScriptRoot 'dist'),
    $PSScriptRoot
)
$payload = $candidates | Where-Object { $_ -and (Test-Path (Join-Path $_ $ExeName)) } | Select-Object -First 1

if (-not $payload) {
    Write-Error "Could not find $ExeName. Run 'dotnet publish -c Release -r win-x64 --self-contained true -o dist' first, or run this script from the unzipped package."
}
Write-Step "payload: $payload"

# ---- stop a running instance --------------------------------------------------------------
$running = Get-Process 'DotNetBootcamp' -ErrorAction SilentlyContinue
if ($running) {
    Write-Step "closing running instance..."
    $running | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# ---- copy files ---------------------------------------------------------------------------
if (Test-Path $InstallDir) {
    Write-Step "removing previous installation..."
    Remove-Item $InstallDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Write-Step "copying files to $InstallDir"
Copy-Item -Path (Join-Path $payload '*') -Destination $InstallDir -Recurse -Force

$exePath = Join-Path $InstallDir $ExeName
if (-not (Test-Path $exePath)) { Write-Error "Copy failed: $exePath not found." }

# keep the uninstaller with the app
$uninstallSource = Join-Path $PSScriptRoot 'Uninstall.ps1'
if (Test-Path $uninstallSource) {
    Copy-Item $uninstallSource (Join-Path $InstallDir 'Uninstall.ps1') -Force
}

# ---- shortcuts ----------------------------------------------------------------------------
$shell = New-Object -ComObject WScript.Shell

function New-Shortcut($linkPath) {
    $sc = $shell.CreateShortcut($linkPath)
    $sc.TargetPath = $exePath
    $sc.WorkingDirectory = $InstallDir
    $sc.IconLocation = "$exePath,0"
    $sc.Description = 'Offline bootcamp for .NET 10 and C# 14'
    $sc.Save()
}

if (-not $NoDesktopShortcut) {
    $desktop = [Environment]::GetFolderPath('Desktop')
    New-Shortcut (Join-Path $desktop "$AppName.lnk")
    Write-Step "desktop shortcut created"
}

if (-not $NoStartMenuShortcut) {
    $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
    New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
    New-Shortcut (Join-Path $startMenu "$AppName.lnk")
    Write-Step "start menu shortcut created"
}

# ---- Apps & features entry ----------------------------------------------------------------
$sizeKb = [int]((Get-ChildItem $InstallDir -Recurse -File | Measure-Object Length -Sum).Sum / 1KB)
New-Item -Path $RegKey -Force | Out-Null
Set-ItemProperty $RegKey 'DisplayName'     $AppName
Set-ItemProperty $RegKey 'DisplayVersion'  '1.0.0'
Set-ItemProperty $RegKey 'Publisher'       'Local build'
Set-ItemProperty $RegKey 'DisplayIcon'     $exePath
Set-ItemProperty $RegKey 'InstallLocation' $InstallDir
Set-ItemProperty $RegKey 'EstimatedSize'   $sizeKb -Type DWord
Set-ItemProperty $RegKey 'NoModify'        1 -Type DWord
Set-ItemProperty $RegKey 'NoRepair'        1 -Type DWord
Set-ItemProperty $RegKey 'UninstallString' "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\Uninstall.ps1`""
Write-Step "registered in Apps & features"

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  Installed to : $InstallDir"
Write-Host "  Size         : $([math]::Round($sizeKb / 1024, 1)) MB"
Write-Host "  Launch from  : Desktop shortcut, Start menu, or $exePath"
Write-Host "  Your progress: $env:LOCALAPPDATA\DotNetBootcamp (kept across reinstalls)"
Write-Host ""
