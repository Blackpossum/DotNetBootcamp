<#
.SYNOPSIS
    Builds a distributable installer package (zip) for .NET Bootcamp.

.DESCRIPTION
    Publishes a self-contained win-x64 build, then assembles:

        DotNetBootcamp-1.0.0-win-x64.zip
          ├── app\               (the application)
          ├── Install.cmd        <- double-click this
          ├── Install.ps1
          ├── Uninstall.cmd
          ├── Uninstall.ps1
          └── README.txt

    Copy the zip to any Windows 10/11 machine, unzip, double-click Install.cmd.
    No .NET installation is required on the target machine.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File build\package.ps1
#>
[CmdletBinding()]
param(
    [switch]$SkipPublish,
    [string]$Version = '1.0.0'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $root 'dist'
$stage = Join-Path $root "build\stage"
$zipPath = Join-Path $root "build\DotNetBootcamp-$Version-win-x64.zip"

if (-not $SkipPublish) {
    Write-Host "publishing self-contained build..." -ForegroundColor Cyan
    & dotnet publish (Join-Path $root 'DotNetBootcamp.csproj') -c Release -r win-x64 --self-contained true -o $dist -v minimal
    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }
}

if (-not (Test-Path (Join-Path $dist 'DotNetBootcamp.exe'))) { throw "dist\DotNetBootcamp.exe missing - publish first" }

Write-Host "staging package..." -ForegroundColor Cyan
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $stage 'app') | Out-Null

Copy-Item (Join-Path $dist '*') (Join-Path $stage 'app') -Recurse -Force
foreach ($f in 'Install.ps1', 'Install.cmd', 'Uninstall.ps1', 'Uninstall.cmd') {
    Copy-Item (Join-Path $PSScriptRoot $f) $stage -Force
}

@"
.NET Bootcamp $Version
======================

An offline desktop course for .NET 10 and C# 14 - 12 modules, 53 lessons.

TO INSTALL
  Double-click Install.cmd

  Installs to %LOCALAPPDATA%\Programs\DotNetBootcamp, adds a Desktop shortcut,
  a Start Menu entry, and an entry in Settings > Apps. No administrator rights
  and no .NET installation are required (the runtime is bundled).

TO UNINSTALL
  Settings > Apps > .NET Bootcamp > Uninstall
  or double-click Uninstall.cmd

YOUR PROGRESS
  Completed lessons, checklists and quiz answers are stored in
  %LOCALAPPDATA%\DotNetBootcamp and survive reinstalls and upgrades.
  Uninstall keeps them; run Uninstall.ps1 -RemoveData to delete them too.
  You can also export/import progress as JSON from inside the app.
"@ | Set-Content (Join-Path $stage 'README.txt') -Encoding UTF8

Write-Host "compressing..." -ForegroundColor Cyan
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zipPath -CompressionLevel Optimal

Remove-Item $stage -Recurse -Force

$mb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "package ready: $zipPath ($mb MB)" -ForegroundColor Green
