const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { hashPassword } = require('./auth');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const usePostgres = !!process.env.DATABASE_URL;

const seed = {
  users: [],
  drivers: [
    { id: 1, firstName: 'Maria', lastName: 'Lopez', phone: '555-200-3000', email: 'maria@fleetdemo.com', licenseNumber: 'AZ-443301', licenseClass: 'AZ', licenseExpiry: '2028-05-30', status: 'active' },
    { id: 2, firstName: 'AJ', lastName: 'Thompson', phone: '555-100-2211', email: 'aj@fleetdemo.com', licenseNumber: 'AZ-778210', licenseClass: 'AZ', licenseExpiry: '2027-12-31', status: 'active' }
  ],
  vehicles: [
    { id: 1, unitNumber: 'TRK-101', plateNumber: 'ABCD123', vin: '1HGBH41JXMN109186', make: 'Freightliner', model: 'Cascadia', year: 2022, type: 'tractor', odometer: 124500, status: 'active' },
    { id: 2, unitNumber: 'TRK-205', plateNumber: 'EFGH456', vin: '2HGBH41JXMN109187', make: 'Volvo', model: 'VNL', year: 2021, type: 'tractor', odometer: 156900, status: 'needs_review' }
  ],
  assignments: [
    { id: 1, driverId: 1, vehicleId: 1, active: true, assignedAt: new Date().toISOString(), unassignedAt: null },
    { id: 2, driverId: 2, vehicleId: 2, active: true, assignedAt: new Date().toISOString(), unassignedAt: null }
  ],
  shifts: [],
  inspections: [],
  issues: [
    { id: 1, shiftId: null, inspectionId: null, driverId: 2, vehicleId: 2, category: 'lights', severity: 'medium', description: 'Right marker light intermittent.', status: 'open', resolutionNotes: '', createdAt: new Date().toISOString(), closedAt: null, photos: [] }
  ]
};

let pool;
if (usePostgres) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
}

function envAdminEmail() {
  return String(process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
}
function envAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || '').trim();
}
function envAdminName() {
  return String(process.env.ADMIN_NAME || 'Fleet').trim() || 'Fleet';
}

function ensureFileDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
}
function readFileDb() {
  ensureFileDb();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeFileDb(db) {
  ensureFileDb();
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}
function nextId(items) {
  return items.length ? Math.max(...items.map(i => Number(i.id) || 0)) + 1 : 1;
}

function mapDriver(r) {
  return { id: r.id, firstName: r.first_name, lastName: r.last_name, phone: r.phone || '', email: r.email || '', licenseNumber: r.license_number || '', licenseClass: r.license_class || '', licenseExpiry: r.license_expiry ? String(r.license_expiry).slice(0, 10) : '', status: r.status };
}
function mapVehicle(r) {
  return { id: r.id, unitNumber: r.unit_number, plateNumber: r.plate_number || '', vin: r.vin || '', make: r.make || '', model: r.model || '', year: r.year || '', type: r.type || '', odometer: r.odometer || 0, status: r.status };
}
function mapAssignment(r) {
  return { id: r.id, driverId: r.driver_id, vehicleId: r.vehicle_id, active: r.active, assignedAt: r.assigned_at, unassignedAt: r.unassigned_at };
}
function mapShift(r) {
  return { id: r.id, driverId: r.driver_id, vehicleId: r.vehicle_id, startTime: r.start_time, endTime: r.end_time, startOdometer: r.start_odometer, endOdometer: r.end_odometer, status: r.status };
}
function mapInspection(r) {
  return { id: r.id, shiftId: r.shift_id, driverId: r.driver_id, vehicleId: r.vehicle_id, inspectionTime: r.inspection_time, odometer: r.odometer, overallStatus: r.overall_status, notes: r.notes || '', itemResults: r.item_results || [], photos: r.photos || [] };
}
function mapIssue(r) {
  return { id: r.id, shiftId: r.shift_id, inspectionId: r.inspection_id, driverId: r.driver_id, vehicleId: r.vehicle_id, category: r.category || 'other', severity: r.severity || 'low', description: r.description || '', status: r.status, resolutionNotes: r.resolution_notes || '', createdAt: r.created_at, closedAt: r.closed_at, photos: r.photos || [] };
}
function mapUser(r) {
  return { id: r.id, email: r.email, passwordHash: r.password_hash || r.password, role: r.role, linkedDriverId: r.linked_driver_id, firstName: r.first_name || '', lastName: r.last_name || '', isActive: r.is_active !== false };
}

async function ensureAdminUser() {
  const email = envAdminEmail();
  const password = envAdminPassword();
  if (!password) return false;
  const passwordHash = hashPassword(password);

  if (usePostgres) {
    const existing = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]);
    if (existing.rows[0]) {
      await pool.query('UPDATE users SET password_hash=$2, role=$3, is_active=true, first_name=$4, last_name=$5 WHERE id=$1', [existing.rows[0].id, passwordHash, 'admin', envAdminName(), 'Admin']);
      return true;
    }
    await pool.query('INSERT INTO users (email, password_hash, role, first_name, last_name, is_active) VALUES ($1,$2,$3,$4,$5,true)', [email, passwordHash, 'admin', envAdminName(), 'Admin']);
    return true;
  }

  const db = readFileDb();
  const idx = db.users.findIndex(u => String(u.email).toLowerCase() === email);
  const user = {
    id: idx >= 0 ? db.users[idx].id : nextId(db.users),
    email,
    passwordHash,
    role: 'admin',
    linkedDriverId: null,
    firstName: envAdminName(),
    lastName: 'Admin',
    isActive: true
  };
  if (idx >= 0) db.users[idx] = user; else db.users.push(user);
  writeFileDb(db);
  return true;
}

async function initPostgres() {
  const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
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
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    license_number TEXT,
    license_class TEXT,
    license_expiry DATE,
    status TEXT NOT NULL DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
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
    driver_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
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

  const driverCount = Number((await pool.query('SELECT COUNT(*) FROM drivers')).rows[0].count);
  if (!driverCount) {
    for (const d of seed.drivers) {
      await pool.query(`INSERT INTO drivers (id, first_name, last_name, phone, email, license_number, license_class, license_expiry, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [d.id, d.firstName, d.lastName, d.phone, d.email, d.licenseNumber, d.licenseClass, d.licenseExpiry, d.status]);
    }
    for (const v of seed.vehicles) {
      await pool.query(`INSERT INTO vehicles (id, unit_number, plate_number, vin, make, model, year, type, odometer, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [v.id, v.unitNumber, v.plateNumber, v.vin, v.make, v.model, v.year, v.type, v.odometer, v.status]);
    }
    for (const a of seed.assignments) {
      await pool.query(`INSERT INTO assignments (id, driver_id, vehicle_id, active, assigned_at, unassigned_at)
        VALUES ($1,$2,$3,$4,$5,$6)`, [a.id, a.driverId, a.vehicleId, a.active, a.assignedAt, a.unassignedAt]);
    }
    for (const i of seed.issues) {
      await pool.query(`INSERT INTO issues (id, shift_id, inspection_id, driver_id, vehicle_id, category, severity, description, status, resolution_notes, created_at, closed_at, photos)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`, [i.id, i.shiftId, i.inspectionId, i.driverId, i.vehicleId, i.category, i.severity, i.description, i.status, i.resolutionNotes, i.createdAt, i.closedAt, JSON.stringify(i.photos)]);
    }
  }
  await ensureAdminUser();
}

const commonMethods = {
  async getDriverView(driverId) {
    const drivers = await this.getDrivers();
    const assignments = await this.getAssignments();
    const vehicles = await this.getVehicles();
    const driver = drivers.find(d => d.id === driverId) || null;
    const assignment = assignments.find(a => a.driverId === driverId && a.active) || null;
    const vehicle = assignment ? vehicles.find(v => v.id === assignment.vehicleId) || null : null;
    const activeShift = await this.getActiveShiftForDriver(driverId);
    return { driver, vehicle, activeShift };
  },
  async getDashboard() {
    const today = new Date().toISOString().slice(0, 10);
    const [drivers, vehicles, shifts, inspections, issues, users] = await Promise.all([
      this.getDrivers(), this.getVehicles(), this.getShifts(), this.getInspections(), this.getIssues(), this.getUsers()
    ]);
    return {
      activeShifts: shifts.filter(s => s.status === 'started').length,
      inspectionsToday: inspections.filter(i => String(i.inspectionTime).slice(0, 10) === today).length,
      openIssues: issues.filter(i => i.status !== 'closed').length,
      outOfService: vehicles.filter(v => v.status === 'out_of_service').length,
      drivers: drivers.length,
      vehicles: vehicles.length,
      users: users.length
    };
  }
};

const fileDb = {
  async init() {
    ensureFileDb();
    await ensureAdminUser();
  },
  async hasAdminSetup() {
    const db = readFileDb();
    return db.users.some(u => u.role === 'admin');
  },
  async getUsers() {
    return readFileDb().users.map(u => ({ ...u, passwordHash: undefined }));
  },
  async findUserByEmail(email) {
    return readFileDb().users.find(u => String(u.email).toLowerCase() === String(email).toLowerCase()) || null;
  },
  async getDrivers() { return readFileDb().drivers; },
  async createDriver(data) {
    const db = readFileDb();
    const driver = { id: nextId(db.drivers), ...data };
    db.drivers.push(driver);
    if (data.createLogin && data.userPassword) {
      db.users.push({
        id: nextId(db.users),
        email: String(data.email || '').toLowerCase(),
        passwordHash: hashPassword(data.userPassword),
        role: 'driver',
        linkedDriverId: driver.id,
        firstName: data.firstName,
        lastName: data.lastName,
        isActive: true
      });
    }
    writeFileDb(db);
    return driver;
  },
  async getVehicles() { return readFileDb().vehicles; },
  async createVehicle(data) {
    const db = readFileDb();
    const vehicle = { id: nextId(db.vehicles), ...data };
    db.vehicles.push(vehicle);
    writeFileDb(db);
    return vehicle;
  },
  async getAssignments() { return readFileDb().assignments; },
  async assignVehicle(driverId, vehicleId) {
    const db = readFileDb();
    db.assignments = db.assignments.map(a => ({ ...a, active: a.driverId === driverId ? false : a.active, unassignedAt: a.driverId === driverId && a.active ? new Date().toISOString() : a.unassignedAt }));
    const assignment = { id: nextId(db.assignments), driverId, vehicleId, active: true, assignedAt: new Date().toISOString(), unassignedAt: null };
    db.assignments.push(assignment);
    writeFileDb(db);
    return assignment;
  },
  async getShifts() { return readFileDb().shifts; },
  async getActiveShiftForDriver(driverId) { return readFileDb().shifts.find(s => s.driverId === driverId && s.status === 'started') || null; },
  async startShift(driverId, vehicleId, startOdometer) {
    const db = readFileDb();
    if (db.shifts.find(s => s.driverId === driverId && s.status === 'started')) throw new Error('Driver already has an active shift.');
    const shift = { id: nextId(db.shifts), driverId, vehicleId, startTime: new Date().toISOString(), endTime: null, startOdometer, endOdometer: null, status: 'started' };
    db.shifts.push(shift);
    writeFileDb(db);
    return shift;
  },
  async endShift(shiftId, endOdometer) {
    const db = readFileDb();
    const shift = db.shifts.find(s => s.id === shiftId);
    if (!shift) throw new Error('Shift not found.');
    shift.endTime = new Date().toISOString();
    shift.endOdometer = endOdometer;
    shift.status = 'completed';
    writeFileDb(db);
    return shift;
  },
  async getInspections() { return readFileDb().inspections; },
  async createInspection(payload) {
    const db = readFileDb();
    const inspection = { id: nextId(db.inspections), ...payload, inspectionTime: new Date().toISOString() };
    db.inspections.push(inspection);
    writeFileDb(db);
    return inspection;
  },
  async getIssues() { return readFileDb().issues; },
  async createIssue(payload) {
    const db = readFileDb();
    const issue = { id: nextId(db.issues), ...payload, createdAt: new Date().toISOString(), resolutionNotes: payload.resolutionNotes || '', closedAt: null };
    db.issues.push(issue);
    writeFileDb(db);
    return issue;
  },
  async updateIssue(id, status, resolutionNotes) {
    const db = readFileDb();
    const issue = db.issues.find(i => i.id === id);
    if (!issue) throw new Error('Issue not found.');
    issue.status = status || issue.status;
    issue.resolutionNotes = resolutionNotes || issue.resolutionNotes || '';
    if (issue.status === 'closed') issue.closedAt = new Date().toISOString();
    writeFileDb(db);
    return issue;
  },
  async updateVehicleStatus(vehicleId, status) {
    const db = readFileDb();
    const vehicle = db.vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      vehicle.status = status;
      writeFileDb(db);
    }
    return vehicle;
  },
  ...commonMethods
};

const pgDb = {
  async init() { await initPostgres(); },
  async hasAdminSetup() {
    const r = await pool.query(`SELECT COUNT(*) FROM users WHERE role='admin' AND is_active=true`);
    return Number(r.rows[0].count) > 0;
  },
  async getUsers() {
    const r = await pool.query('SELECT id,email,role,linked_driver_id,first_name,last_name,is_active FROM users ORDER BY id');
    return r.rows.map(row => ({ id: row.id, email: row.email, role: row.role, linkedDriverId: row.linked_driver_id, firstName: row.first_name || '', lastName: row.last_name || '', isActive: row.is_active }));
  },
  async findUserByEmail(email) {
    const r = await pool.query('SELECT * FROM users WHERE lower(email)=lower($1) LIMIT 1', [email]);
    return r.rows[0] ? mapUser(r.rows[0]) : null;
  },
  async getDrivers() { const r = await pool.query('SELECT * FROM drivers ORDER BY id'); return r.rows.map(mapDriver); },
  async createDriver(data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query(`INSERT INTO drivers (first_name,last_name,phone,email,license_number,license_class,license_expiry,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [data.firstName, data.lastName, data.phone, data.email, data.licenseNumber, data.licenseClass, data.licenseExpiry || null, data.status]);
      const driver = mapDriver(r.rows[0]);
      if (data.createLogin && data.userPassword) {
        await client.query(`INSERT INTO users (email,password_hash,role,linked_driver_id,first_name,last_name,is_active) VALUES ($1,$2,'driver',$3,$4,$5,true)`, [String(data.email || '').toLowerCase(), hashPassword(data.userPassword), driver.id, data.firstName, data.lastName]);
      }
      await client.query('COMMIT');
      return driver;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  async getVehicles() { const r = await pool.query('SELECT * FROM vehicles ORDER BY id'); return r.rows.map(mapVehicle); },
  async createVehicle(data) { const r = await pool.query(`INSERT INTO vehicles (unit_number,plate_number,vin,make,model,year,type,odometer,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [data.unitNumber, data.plateNumber, data.vin, data.make, data.model, data.year || null, data.type, data.odometer || 0, data.status]); return mapVehicle(r.rows[0]); },
  async getAssignments() { const r = await pool.query('SELECT * FROM assignments ORDER BY id DESC'); return r.rows.map(mapAssignment); },
  async assignVehicle(driverId, vehicleId) { await pool.query('UPDATE assignments SET active=false, unassigned_at=NOW() WHERE driver_id=$1 AND active=true', [driverId]); const r = await pool.query('INSERT INTO assignments (driver_id,vehicle_id,active,assigned_at) VALUES ($1,$2,true,NOW()) RETURNING *', [driverId, vehicleId]); return mapAssignment(r.rows[0]); },
  async getShifts() { const r = await pool.query('SELECT * FROM shifts ORDER BY id DESC'); return r.rows.map(mapShift); },
  async getActiveShiftForDriver(driverId) { const r = await pool.query('SELECT * FROM shifts WHERE driver_id=$1 AND status=$2 ORDER BY id DESC LIMIT 1', [driverId, 'started']); return r.rows[0] ? mapShift(r.rows[0]) : null; },
  async startShift(driverId, vehicleId, startOdometer) {
    const existing = await this.getActiveShiftForDriver(driverId);
    if (existing) throw new Error('Driver already has an active shift.');
    const r = await pool.query('INSERT INTO shifts (driver_id, vehicle_id, start_time, start_odometer, status) VALUES ($1,$2,NOW(),$3,$4) RETURNING *', [driverId, vehicleId, startOdometer || 0, 'started']);
    return mapShift(r.rows[0]);
  },
  async endShift(shiftId, endOdometer) { const r = await pool.query('UPDATE shifts SET end_time=NOW(), end_odometer=$2, status=$3 WHERE id=$1 RETURNING *', [shiftId, endOdometer || null, 'completed']); if (!r.rows[0]) throw new Error('Shift not found.'); return mapShift(r.rows[0]); },
  async getInspections() { const r = await pool.query('SELECT * FROM inspections ORDER BY id DESC'); return r.rows.map(mapInspection); },
  async createInspection(payload) {
    const r = await pool.query(`INSERT INTO inspections (shift_id, driver_id, vehicle_id, inspection_time, odometer, overall_status, notes, item_results, photos)
      VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7::jsonb,$8::jsonb) RETURNING *`, [payload.shiftId || null, payload.driverId, payload.vehicleId, payload.odometer || 0, payload.overallStatus, payload.notes || '', JSON.stringify(payload.itemResults || []), JSON.stringify(payload.photos || [])]);
    return mapInspection(r.rows[0]);
  },
  async getIssues() { const r = await pool.query('SELECT * FROM issues ORDER BY id DESC'); return r.rows.map(mapIssue); },
  async createIssue(payload) {
    const r = await pool.query(`INSERT INTO issues (shift_id, inspection_id, driver_id, vehicle_id, category, severity, description, status, resolution_notes, created_at, photos)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10::jsonb) RETURNING *`, [payload.shiftId || null, payload.inspectionId || null, payload.driverId || null, payload.vehicleId || null, payload.category || 'other', payload.severity || 'low', payload.description || '', payload.status || 'open', payload.resolutionNotes || '', JSON.stringify(payload.photos || [])]);
    return mapIssue(r.rows[0]);
  },
  async updateIssue(id, status, resolutionNotes) {
    const r = await pool.query(`UPDATE issues SET status=$2, resolution_notes=COALESCE($3,resolution_notes), closed_at=CASE WHEN $2='closed' THEN NOW() ELSE closed_at END WHERE id=$1 RETURNING *`, [id, status, resolutionNotes || null]);
    if (!r.rows[0]) throw new Error('Issue not found.');
    return mapIssue(r.rows[0]);
  },
  async updateVehicleStatus(vehicleId, status) { const r = await pool.query('UPDATE vehicles SET status=$2 WHERE id=$1 RETURNING *', [vehicleId, status]); return r.rows[0] ? mapVehicle(r.rows[0]) : null; },
  ...commonMethods
};

module.exports = usePostgres ? pgDb : fileDb;
