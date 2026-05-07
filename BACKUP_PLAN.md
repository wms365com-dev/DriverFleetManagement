# Dispatcher365 Backup Plan

Customers trust the system with shipment records, driver activity, inspections, POD/BOL photos, signatures, and company data. Backups must cover both the PostgreSQL database and uploaded files.

## What Must Be Backed Up

- PostgreSQL tables: companies, users, drivers, vehicles, assignments, shifts, inspections, issues, loads, addresses, bug reports, and notifications.
- Uploaded files: BOL, POD, inspection photos, signature images, proof photos, and issue attachments from `UPLOADS_DIR`.
- Environment configuration: Railway variables, domain settings, Geoapify key, and any future SMS/email provider keys. Store these in a password manager, not in Git.

## Production Recommendation

1. Enable Railway PostgreSQL automated backups or snapshots.
2. Add a separate object storage bucket for uploads, such as Cloudflare R2, AWS S3, Backblaze B2, or Supabase Storage.
3. Run the app with a persistent upload location until object storage is added. Railway filesystem storage should not be treated as permanent unless it is backed by a configured volume.
4. Schedule `npm run backup` daily and store the output outside the app server.
5. Keep at least:
   - 7 daily backups
   - 4 weekly backups
   - 12 monthly backups
6. Test restore monthly into a separate staging database.

## Parallel / Standby Data

For a second copy that can run in parallel:

- Best: use a managed PostgreSQL read replica or scheduled restore into a standby Railway/Supabase/Neon database.
- Good: run daily exports with `npm run backup` into offsite storage.
- Minimum: Railway snapshots plus copied upload files.

Do not use the app server folder as the only backup location. If the server is deleted or redeployed, those backups can disappear with it.

## Manual Backup

From the project folder:

```powershell
npm run backup
```

Optional output location:

```powershell
$env:BACKUP_DIR='C:\dispatcher365-backups'
npm run backup
```

The backup creates:

- `database.json`
- `uploads/`
- `manifest.json`

## Restore Checklist

1. Create a fresh database.
2. Restore database rows from the latest verified backup.
3. Restore uploaded files to the configured `UPLOADS_DIR` or object storage bucket.
4. Start the app against the restored database.
5. Confirm login, load search, public tracking, document visibility, and driver upload flows.

## Next Build Item

Move uploads to object storage and save file metadata in Postgres. That will make POD/BOL documents safer and easier to back up, restore, and serve publicly.
