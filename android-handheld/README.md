# Dispatcher365 Handheld Android App

This is the first installable Android shell for rugged handheld scanner units such as the R60.

## What It Does Now
- Opens the Dispatcher365 portal in a native Android WebView.
- Supports keyboard-wedge scanner input through the focused web page field or the scan bar.
- Allows switching between production and a local development URL.
- Enables camera/file upload, JavaScript, DOM storage, and geolocation for the existing driver workflow.

## Build
From the repository root:

```powershell
$env:JAVA_HOME = "$PWD\.local-android-tools\jdk-17.0.19+10"
$env:ANDROID_HOME = "$PWD\.local-android-tools\android-sdk"
$env:ANDROID_SDK_ROOT = "$PWD\.local-android-tools\android-sdk"
.\.local-android-tools\gradle-8.10.2\bin\gradle.bat -p android-handheld assembleDebug
```

The debug APK is created at:

```text
android-handheld\app\build\outputs\apk\debug\app-debug.apk
```

## Install To Device
Enable Developer Options and USB debugging on the handheld, then authorize the computer on the device prompt.

```powershell
.\.local-android-tools\android-sdk\platform-tools\adb.exe devices -l
.\.local-android-tools\android-sdk\platform-tools\adb.exe install -r android-handheld\app\build\outputs\apk\debug\app-debug.apk
```

## Local Server URL
Android devices cannot use `127.0.0.1` to reach the Windows development server. Use the computer LAN IP instead, for example:

```text
http://192.168.1.50:3120/portal
```

Production is:

```text
https://dispatcher365.co/portal
```
