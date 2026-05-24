# Dispatcher365 Codex Agent Guide

## Repository Rules
- Preserve the Node/Express single-app architecture unless a migration is explicitly requested.
- Do not remove the local JSON fallback; it is required for local testing and transfer portability.
- Do not commit or package `node_modules`, `.git`, `data`, `uploads`, `backups`, `.env`, logs, credentials, tokens, or production exports.
- Keep changes scoped. This codebase has large `server.js`, `db.js`, and `public/app.js` files, so prefer small targeted edits over broad rewrites.
- Use `apply_patch` for manual source edits. Avoid destructive Git commands unless the user explicitly asks for them.

## Architecture Constraints
- Backend entry point: `server.js`.
- Database layer: `db.js`, switching between PostgreSQL and local JSON by the presence of `DATABASE_URL`.
- Auth: in-memory session token map plus `dfm_session` HTTP-only cookie. Sessions are cleared on process restart.
- Static frontend: `public/portal.html` loads `public/app.js`; marketing/signup/affiliate/tracking pages are separate static pages.
- Uploads: `multer` writes files to `UPLOADS_DIR` or `./uploads`. Production should use Railway volume `/data/uploads` or a future object store.
- Stripe: Checkout Sessions + Billing subscriptions. Never expose `STRIPE_SECRET_KEY` or webhook secrets to frontend code.

## Validation Commands
Run these before handoff or deployment:

```powershell
npm install
node --check server.js
node --check db.js
node --check public/app.js
node --check scripts/qa-playwright.js
$env:PORT="3120"; $env:ADMIN_EMAIL="owner@example.com"; $env:ADMIN_PASSWORD="replace-with-local-only-password"; npm start
$env:QA_BASE_URL="http://127.0.0.1:3120"; npm run qa
```

## Environment Assumptions
- Node.js 22 LTS is the recommended runtime. The app has also been smoke-tested under Node 24.
- npm is the package manager; `package-lock.json` is authoritative.
- PostgreSQL is optional locally. If `DATABASE_URL` is missing, the app creates `data/db.json`.
- Railway production should set `DATABASE_URL`, `UPLOADS_DIR=/data/uploads`, admin credentials, and Stripe variables if billing is enabled.

## Database Rules
- Schema changes belong in `db.js` startup initialization for both PostgreSQL and JSON normalization.
- Keep file DB and PostgreSQL behavior compatible.
- Never package real `data/db.json`; it can contain password hashes and customer-like test records.

## Testing Requirements
- For dispatcher-facing changes, cover company/user/driver/vehicle/assignment/load flow.
- For driver changes, test mobile viewport, inspection gate, shift start/end, load status update, issue reporting, and uploads.
- For affiliate changes, test public affiliate signup, referral persistence, signup linkage, and super-admin dashboard.
- For Stripe changes, use Checkout Sessions and webhook-safe metadata. Do not hard-code keys.

## Deployment Safety
- Railway production currently points to Dispatcher365 / DriverFleetManagement.
- Prefer running QA locally before `railway up`.
- Direct `railway up` deploys uncommitted local files; GitHub auto-deploys only see committed/pushed changes.
- Confirm upload volume and database are attached before production deployment.
