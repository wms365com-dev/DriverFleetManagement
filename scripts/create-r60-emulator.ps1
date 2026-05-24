$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root '.local-android-tools'
$sdk = Join-Path $tools 'android-sdk'
$env:JAVA_HOME = Join-Path $tools 'jdk-17.0.19+10'
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$env:JAVA_HOME\bin;$sdk\platform-tools;$sdk\emulator;$env:Path"

$avdManager = Join-Path $sdk 'cmdline-tools\latest\bin\avdmanager.bat'
$avdName = 'Dispatcher365_R60'
$package = 'system-images;android-35;google_apis;x86_64'

$existing = & $avdManager list avd | Select-String "Name: $avdName"
if (!$existing) {
  'no' | & $avdManager create avd --force --name $avdName --package $package --device 'pixel_2'
}

$config = Join-Path $env:USERPROFILE ".android\avd\$avdName.avd\config.ini"
if (Test-Path $config) {
  $entries = @{
    'hw.lcd.width' = '720'
    'hw.lcd.height' = '1440'
    'hw.lcd.density' = '320'
    'hw.ramSize' = '2048'
    'hw.keyboard' = 'yes'
    'hw.gps' = 'yes'
    'hw.camera.back' = 'emulated'
    'hw.camera.front' = 'none'
    'disk.dataPartition.size' = '4096M'
    'showDeviceFrame' = 'no'
  }
  $lines = Get-Content $config
  foreach ($key in $entries.Keys) {
    if ($lines -match "^$([regex]::Escape($key))=") {
      $lines = $lines | ForEach-Object { if ($_ -match "^$([regex]::Escape($key))=") { "$key=$($entries[$key])" } else { $_ } }
    } else {
      $lines += "$key=$($entries[$key])"
    }
  }
  Set-Content -Path $config -Value $lines
}

Write-Host "Created/updated AVD $avdName"
Write-Host "Config: $config"
