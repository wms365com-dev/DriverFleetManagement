# Dispatcher365 Build Checklist

This is the working build checklist for turning Dispatcher365 into a mature driver, dispatch, customer tracking, and fleet operations platform.

## Highest Priority

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
- [ ] Driver availability.
- [ ] Driver license/class compatibility.
- [ ] Equipment status cannot be out_of_service.
- [ ] Trailer required rules.
- [ ] Weight/length limits.
- [ ] Hazmat/temp/liftgate requirements.

### Customer Portal
- [ ] Customer search by tracking number.
- [ ] Branded tracking page per company.
- [ ] Public POD/BOL visibility settings.
- [ ] Customer email/SMS tracking link.

### Notifications
- [ ] Driver assigned a load.
- [ ] Pickup/delivery appointment reminder.
- [ ] Dispatcher alert if driver is late.
- [ ] Customer alert when picked up/delivered.
- [ ] Admin alert for new company signup approval.

## Operations Features

- [ ] Calendar/dispatch board by day.
- [ ] Drag-and-drop load assignment.
- [ ] Driver availability schedule.
- [ ] Unassigned loads queue.
- [ ] Late load alerts.
- [ ] Exception reporting: refused freight, damaged freight, waiting time, no dock, customer closed.
- [ ] Rate, accessorials, detention, lumper, tolls, extra stop fees.

## Driver App

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
2. [ ] Add driver/equipment availability and out-of-service blocking.
3. [ ] Add customer tracking improvements with POD visibility.
4. [ ] Add notification system.
5. [ ] Add dispatch calendar/board.
