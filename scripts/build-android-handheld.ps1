$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root '.local-android-tools'
$env:JAVA_HOME = Join-Path $tools 'jdk-17.0.19+10'
$env:ANDROID_HOME = Join-Path $tools 'android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

& (Join-Path $tools 'gradle-8.10.2\bin\gradle.bat') -p (Join-Path $root 'android-handheld') assembleDebug

$apk = Join-Path $root 'android-handheld\app\build\outputs\apk\debug\app-debug.apk'
Write-Host "Built $apk"
