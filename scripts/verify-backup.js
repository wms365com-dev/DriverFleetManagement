const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(ROOT_DIR, 'backups'));
const REQUIRED_COLLECTIONS = ['companies', 'users', 'drivers', 'vehicles', 'loads', 'inspections', 'issues', 'notifications'];

function latestBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  return fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('backup-'))
    .map(entry => path.join(BACKUP_DIR, entry.name))
    .sort()
    .pop() || null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const dir = path.resolve(process.argv[2] || latestBackupDir() || '');
  if (!dir || !fs.existsSync(dir)) throw new Error('Backup directory was not found.');
  const manifestPath = path.join(dir, 'manifest.json');
  const databasePath = path.join(dir, 'database.json');
  if (!fs.existsSync(manifestPath)) throw new Error('manifest.json is missing.');
  if (!fs.existsSync(databasePath)) throw new Error('database.json is missing.');
  const manifest = readJson(manifestPath);
  const database = readJson(databasePath);
  const missing = REQUIRED_COLLECTIONS.filter(key => !Array.isArray(database[key]));
  if (missing.length) throw new Error(`Backup database is missing collections: ${missing.join(', ')}`);
  const uploadDir = path.join(dir, 'uploads');
  const uploadCount = fs.existsSync(uploadDir)
    ? fs.readdirSync(uploadDir, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).length
    : 0;
  const result = {
    ok: true,
    backupDir: dir,
    createdAt: manifest.createdAt,
    mode: manifest.mode,
    collections: Object.fromEntries(REQUIRED_COLLECTIONS.map(key => [key, database[key].length])),
    uploadCount
  };
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
