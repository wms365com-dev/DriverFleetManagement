const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { hashPassword } = require('./auth');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const usePostgres = !!process.env.DATABASE_URL;

const seedCompany = { id: 1, name: 'Demo Fleet', code: 'DEMO', status: 'active', createdAt: new Date().toISOString() };
const seed = {
  companies: [seedCompany],
  users: [],
  drivers: [
    { id: 1, companyId: 1, firstName: 'Maria', lastName: 'Lopez', phone: '555-200-3000', email: 'maria@fleetdemo.com', licenseNumber: 'AZ-443301', licenseClass: 'AZ', licenseExpiry: '2028-05-30', status: 'active', lastLat: 43.6532, lastLng: -79.3832, lastSeenAt: new Date().toISOString(), trackingEnabled: false },
    { id: 2, companyId: 1, firstName: 'AJ', lastName: 'Thompson', phone: '555-100-2211', email: 'aj@fleetdemo.com', licenseNumber: 'AZ-778210', licenseClass: 'AZ', licenseExpiry: '2027-12-31', status: 'active', lastLat: 43.7001, lastLng: -79.4163, lastSeenAt: new Date().toISOString(), trackingEnabled: false }
  ],
  vehicles: [
    { id: 1, companyId: 1, unitNumber: 'TRK-101', plateNumber: 'ABCD123', vin: '1HGBH41JXMN109186', make: 'Freightliner', model: 'Cascadia', year: 2022, type: 'tractor', odometer: 124500, status: 'active' },
    { id: 2, companyId: 1, unitNumber: 'TRK-205', plateNumber: 'EFGH456', vin: '2HGBH41JXMN109187', make: 'Volvo', model: 'VNL', year: 2021, type: 'tractor', odometer: 156900, status: 'needs_review' }
  ],
  assignments: [
    { id: 1, companyId: 1, driverId: 1, vehicleId: 1, active: true, assignedAt: new Date().toISOString(), unassignedAt: null },
    { id: 2, companyId: 1, driverId: 2, vehicleId: 2, active: true, assignedAt: new Date().toISOString(), unassignedAt: null }
  ],
  shifts: [],
  inspections: [],
  issues: [
    { id: 1, companyId: 1, shiftId: null, inspectionId: null, driverId: 2, vehicleId: 2, category: 'lights', severity: 'medium', description: 'Right marker light intermittent.', status: 'open', resolutionNotes: '', createdAt: new Date().toISOString(), closedAt: null, photos: [] }
  ]
};

let pool;
if (usePostgres) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
}

const env = (key, fallback = '') => String(process.env[key] || fallback).trim();
const superEmail = () => env('SUPER_EMAIL', env('ADMIN_EMAIL', 'owner@example.com')).toLowerCase();
const superPassword = () => env('SUPER_PASSWORD', env('ADMIN_PASSWORD', ''));
const superName = () => env('SUPER_NAME', env('ADMIN_NAME', 'Platform Owner'));

function ensureFileDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
}
function readFileDb() {
  ensureFileDb();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeFileDb(data) {
  ensureFileDb();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function nextId(items) {
  return items.length ? Math.max(...items.map(i => Number(i.id) || 0)) + 1 : 1;
}
function mapCompany(r) {
  return { id: r.id, name: r.name, code: r.code, status: r.status, createdAt: r.created_at || r.createdAt };
}
function mapUser(r) {
  return {
    id: r.id,
    companyId: r.company_id ?? r.companyId ?? null,
    email: r.email,
    passwordHash: r.password_hash || r.passwordHash,
    role: r.role,
    linkedDriverId: r.linked_driver_id ?? r.linkedDriverId ?? null,
    firstName: r.first_name || r.firstName || '',
    lastName: r.last_name || r.lastName || '',
    isActive: r.is_active !== false
  };
}
function mapDriver(r) {
  return {
    id: r.id,
    companyId: r.company_id ?? r.companyId,
    firstName: r.first_name || r.firstName,
    lastName: r.last_name || r.lastName,
    phone: r.phone || '',
    email: r.email || '',
    licenseNumber: r.license_number || r.licenseNumber || '',
    licenseClass: r.license_class || r.licenseClass || '',
    licenseExpiry: (r.license_expiry || r.licenseExpiry) ? String(r.license_expiry || r.licenseExpiry).slice(0, 10) : '',
    status: r.status,
    lastLat: r.last_lat ?? r.lastLat ?? null,
    lastLng: r.last_lng ?? r.lastLng ?? null,
    lastSeenAt: r.last_seen_at || r.lastSeenAt || null,
    trackingEnabled: r.tracking_enabled ?? r.trackingEnabled ?? false
  };
}
function mapVehicle(r) {
  return {
    id: r.id,
    companyId: r.company_id ?? r.companyId,
    unitNumber: r.unit_number || r.unitNumber,
    plateNumber: r.plate_number || r.plateNumber || '',
    vin: r.vin || '',
    make: r.make || '',
    model: r.model || '',
    year: r.year || '',
    type: r.type || '',
    odometer: r.odometer || 0,
    status: r.status
  };
}
function mapAssignment(r) {
  return { id: r.id, companyId: r.company_id ?? r.companyId, driverId: r.driver_id ?? r.driverId, vehicleId: r.vehicle_id ?? r.vehicleId, active: r.active, assignedAt: r.assigned_at || r.assignedAt, unassignedAt: r.unassigned_at || r.unassignedAt };
}
function mapShift(r) {
  return { id: r.id, companyId: r.company_id ?? r.companyId, driverId: r.driver_id ?? r.driverId, vehicleId: r.vehicle_id ?? r.vehicleId, startTime: r.start_time || r.startTime, endTime: r.end_time || r.endTime, startOdometer: r.start_odometer ?? r.startOdometer ?? 0, endOdometer: r.end_odometer ?? r.endOdometer ?? null, status: r.status };
}
function mapInspection(r) {
  return { id: r.id, companyId: r.company_id ?? r.companyId, shiftId: r.shift_id ?? r.shiftId, driverId: r.driver_id ?? r.driverId, vehicleId: r.vehicle_id ?? r.vehicleId, inspectionTime: r.inspection_time || r.inspectionTime, odometer: r.odometer, overallStatus: r.overall_status || r.overallStatus, notes: r.notes || '', itemResults: r.item_results || r.itemResults || [], photos: r.photos || [] };
}
function mapIssue(r) {
  return { id: r.id, companyId: r.company_id ?? r.companyId, shiftId: r.shift_id ?? r.shiftId, inspectionId: r.inspection_id ?? r.inspectionId, driverId: r.driver_id ?? r.driverId, vehicleId: r.vehicle_id ?? r.vehicleId, category: r.category || 'other', severity: r.severity || 'low', description: r.description || '', status: r.status, resolutionNotes: r.resolution_notes || r.resolutionNotes || '', createdAt: r.created_at || r.createdAt, closedAt: r.closed_at || r.closedAt || null, photos: r.photos || [] };
}

function safeUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

async function ensureSuperUser() {
  const password = superPassword();
  if (!password) return false;
  const email = superEmail();
  const values = [email, hashPassword(password), 'super_user', null, superName(), 'Owner'];

  if (usePostgres) {
    const existing = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]);
    if (existing.rows[0]) {
      await pool.query(`UPDATE users SET password_hash=$2, role=$3, company_id=$4, first_name=$5, last_name=$6, is_active=true WHERE id=$1`, [existing.rows[0].id, ...values.slice(1)]);
      return true;
    }
    await pool.query(`INSERT INTO users (email,password_hash,role,company_id,first_name,last_name,is_active) VALUES ($1,$2,$3,$4,$5,$6,true)`, values);
    return true;
  }

  const db = readFileDb();
  const idx = db.users.findIndex(u => String(u.email).toLowerCase() === email);
  const next = {
    id: idx >= 0 ? db.users[idx].id : nextId(db.users),
    companyId: null,
    email,
    passwordHash: hashPassword(password),
    role: 'super_user',
    linkedDriverId: null,
    firstName: superName(),
    lastName: 'Owner',
    isActive: true
  };
  if (idx >= 0) db.users[idx] = next; else db.users.push(next);
  writeFileDb(db);
  return true;
}

async function initPostgres() {
  const schema = `
  CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    linked_driver_id INTEGER,
    first_name TEXT,
    last_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    license_number TEXT,
    license_class TEXT,
    license_expiry DATE,
    status TEXT NOT NULL DEFAULT 'active',
    last_lat DOUBLE PRECISION,
    last_lng DOUBLE PRECISION,
    last_seen_at TIMESTAMPTZ,
    tracking_enabled BOOLEAN NOT NULL DEFAULT false
  );
  CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    unit_number TEXT NOT NULL,
    plate_number TEXT,
    vin TEXT,
    make TEXT,
    model TEXT,
    year INTEGER,
    type TEXT,
    odometer INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    driver_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    driver_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    start_odometer INTEGER DEFAULT 0,
    end_odometer INTEGER,
    status TEXT NOT NULL DEFAULT 'started'
  );
  CREATE TABLE IF NOT EXISTS inspections (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    shift_id INTEGER,
    driver_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    inspection_time TIMESTAMPTZ NOT NULL,
    odometer INTEGER DEFAULT 0,
    overall_status TEXT,
    notes TEXT,
    item_results JSONB NOT NULL DEFAULT '[]'::jsonb,
    photos JSONB NOT NULL DEFAULT '[]'::jsonb
  );
  CREATE TABLE IF NOT EXISTS issues (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    shift_id INTEGER,
    inspection_id INTEGER,
    driver_id INTEGER,
    vehicle_id INTEGER,
    category TEXT,
    severity TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    photos JSONB NOT NULL DEFAULT '[]'::jsonb
  );`;
  await pool.query(schema);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE shifts ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE issues ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION`);
  await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION`);
  await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN NOT NULL DEFAULT false`);

  const companyCount = Number((await pool.query('SELECT COUNT(*) FROM companies')).rows[0].count);
  if (!companyCount) {
    await pool.query(`INSERT INTO companies (id,name,code,status,created_at) VALUES ($1,$2,$3,$4,$5)`, [seedCompany.id, seedCompany.name, seedCompany.code, seedCompany.status, seedCompany.createdAt]);
    for (const d of seed.drivers) {
      await pool.query(`INSERT INTO drivers (id,company_id,first_name,last_name,phone,email,license_number,license_class,license_expiry,status,last_lat,last_lng,last_seen_at,tracking_enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [d.id,d.companyId,d.firstName,d.lastName,d.phone,d.email,d.licenseNumber,d.licenseClass,d.licenseExpiry,d.status,d.lastLat||null,d.lastLng||null,d.lastSeenAt||null,d.trackingEnabled||false]);
    }
    for (const v of seed.vehicles) {
      await pool.query(`INSERT INTO vehicles (id,company_id,unit_number,plate_number,vin,make,model,year,type,odometer,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [v.id,v.companyId,v.unitNumber,v.plateNumber,v.vin,v.make,v.model,v.year,v.type,v.odometer,v.status]);
    }
    for (const a of seed.assignments) {
      await pool.query(`INSERT INTO assignments (id,company_id,driver_id,vehicle_id,active,assigned_at,unassigned_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [a.id,a.companyId,a.driverId,a.vehicleId,a.active,a.assignedAt,a.unassignedAt]);
    }
    for (const i of seed.issues) {
      await pool.query(`INSERT INTO issues (id,company_id,shift_id,inspection_id,driver_id,vehicle_id,category,severity,description,status,resolution_notes,created_at,closed_at,photos) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`, [i.id,i.companyId,i.shiftId,i.inspectionId,i.driverId,i.vehicleId,i.category,i.severity,i.description,i.status,i.resolutionNotes,i.createdAt,i.closedAt,JSON.stringify(i.photos)]);
    }
  }
  await pool.query(`INSERT INTO companies (id,name,code,status) VALUES (1,'Default Company','DEFAULT','active') ON CONFLICT (id) DO NOTHING`);
  await pool.query(`UPDATE users SET company_id=1 WHERE company_id IS NULL AND role <> 'super_user'`);
  await pool.query(`UPDATE drivers SET company_id=1 WHERE company_id IS NULL`);
  await pool.query(`UPDATE vehicles SET company_id=1 WHERE company_id IS NULL`);
  await pool.query(`UPDATE assignments SET company_id=1 WHERE company_id IS NULL`);
  await pool.query(`UPDATE shifts SET company_id=1 WHERE company_id IS NULL`);
  await pool.query(`UPDATE inspections SET company_id=1 WHERE company_id IS NULL`);
  await pool.query(`UPDATE issues SET company_id=1 WHERE company_id IS NULL`);
  await ensureSuperUser();
}

const commonMethods = {
  async getDriverView(companyId, driverId) {
    const [drivers, assignments, vehicles] = await Promise.all([this.getDrivers(companyId), this.getAssignments(companyId), this.getVehicles(companyId)]);
    const driver = drivers.find(d => Number(d.id) === Number(driverId)) || null;
    const assignment = assignments.find(a => Number(a.driverId) === Number(driverId) && a.active) || null;
    const vehicle = assignment ? vehicles.find(v => Number(v.id) === Number(assignment.vehicleId)) || null : null;
    const activeShift = await this.getActiveShiftForDriver(companyId, driverId);
    return { driver, vehicle, activeShift };
  },
  async getDashboard(companyId) {
    const today = new Date().toISOString().slice(0, 10);
    const [drivers, vehicles, shifts, inspections, issues, users] = await Promise.all([
      this.getDrivers(companyId), this.getVehicles(companyId), this.getShifts(companyId), this.getInspections(companyId), this.getIssues(companyId), this.getUsers(companyId)
    ]);
    return {
      activeShifts: shifts.filter(s => s.status === 'started').length,
      inspectionsToday: inspections.filter(i => String(i.inspectionTime).slice(0, 10) === today).length,
      openIssues: issues.filter(i => i.status !== 'closed').length,
      outOfService: vehicles.filter(v => v.status === 'out_of_service').length,
      drivers: drivers.length,
      vehicles: vehicles.length,
      users: users.length,
      trackedDrivers: drivers.filter(d => d.lastLat && d.lastLng).length
    };
  },
  async updateDriverLocation(companyId, driverId, lat, lng, trackingEnabled = true) {
    throw new Error('Not implemented');
  }
};

const fileDb = {
  async init() { ensureFileDb(); await ensureSuperUser(); },
  async hasAdminSetup() { return readFileDb().users.some(u => u.role === 'super_user'); },
  async getCompanies() { return readFileDb().companies; },
  async createCompany(data) {
    const db = readFileDb();
    const company = { id: nextId(db.companies), name: data.name, code: (data.code || data.name).toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20), status: data.status || 'active', createdAt: new Date().toISOString() };
    db.companies.push(company);
    writeFileDb(db);
    return company;
  },
  async getUsers(companyId) {
    return readFileDb().users.filter(u => companyId ? Number(u.companyId) === Number(companyId) : true).map(safeUser);
  },
  async createUser(data) {
    const db = readFileDb();
    const user = { id: nextId(db.users), companyId: data.companyId || null, email: String(data.email).toLowerCase(), passwordHash: hashPassword(data.password), role: data.role, linkedDriverId: data.linkedDriverId || null, firstName: data.firstName || '', lastName: data.lastName || '', isActive: true };
    db.users.push(user);
    writeFileDb(db);
    return safeUser(user);
  },
  async findUserByEmail(email) {
    const found = readFileDb().users.find(u => String(u.email).toLowerCase() === String(email).toLowerCase());
    return found ? mapUser(found) : null;
  },
  async getDrivers(companyId) { return readFileDb().drivers.filter(d => Number(d.companyId) === Number(companyId)); },
  async createDriver(companyId, data) {
    const db = readFileDb();
    const driver = { id: nextId(db.drivers), companyId, firstName: data.firstName, lastName: data.lastName, phone: data.phone || '', email: data.email || '', licenseNumber: data.licenseNumber || '', licenseClass: data.licenseClass || '', licenseExpiry: data.licenseExpiry || '', status: data.status || 'active', lastLat: null, lastLng: null, lastSeenAt: null, trackingEnabled: false };
    db.drivers.push(driver);
    if (data.createLogin && data.userPassword) {
      db.users.push({ id: nextId(db.users), companyId, email: String(data.email || '').toLowerCase(), passwordHash: hashPassword(data.userPassword), role: 'driver', linkedDriverId: driver.id, firstName: data.firstName, lastName: data.lastName, isActive: true });
    }
    writeFileDb(db);
    return driver;
  },
  async getVehicles(companyId) { return readFileDb().vehicles.filter(v => Number(v.companyId) === Number(companyId)); },
  async createVehicle(companyId, data) {
    const db = readFileDb();
    const vehicle = { id: nextId(db.vehicles), companyId, ...data };
    db.vehicles.push(vehicle);
    writeFileDb(db);
    return vehicle;
  },
  async getAssignments(companyId) { return readFileDb().assignments.filter(a => Number(a.companyId) === Number(companyId)); },
  async assignVehicle(companyId, driverId, vehicleId) {
    const db = readFileDb();
    db.assignments = db.assignments.map(a => (Number(a.companyId) === Number(companyId) && Number(a.driverId) === Number(driverId) && a.active) ? { ...a, active: false, unassignedAt: new Date().toISOString() } : a);
    const assignment = { id: nextId(db.assignments), companyId, driverId, vehicleId, active: true, assignedAt: new Date().toISOString(), unassignedAt: null };
    db.assignments.push(assignment);
    writeFileDb(db);
    return assignment;
  },
  async getShifts(companyId) { return readFileDb().shifts.filter(s => Number(s.companyId) === Number(companyId)); },
  async getActiveShiftForDriver(companyId, driverId) { return readFileDb().shifts.find(s => Number(s.companyId) === Number(companyId) && Number(s.driverId) === Number(driverId) && s.status === 'started') || null; },
  async startShift(companyId, driverId, vehicleId, startOdometer) {
    const db = readFileDb();
    if (db.shifts.find(s => Number(s.companyId) === Number(companyId) && Number(s.driverId) === Number(driverId) && s.status === 'started')) throw new Error('Driver already has an active shift.');
    const shift = { id: nextId(db.shifts), companyId, driverId, vehicleId, startTime: new Date().toISOString(), endTime: null, startOdometer, endOdometer: null, status: 'started' };
    db.shifts.push(shift);
    writeFileDb(db);
    return shift;
  },
  async endShift(companyId, shiftId, endOdometer) {
    const db = readFileDb();
    const shift = db.shifts.find(s => Number(s.companyId) === Number(companyId) && Number(s.id) === Number(shiftId));
    if (!shift) throw new Error('Shift not found.');
    shift.endTime = new Date().toISOString();
    shift.endOdometer = endOdometer;
    shift.status = 'completed';
    writeFileDb(db);
    return shift;
  },
  async getInspections(companyId) { return readFileDb().inspections.filter(i => Number(i.companyId) === Number(companyId)); },
  async createInspection(companyId, payload) {
    const db = readFileDb();
    const inspection = { id: nextId(db.inspections), companyId, ...payload, inspectionTime: new Date().toISOString() };
    db.inspections.push(inspection);
    writeFileDb(db);
    return inspection;
  },
  async getIssues(companyId) { return readFileDb().issues.filter(i => Number(i.companyId) === Number(companyId)); },
  async createIssue(companyId, payload) {
    const db = readFileDb();
    const issue = { id: nextId(db.issues), companyId, ...payload, createdAt: new Date().toISOString(), resolutionNotes: payload.resolutionNotes || '', closedAt: null };
    db.issues.push(issue);
    writeFileDb(db);
    return issue;
  },
  async updateIssue(companyId, id, status, resolutionNotes) {
    const db = readFileDb();
    const issue = db.issues.find(i => Number(i.companyId) === Number(companyId) && Number(i.id) === Number(id));
    if (!issue) throw new Error('Issue not found.');
    issue.status = status || issue.status;
    issue.resolutionNotes = resolutionNotes || issue.resolutionNotes || '';
    if (issue.status === 'closed') issue.closedAt = new Date().toISOString();
    writeFileDb(db);
    return issue;
  },
  async updateVehicleStatus(companyId, vehicleId, status) {
    const db = readFileDb();
    const vehicle = db.vehicles.find(v => Number(v.companyId) === Number(companyId) && Number(v.id) === Number(vehicleId));
    if (vehicle) { vehicle.status = status; writeFileDb(db); }
    return vehicle;
  },
  async updateDriverLocation(companyId, driverId, lat, lng, trackingEnabled = true) {
    const db = readFileDb();
    const driver = db.drivers.find(d => Number(d.companyId) === Number(companyId) && Number(d.id) === Number(driverId));
    if (!driver) throw new Error('Driver not found.');
    driver.lastLat = Number(lat);
    driver.lastLng = Number(lng);
    driver.lastSeenAt = new Date().toISOString();
    driver.trackingEnabled = !!trackingEnabled;
    writeFileDb(db);
    return driver;
  },
  ...commonMethods
};

const pgDb = {
  async init() { await initPostgres(); },
  async hasAdminSetup() { const r = await pool.query(`SELECT COUNT(*) FROM users WHERE role='super_user' AND is_active=true`); return Number(r.rows[0].count) > 0; },
  async getCompanies() { const r = await pool.query('SELECT * FROM companies ORDER BY name'); return r.rows.map(mapCompany); },
  async createCompany(data) {
    const code = (data.code || data.name).toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20);
    const r = await pool.query(`INSERT INTO companies (name,code,status) VALUES ($1,$2,$3) RETURNING *`, [data.name, code, data.status || 'active']);
    return mapCompany(r.rows[0]);
  },
  async getUsers(companyId) {
    const params = [];
    let sql = 'SELECT id,company_id,email,role,linked_driver_id,first_name,last_name,is_active FROM users';
    if (companyId) { params.push(companyId); sql += ` WHERE company_id=$${params.length}`; }
    sql += ' ORDER BY id DESC';
    const r = await pool.query(sql, params);
    return r.rows.map(row => safeUser(mapUser(row)));
  },
  async createUser(data) {
    const r = await pool.query(`INSERT INTO users (company_id,email,password_hash,role,linked_driver_id,first_name,last_name,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING id,company_id,email,role,linked_driver_id,first_name,last_name,is_active`, [data.companyId || null, String(data.email).toLowerCase(), hashPassword(data.password), data.role, data.linkedDriverId || null, data.firstName || '', data.lastName || '']);
    return safeUser(mapUser(r.rows[0]));
  },
  async findUserByEmail(email) {
    const r = await pool.query('SELECT * FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]);
    return r.rows[0] ? mapUser(r.rows[0]) : null;
  },
  async getDrivers(companyId) { const r = await pool.query('SELECT * FROM drivers WHERE company_id=$1 ORDER BY id DESC', [companyId]); return r.rows.map(mapDriver); },
  async createDriver(companyId, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(`INSERT INTO drivers (company_id,first_name,last_name,phone,email,license_number,license_class,license_expiry,status,last_lat,last_lng,last_seen_at,tracking_enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,NULL,NULL,false) RETURNING *`, [companyId, data.firstName, data.lastName, data.phone || '', data.email || '', data.licenseNumber || '', data.licenseClass || '', data.licenseExpiry || null, data.status || 'active']);
      const driver = mapDriver(r.rows[0]);
      if (data.createLogin && data.userPassword) {
        await client.query(`INSERT INTO users (company_id,email,password_hash,role,linked_driver_id,first_name,last_name,is_active) VALUES ($1,$2,$3,'driver',$4,$5,$6,true)`, [companyId, String(data.email || '').toLowerCase(), hashPassword(data.userPassword), driver.id, data.firstName, data.lastName]);
      }
      await client.query('COMMIT');
      return driver;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  },
  async getVehicles(companyId) { const r = await pool.query('SELECT * FROM vehicles WHERE company_id=$1 ORDER BY id DESC', [companyId]); return r.rows.map(mapVehicle); },
  async createVehicle(companyId, data) { const r = await pool.query(`INSERT INTO vehicles (company_id,unit_number,plate_number,vin,make,model,year,type,odometer,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [companyId, data.unitNumber, data.plateNumber || '', data.vin || '', data.make || '', data.model || '', data.year || null, data.type || 'tractor', data.odometer || 0, data.status || 'active']); return mapVehicle(r.rows[0]); },
  async getAssignments(companyId) { const r = await pool.query('SELECT * FROM assignments WHERE company_id=$1 ORDER BY id DESC', [companyId]); return r.rows.map(mapAssignment); },
  async assignVehicle(companyId, driverId, vehicleId) { await pool.query('UPDATE assignments SET active=false, unassigned_at=NOW() WHERE company_id=$1 AND driver_id=$2 AND active=true', [companyId, driverId]); const r = await pool.query('INSERT INTO assignments (company_id,driver_id,vehicle_id,active,assigned_at) VALUES ($1,$2,$3,true,NOW()) RETURNING *', [companyId, driverId, vehicleId]); return mapAssignment(r.rows[0]); },
  async getShifts(companyId) { const r = await pool.query('SELECT * FROM shifts WHERE company_id=$1 ORDER BY id DESC', [companyId]); return r.rows.map(mapShift); },
  async getActiveShiftForDriver(companyId, driverId) { const r = await pool.query('SELECT * FROM shifts WHERE company_id=$1 AND driver_id=$2 AND status=$3 ORDER BY id DESC LIMIT 1', [companyId, driverId, 'started']); return r.rows[0] ? mapShift(r.rows[0]) : null; },
  async startShift(companyId, driverId, vehicleId, startOdometer) { const existing = await this.getActiveShiftForDriver(companyId, driverId); if (existing) throw new Error('Driver already has an active shift.'); const r = await pool.query('INSERT INTO shifts (company_id,driver_id,vehicle_id,start_time,start_odometer,status) VALUES ($1,$2,$3,NOW(),$4,$5) RETURNING *', [companyId, driverId, vehicleId, startOdometer || 0, 'started']); return mapShift(r.rows[0]); },
  async endShift(companyId, shiftId, endOdometer) { const r = await pool.query('UPDATE shifts SET end_time=NOW(), end_odometer=$3, status=$4 WHERE company_id=$1 AND id=$2 RETURNING *', [companyId, shiftId, endOdometer || null, 'completed']); if (!r.rows[0]) throw new Error('Shift not found.'); return mapShift(r.rows[0]); },
  async getInspections(companyId) { const r = await pool.query('SELECT * FROM inspections WHERE company_id=$1 ORDER BY id DESC', [companyId]); return r.rows.map(mapInspection); },
  async createInspection(companyId, payload) { const r = await pool.query(`INSERT INTO inspections (company_id,shift_id,driver_id,vehicle_id,inspection_time,odometer,overall_status,notes,item_results,photos) VALUES ($1,$2,$3,$4,NOW(),$5,$6,$7,$8::jsonb,$9::jsonb) RETURNING *`, [companyId, payload.shiftId || null, payload.driverId, payload.vehicleId, payload.odometer || 0, payload.overallStatus || 'pass', payload.notes || '', JSON.stringify(payload.itemResults || []), JSON.stringify(payload.photos || [])]); return mapInspection(r.rows[0]); },
  async getIssues(companyId) { const r = await pool.query('SELECT * FROM issues WHERE company_id=$1 ORDER BY id DESC', [companyId]); return r.rows.map(mapIssue); },
  async createIssue(companyId, payload) { const r = await pool.query(`INSERT INTO issues (company_id,shift_id,inspection_id,driver_id,vehicle_id,category,severity,description,status,resolution_notes,created_at,photos) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11::jsonb) RETURNING *`, [companyId, payload.shiftId || null, payload.inspectionId || null, payload.driverId || null, payload.vehicleId || null, payload.category || 'other', payload.severity || 'low', payload.description || '', payload.status || 'open', payload.resolutionNotes || '', JSON.stringify(payload.photos || [])]); return mapIssue(r.rows[0]); },
  async updateIssue(companyId, id, status, resolutionNotes) { const r = await pool.query(`UPDATE issues SET status=$3,resolution_notes=COALESCE($4,resolution_notes),closed_at=CASE WHEN $3='closed' THEN NOW() ELSE closed_at END WHERE company_id=$1 AND id=$2 RETURNING *`, [companyId, id, status, resolutionNotes || null]); if (!r.rows[0]) throw new Error('Issue not found.'); return mapIssue(r.rows[0]); },
  async updateDriverLocation(companyId, driverId, lat, lng, trackingEnabled = true) { const r = await pool.query('UPDATE drivers SET last_lat=$3,last_lng=$4,last_seen_at=NOW(),tracking_enabled=$5 WHERE company_id=$1 AND id=$2 RETURNING *', [companyId, driverId, Number(lat), Number(lng), !!trackingEnabled]); if (!r.rows[0]) throw new Error('Driver not found.'); return mapDriver(r.rows[0]); },
  async updateVehicleStatus(companyId, vehicleId, status) { const r = await pool.query('UPDATE vehicles SET status=$3 WHERE company_id=$1 AND id=$2 RETURNING *', [companyId, vehicleId, status]); return r.rows[0] ? mapVehicle(r.rows[0]) : null; },
  ...commonMethods
};

module.exports = usePostgres ? pgDb : fileDb;
