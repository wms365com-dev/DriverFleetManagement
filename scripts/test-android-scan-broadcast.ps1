$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$adb = Join-Path $root '.local-android-tools\android-sdk\platform-tools\adb.exe'
$value = if ($args.Count -gt 0) { $args[0] } else { 'DEMO0001-2026-000777' }

& $adb shell am broadcast -a com.dispatcher365.SCAN --es data $value
Write-Host "Sent scanner broadcast: $value"
