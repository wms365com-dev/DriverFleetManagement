# Dispatcher365 Handheld Android App

This is the first installable Android shell for rugged handheld scanner units such as the R60.

## What It Does Now
- Opens the Dispatcher365 portal in a native Android WebView.
- Supports keyboard-wedge scanner input through the focused web page field or the scan bar.
- Listens for common rugged-scanner broadcast intents and forwards scan data into the focused portal field.
- Allows switching between production and a local development URL.
- Enables camera/file upload, JavaScript, DOM storage, and geolocation for the existing driver workflow.
- Enhances camera-captured BOL/POD/inspection images before upload with grayscale cleanup, contrast stretch, and text-friendly thresholding.

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

## Scanner Setup
Most rugged Android scanners can work in one of two modes:

1. Keyboard wedge
   - Configure the scanner to type the scan into the focused field and send Enter at the end.
   - This app supports that through the visible Scanner input field and any focused portal input.

2. Broadcast intent
   - Configure the scanner app/profile to broadcast to action:

```text
com.dispatcher365.SCAN
```

   - Preferred scan data extra:

```text
data
```

The app also listens for common vendor/default actions such as Zebra DataWedge, Honeywell barcode data, `android.intent.ACTION_DECODE_DATA`, Newland-style scanner results, and several generic scanner-service broadcasts.

## Image Enhancement
When the camera option is used from a portal upload field, the app creates a cleaned document copy before upload:
- scales oversized photos to a document-friendly size
- converts to grayscale
- stretches contrast
- brightens the page background
- darkens text/lines for BOL and POD readability

Gallery-selected images are passed through unchanged.
