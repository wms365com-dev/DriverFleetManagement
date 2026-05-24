$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$adb = Join-Path $root '.local-android-tools\android-sdk\platform-tools\adb.exe'
$apk = Join-Path $root 'android-handheld\app\build\outputs\apk\debug\app-debug.apk'

if (!(Test-Path $apk)) {
  throw "APK not found. Run scripts\build-android-handheld.ps1 first."
}

$devices = & $adb devices -l
$devices
$attached = $devices | Where-Object { $_ -match '\bdevice\b' -and $_ -notmatch '^List of devices' }
if (!$attached) {
  throw "No authorized Android device found. Enable Developer Options and USB debugging on the handheld, reconnect USB, then accept the RSA prompt on the device."
}

& $adb install -r $apk
if ($LASTEXITCODE -ne 0) {
  throw "ADB install failed with exit code $LASTEXITCODE."
}
Write-Host "Installed Dispatcher365 Handheld"
