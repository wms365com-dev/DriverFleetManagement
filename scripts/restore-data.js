const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT_DIR, 'data', 'db.json');
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(ROOT_DIR, 'uploads'));

function copyDir(source, target) {
  if (!fs.existsSync(source)) return 0;
  fs.mkdirSync(target, { recursive: true });
  let copied = 0;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copied += copyDir(from, to);
    if (entry.isFile()) {
      fs.copyFileSync(from, to);
      copied += 1;
    }
  }
  return copied;
}

function main() {
  const backupDir = path.resolve(process.argv[2] || '');
  if (!backupDir || !fs.existsSync(backupDir)) throw new Error('Usage: node scripts/restore-data.js <backup-dir>');
  const databasePath = path.join(backupDir, 'database.json');
  if (!fs.existsSync(databasePath)) throw new Error('database.json is missing from backup.');
  const parsed = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
  if (!parsed || !Array.isArray(parsed.companies) || !Array.isArray(parsed.users)) throw new Error('Backup database does not look valid.');
  if (process.env.RESTORE_CONFIRM !== 'yes') {
    console.log(JSON.stringify({ ok: true, dryRun: true, message: 'Restore verified. Set RESTORE_CONFIRM=yes to replace local JSON data.', backupDir }, null, 2));
    return;
  }
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (fs.existsSync(DATA_FILE)) {
    fs.copyFileSync(DATA_FILE, `${DATA_FILE}.${new Date().toISOString().replace(/[:.]/g, '-')}.pre-restore`);
  }
  fs.copyFileSync(databasePath, DATA_FILE);
  const uploadCount = copyDir(path.join(backupDir, 'uploads'), UPLOADS_DIR);
  console.log(JSON.stringify({ ok: true, dryRun: false, restoredDatabase: DATA_FILE, uploadCount }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
