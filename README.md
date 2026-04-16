# Driver Fleet Management Prototype

A Railway-friendly Node.js prototype for a trucking company to manage:
- Drivers
- Vehicles
- Driver-to-vehicle assignments
- Shift start/end
- Pre-trip inspections
- Photo uploads
- Issue reporting
- Admin dashboard

## Deploy on Railway
1. Upload these files to GitHub
2. Create a new Railway project
3. Connect the GitHub repo
4. Railway will detect Node.js automatically
5. Start command: `npm start`

## Local run
```bash
npm install
npm start
```
Open `http://localhost:3000`

## Notes
- This prototype stores data in `data/db.json`
- Uploaded photos go to `uploads/`
- On Railway, local file storage is fine for demo/testing, but production should use:
  - PostgreSQL for data
  - object storage for photos
  - authentication and permissions

## Seed data
Two demo drivers and two demo trucks are included.
