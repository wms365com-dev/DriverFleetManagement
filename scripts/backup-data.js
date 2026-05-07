const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_BACKUP_DIR = path.join(ROOT_DIR, 'backups');
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR);
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(ROOT_DIR, 'uploads'));

const TABLES = [
  'companies',
  'users',
  'drivers',
  'vehicles',
  'assignments',
  'shifts',
  'inspections',
  'issues',
  'loads',
  'addresses',
  'bug_reports',
  'notifications'
];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(source, target) {
  if (!fs.existsSync(source)) return 0;
  ensureDir(target);
  let copied = 0;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copied += copyDir(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
      copied += 1;
    }
  }
  return copied;
}

async function backupPostgres(targetDir) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });

  const database = {};
  try {
    for (const table of TABLES) {
      const result = await pool.query(`SELECT * FROM ${table} ORDER BY id ASC`);
      database[table] = result.rows;
    }
  } finally {
    await pool.end();
  }

  fs.writeFileSync(
    path.join(targetDir, 'database.json'),
    JSON.stringify(database, null, 2)
  );

  return Object.fromEntries(TABLES.map(table => [table, database[table].length]));
}

function backupLocalJson(targetDir) {
  const source = path.join(ROOT_DIR, 'data', 'db.json');
  if (!fs.existsSync(source)) {
    fs.writeFileSync(path.join(targetDir, 'database.json'), '{}\n');
    return { localJson: 0 };
  }
  fs.copyFileSync(source, path.join(targetDir, 'database.json'));
  const parsed = JSON.parse(fs.readFileSync(source, 'utf8'));
  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, Array.isArray(value) ? value.length : 1])
  );
}

async function main() {
  const targetDir = path.join(BACKUP_DIR, `backup-${timestamp()}`);
  ensureDir(targetDir);

  const tableCounts = process.env.DATABASE_URL
    ? await backupPostgres(targetDir)
    : backupLocalJson(targetDir);

  const uploadCount = copyDir(UPLOADS_DIR, path.join(targetDir, 'uploads'));
  const manifest = {
    createdAt: new Date().toISOString(),
    mode: process.env.DATABASE_URL ? 'postgres' : 'local-json',
    sourceUploadsDir: UPLOADS_DIR,
    tableCounts,
    uploadCount
  };

  fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ ok: true, backupDir: targetDir, ...manifest }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
