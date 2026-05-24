# Android Handheld Scanner App Plan

## Goal
Build a native Android driver/warehouse app for rugged handheld units with integrated barcode scanners. The app should use the existing Dispatcher365 backend and support driver work, inspections, load status updates, proof uploads, signatures, issue reporting, and scan-driven workflows.

## Recommended App Shape
- Native Android app in Kotlin.
- Minimum target: Android 10+ unless a selected handheld model requires lower support.
- Architecture: MVVM with a small repository layer for API calls, local Room cache, and WorkManager for offline sync.
- Auth: reuse `/api/auth/login` with the existing `dfm_session` cookie first; add token-based mobile auth later if device management requires it.
- Scanner input: support both keyboard-wedge scanners and vendor scanner SDKs.
- Camera: native camera capture for BOL, POD, inspection, and issue photos.
- Location: foreground/background location only for active driver sessions, matching current web behavior.

## Existing Backend Coverage
The current Node/Express app already has most endpoints needed by a handheld app:
- Login/session: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`
- Driver workspace: `GET /api/driver-view/:driverId`
- Drivers: `GET /api/drivers`
- Vehicles: `GET /api/vehicles`
- Assignments: `GET /api/assignments`
- Shifts: `POST /api/shifts/start`, `POST /api/shifts/end`
- GPS: `POST /api/location`
- Inspections: `GET /api/inspections`, `POST /api/inspections`
- Issues: `GET /api/issues`, `POST /api/issues`
- Loads: `GET /api/loads`, `PATCH /api/loads/:id/status`
- Documents: `POST /api/loads/:id/documents`
- Signature: `POST /api/loads/:id/signature`
- Public tracking: `GET /api/public/loads/:token`

## Backend Additions Before Android Build
Add a small mobile API layer rather than making the Android app guess from full web payloads:
- `GET /api/mobile/bootstrap`: return the signed-in driver, assigned vehicle, active shift, open loads, inspection readiness, and app config in one response.
- `POST /api/mobile/scans`: accept `{ value, symbology, context, loadId? }` and resolve the barcode to a load, stop, document, vehicle, trailer, or unknown scan.
- `POST /api/mobile/sync`: accept queued offline actions with client ids and return per-action success/failure.
- Add stable external ids or barcode fields for loads, stops, vehicles, trailers, and documents.
- Add idempotency keys for load status updates, inspections, issues, document uploads, and signatures.
- Add API versioning headers or `/api/mobile/v1/...` before publishing the Android app.

## Scanner Workflow Targets
Start with keyboard-wedge scanner support because many handhelds can type scans into the focused field:
- Scan load number to open assigned load.
- Scan BOL/POD barcode to attach a document to the matching load.
- Scan vehicle/trailer barcode during check-in to confirm assigned equipment.
- Scan stop/location barcode to confirm arrival at pickup or delivery.
- Scan exception codes to start an issue report.

Then add vendor SDK support for selected devices:
- Zebra DataWedge intent integration.
- Honeywell Data Collection intent/API integration if required.
- Optional Datalogic/Chainway SDK support after device selection.

## Android Screens
1. Login
2. Today / Assigned Work
3. Scan
4. Load Detail
5. Pickup / Delivery Status
6. BOL/POD Upload
7. Signature Capture
8. Inspection
9. Issue Report
10. Shift Check-In / Check-Out
11. Sync Queue / Offline Status
12. Settings / Device Diagnostics

## Offline Requirements
- Cache assigned loads, driver profile, vehicle assignment, inspection checklist, and last known shift state.
- Queue status changes, inspections, issue reports, signatures, GPS points, and uploads while offline.
- Retry with WorkManager when connectivity returns.
- Use idempotency keys so retries do not duplicate inspections, documents, or status events.
- Clearly show sync status to the driver.

## Device Selection Checklist
Pick the handheld before implementation details are locked:
- Android version and Google Play Services availability.
- Scanner mode: keyboard wedge, intents, or SDK.
- Camera quality and autofocus for document photos.
- Battery life and cradle/charging setup.
- Rugged rating and screen visibility.
- MDM support for app deployment and kiosk mode.
- Cellular/Wi-Fi requirements.

## Build Phases
1. Backend readiness
   - Add mobile bootstrap, scan resolution, sync queue, idempotency, and barcode fields.
   - Add tests for driver-only permissions and duplicate-safe retries.

2. Android prototype
   - Login, bootstrap, assigned work list, scan field, load detail, status update.
   - Support keyboard-wedge scanners first.

3. Driver operations
   - Inspection, shift start/end, issue report, GPS, photo uploads, BOL/POD, signature.
   - Add offline queue and retry handling.

4. Hardware integration
   - Add Zebra DataWedge/Honeywell support after the target handheld is chosen.
   - Test scan speed, background behavior, camera upload, and sleep/wake behavior.

5. Deployment
   - Internal APK/AAB distribution or managed Google Play.
   - MDM/kiosk setup, production API URL config, crash reporting, and release checklist.

## Open Decisions
- Target handheld model and scanner vendor.
- Whether driver auth should remain cookie/session based or move to mobile bearer tokens.
- Whether the app should be driver-only or include warehouse/admin scan workflows.
- Required barcode format for loads, vehicles, trailers, documents, and stops.
- Offline duration expectations.
