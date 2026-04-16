# Driver Fleet Management v3

Railway-ready driver and vehicle management app with:
- protected login (no demo credentials in the UI)
- admin account created from Railway environment variables
- hashed passwords using Node `crypto.scrypt`
- PostgreSQL support via `DATABASE_URL`
- JSON fallback for local testing if PostgreSQL is not attached yet
- mobile driver flow with phone camera upload for inspections and issue photos
- configurable uploads directory for Railway volume storage

## Required Railway Variables
Set these on the web service:

- `ADMIN_EMAIL=you@example.com`
- `ADMIN_PASSWORD=choose-a-strong-password`
- `ADMIN_NAME=Grey Wolf` (optional)
- `SESSION_SECRET=change-me` (reserved for later cookie signing)
- `UPLOADS_DIR=/data/uploads` if using a Railway volume

## Recommended Railway Setup
1. Add a **PostgreSQL** service.
2. In the web service, add a reference variable for `DATABASE_URL` from the PostgreSQL service.
3. Add a **Volume** and mount it to `/data`.
4. Set `UPLOADS_DIR=/data/uploads`.
5. Redeploy the service.

## Why use a Volume?
If you keep uploads on the app filesystem without a volume, photos can be lost during redeploys or restarts. Using a Railway volume keeps the files persistent.

## Local Run
```bash
npm install
set ADMIN_EMAIL=admin@example.com
set ADMIN_PASSWORD=strongpassword
npm start
```

Then open `http://localhost:3000`

## Deployment Commands
- Build command: `npm install`
- Start command: `npm start`

## Notes
- Drivers can capture images directly from a phone using the file input with `accept="image/*"` and `capture="environment"`.
- The admin creates driver login accounts from the Drivers screen by checking **Create driver login** and setting a password.
- Uploaded photos are served from `/uploads/...` and stored at the path set by `UPLOADS_DIR`.
