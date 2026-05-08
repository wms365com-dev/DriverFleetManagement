# Dispatcher365 Build Checklist

This is the working build checklist for turning Dispatcher365 into a mature driver, dispatch, customer tracking, and fleet operations platform.

## Highest Priority

### Data Protection / Backups
- [x] Document database and upload-file backup strategy.
- [x] Add a manual backup command for database rows and uploaded proof files.
- [ ] Move uploaded POD/BOL/signature files to durable object storage.
- [ ] Schedule daily offsite backups.
- [ ] Add monthly restore test process for staging.

### Load Lifecycle Rules
- [ ] Add clearer statuses and required steps by load type.
- [ ] Use this default flow: Booked -> Assigned -> Accepted -> En Route Pickup -> Arrived Pickup -> Loaded/Picked Up -> In Transit -> Arrived Delivery -> Delivered -> POD Uploaded -> Closed.
- [ ] For containers, add: Port Appointment, Container Picked Up, Empty Returned, Demurrage/Detention Risk.

### Required Documents By Load Type
- [ ] Dry van: BOL, POD, seal photo optional.
- [ ] Container: delivery order, port pickup proof, container photo, seal photo, empty return proof.
- [ ] Flatbed: securement/tarp photos, signed BOL/POD.
- [ ] Straight truck/sprinter: POD photo/signature, access notes.

### Dispatch Assignment Logic
- [x] Driver availability.
- [x] Driver license/class compatibility.
- [x] Equipment status cannot be out_of_service.
- [x] Trailer required rules.
- [x] Weight/length limits.
- [x] Hazmat/temp/liftgate requirements.

### Customer Portal
- [x] Customer search by tracking number.
- [x] Branded tracking page per company.
- [x] Public POD/BOL visibility settings.
- [x] Customer email/SMS tracking link.

### Notifications
- [x] Driver assigned a load.
- [ ] Pickup/delivery appointment reminder.
- [ ] Dispatcher alert if driver is late.
- [x] Customer update alert when picked up/delivered.
- [x] Admin alert for new company signup approval.

## Operations Features

- [x] Calendar/dispatch board by day.
- [x] Drag-and-drop load assignment.
- [ ] Driver availability schedule.
- [x] Unassigned loads queue.
- [x] Extra stops for multi-pickup or multi-delivery loads.
- [ ] Late load alerts.
- [ ] Exception reporting: refused freight, damaged freight, waiting time, no dock, customer closed.
- [ ] Rate, accessorials, detention, lumper, tolls, extra stop fees.

## Driver App

- [x] Require pre-trip vehicle inspection before driver can be ready for work.
- [ ] Cleaner mobile "My Work Today".
- [ ] One-tap status buttons.
- [ ] Required photo/signature checklist before delivery can close.
- [ ] Offline mode for poor signal.
- [ ] GPS breadcrumb per active load.
- [ ] Camera upload compression.

## Admin / Super Admin

- [ ] Company approval queue is started, but needs completion.
- [ ] Plan/subscription field.
- [ ] Company status: pending, active, suspended.
- [ ] User audit log.
- [ ] Role permissions.
- [ ] Per-company settings: logo, address, invoice prefix, tracking prefix.

## Reports

- [ ] Delivered loads by date.
- [ ] Driver activity report.
- [ ] Equipment utilization.
- [ ] Open defects.
- [ ] Late pickups/deliveries.
- [ ] Customer shipment history.
- [ ] Revenue/accessorial report later.

## Next Best Build Order

1. [x] Add required load checklist by load type.
2. [x] Add driver/equipment availability and out-of-service blocking.
3. [x] Add customer tracking improvements with POD visibility.
4. [ ] Add notification system.
5. [ ] Add dispatch calendar/board.
