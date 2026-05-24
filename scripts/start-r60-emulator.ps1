$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root '.local-android-tools'
$sdk = Join-Path $tools 'android-sdk'
$env:JAVA_HOME = Join-Path $tools 'jdk-17.0.19+10'
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$env:JAVA_HOME\bin;$sdk\platform-tools;$sdk\emulator;$env:Path"

$emulator = Join-Path $sdk 'emulator\emulator.exe'
$avdName = 'Dispatcher365_R60'

Start-Process -FilePath $emulator -ArgumentList @(
  "-avd", $avdName,
  "-netdelay", "none",
  "-netspeed", "full",
  "-gpu", "swiftshader_indirect"
) -WorkingDirectory $root

Write-Host "Starting emulator $avdName"
