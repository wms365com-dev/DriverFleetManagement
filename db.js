const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { hashPassword } = require('./auth');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const usePostgres = !!process.env.DATABASE_URL;

function makeTrackingToken() {
  return crypto.randomBytes(18).toString('hex');
}
function normalizeCompanyCode(value) {
  return String(value || 'COMPANY').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'COMPANY';
}
function generatedCompanyCode(name, id) {
  const base = normalizeCompanyCode(name).slice(0, 4).padEnd(4, 'X');
  return `${base}${String(id).padStart(4, '0')}`.slice(0, 8);
}
function loadNumberFromCompanyCode(code, sequence) {
  return `${normalizeCompanyCode(code)}-${new Date().getFullYear()}-${String(sequence).padStart(6, '0')}`;
}
function ensureCompanyLoadNumber(company, loads, requested = '') {
  const code = normalizeCompanyCode(company?.code || company?.name || 'COMPANY');
  const manual = String(requested || '').trim().toUpperCase();
  if (manual) return manual.startsWith(`${code}-`) ? manual : `${code}-${manual}`;
  const year = new Date().getFullYear();
  const sequence = loads.filter(load => Number(load.companyId ?? load.company_id) === Number(company.id) && String((load.loadNumber ?? load.load_number) || '').includes(`-${year}-`)).length + 1;
  return loadNumberFromCompanyCode(code, sequence);
}

const seedCompany = { id: 1, name: 'Demo Fleet', code: 'DEMO0001', status: 'active', createdAt: new Date().toISOString() };
const seed = {
  companies: [seedCompany],
  users: [],
  drivers: [
    { id: 1, companyId: 1, firstName: 'Maria', lastName: 'Lopez', phone: '555-200-3000', email: 'maria@fleetdemo.com', licenseNumber: 'AZ-443301', licenseClass: 'AZ', licenseExpiry: '2028-05-30', status: 'active', lastLat: 43.6532, lastLng: -79.3832, lastSeenAt: new Date().toISOString(), trackingEnabled: false },
    { id: 2, companyId: 1, firstName: 'AJ', lastName: 'Thompson', phone: '555-100-2211', email: 'aj@fleetdemo.com', licenseNumber: 'AZ-778210', licenseClass: 'AZ', licenseExpiry: '2027-12-31', status: 'active', lastLat: 43.7001, lastLng: -79.4163, lastSeenAt: new Date().toISOString(), trackingEnabled: false }
  ],
  vehicles: [
    { id: 1, companyId: 1, unitNumber: 'TRK-101', plateNumber: 'ABCD123', vin: '1HGBH41JXMN109186', make: 'Freightliner', model: 'Cascadia', year: 2022, type: 'tractor', category: 'power_unit', length: '', maxWeight: null, temperatureCapable: false, liftgate: false, hazmatCapable: false, odometer: 124500, status: 'active' },
    { id: 2, companyId: 1, unitNumber: 'TRK-205', plateNumber: 'EFGH456', vin: '2HGBH41JXMN109187', make: 'Volvo', model: 'VNL', year: 2021, type: 'sleeper_cab', category: 'power_unit', length: '', maxWeight: null, temperatureCapable: false, liftgate: false, hazmatCapable: false, odometer: 156900, status: 'needs_review' }
  ],
  assignments: [
    { id: 1, companyId: 1, driverId: 1, vehicleId: 1, active: true, assignedAt: new Date().toISOString(), unassignedAt: null },
    { id: 2, companyId: 1, driverId: 2, vehicleId: 2, active: true, assignedAt: new Date().toISOString(), unassignedAt: null }
  ],
  shifts: [],
  inspections: [],
  loads: [],
  addresses: [],
  affiliates: [],
  affiliateReferrals: [],
  bugReports: [],
  notifications: [],
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
  normalizeFileDb();
}
function normalizeFileDb() {
  let changed = false;
  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  for (const [key, fallback] of Object.entries(seed)) {
    if (!Array.isArray(db[key])) {
      db[key] = Array.isArray(fallback) ? [...fallback] : fallback;
      changed = true;
    }
  }
  if (!db.companies.find(c => Number(c.id) === Number(seedCompany.id))) {
    db.companies.unshift(seedCompany);
    changed = true;
  }
  const usedCompanyCodes = new Set();
  for (const company of db.companies) {
    if (!Object.prototype.hasOwnProperty.call(company, 'billingStatus')) { company.billingStatus = 'active'; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(company, 'billingPlan')) { company.billingPlan = ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(company, 'stripeCustomerId')) { company.stripeCustomerId = ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(company, 'stripeSubscriptionId')) { company.stripeSubscriptionId = ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(company, 'subscriptionCurrentPeriodEnd')) { company.subscriptionCurrentPeriodEnd = null; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(company, 'affiliateCode')) { company.affiliateCode = ''; changed = true; }
    const previous = normalizeCompanyCode(company.code || company.name);
    let code = previous;
    let suffix = 1;
    while (usedCompanyCodes.has(code)) {
      code = `${previous.slice(0, 6)}${String(suffix).padStart(2, '0')}`.slice(0, 8);
      suffix += 1;
    }
    if (company.code !== code) { company.code = code; changed = true; }
    usedCompanyCodes.add(code);
  }
  for (const user of db.users) {
    if (user.role !== 'super_user' && !user.companyId) {
      user.companyId = seedCompany.id;
      changed = true;
    }
  }
  for (const driver of db.drivers) {
    if (!driver.companyId) { driver.companyId = seedCompany.id; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(driver, 'lastLat')) { driver.lastLat = null; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(driver, 'lastLng')) { driver.lastLng = null; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(driver, 'lastSeenAt')) { driver.lastSeenAt = null; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(driver, 'trackingEnabled')) { driver.trackingEnabled = false; changed = true; }
    if (!Array.isArray(driver.locationHistory)) { driver.locationHistory = []; changed = true; }
  }
  for (const vehicle of db.vehicles) {
    if (!vehicle.companyId) { vehicle.companyId = seedCompany.id; changed = true; }
    if (!vehicle.category) { vehicle.category = ['dry_van', 'reefer', 'flatbed', 'step_deck', 'container_chassis', 'trailer'].includes(vehicle.type) ? 'trailer' : 'power_unit'; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(vehicle, 'imageKey')) { vehicle.imageKey = vehicle.type || ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(vehicle, 'length')) { vehicle.length = ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(vehicle, 'maxWeight')) { vehicle.maxWeight = null; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(vehicle, 'temperatureCapable')) { vehicle.temperatureCapable = false; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(vehicle, 'liftgate')) { vehicle.liftgate = false; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(vehicle, 'hazmatCapable')) { vehicle.hazmatCapable = false; changed = true; }
  }
  for (const key of ['vehicles', 'assignments', 'shifts', 'inspections', 'issues']) {
    for (const item of db[key]) {
      if (!item.companyId) { item.companyId = seedCompany.id; changed = true; }
    }
  }
  for (const inspection of db.inspections) {
    if (!Object.prototype.hasOwnProperty.call(inspection, 'signatureName')) { inspection.signatureName = ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(inspection, 'signatureDataUrl')) { inspection.signatureDataUrl = ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(inspection, 'signedAt')) { inspection.signedAt = null; changed = true; }
  }
  for (const load of db.loads) {
    if (!load.companyId) { load.companyId = seedCompany.id; changed = true; }
    if (!Array.isArray(load.events)) { load.events = []; changed = true; }
    if (!Array.isArray(load.documents)) { load.documents = []; changed = true; }
    if (!load.publicTrackingToken) { load.publicTrackingToken = makeTrackingToken(); changed = true; }
  }
  for (const address of db.addresses) {
    if (!address.companyId) { address.companyId = seedCompany.id; changed = true; }
    if (!address.type) { address.type = 'both'; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(address, 'customer')) { address.customer = ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(address, 'contactName')) { address.contactName = ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(address, 'phone')) { address.phone = ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(address, 'email')) { address.email = ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(address, 'hours')) { address.hours = ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(address, 'dockNotes')) { address.dockNotes = ''; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(address, 'createdAt')) { address.createdAt = new Date().toISOString(); changed = true; }
    if (!Object.prototype.hasOwnProperty.call(address, 'lastUsedAt')) { address.lastUsedAt = null; changed = true; }
  }
  for (const report of db.bugReports) {
    if (!report.companyId) { report.companyId = seedCompany.id; changed = true; }
    if (!Array.isArray(report.photos)) { report.photos = []; changed = true; }
  }
  for (const notification of db.notifications) {
    if (!Object.prototype.hasOwnProperty.call(notification, 'readAt')) { notification.readAt = null; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(notification, 'metadata')) { notification.metadata = {}; changed = true; }
  }
  for (const affiliate of db.affiliates) {
    if (!Object.prototype.hasOwnProperty.call(affiliate, 'status')) { affiliate.status = 'active'; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(affiliate, 'commissionRate')) { affiliate.commissionRate = 25; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(affiliate, 'createdAt')) { affiliate.createdAt = new Date().toISOString(); changed = true; }
  }
  for (const referral of db.affiliateReferrals) {
    if (!Object.prototype.hasOwnProperty.call(referral, 'status')) { referral.status = 'signup_submitted'; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(referral, 'commissionRate')) { referral.commissionRate = 25; changed = true; }
    if (!Object.prototype.hasOwnProperty.call(referral, 'updatedAt')) { referral.updatedAt = referral.createdAt || new Date().toISOString(); changed = true; }
  }
  if (changed) fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
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
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    status: r.status,
    billingStatus: r.billing_status || r.billingStatus || 'active',
    billingPlan: r.billing_plan || r.billingPlan || '',
    stripeCustomerId: r.stripe_customer_id || r.stripeCustomerId || '',
    stripeSubscriptionId: r.stripe_subscription_id || r.stripeSubscriptionId || '',
    subscriptionCurrentPeriodEnd: r.subscription_current_period_end || r.subscriptionCurrentPeriodEnd || null,
    affiliateCode: r.affiliate_code || r.affiliateCode || '',
    createdAt: r.created_at || r.createdAt
  };
}
function mapAffiliate(r) {
  return {
    id: r.id,
    code: r.code,
    firstName: r.first_name || r.firstName || '',
    lastName: r.last_name || r.lastName || '',
    email: r.email || '',
    phone: r.phone || '',
    companyName: r.company_name || r.companyName || '',
    promotionUrl: r.promotion_url || r.promotionUrl || '',
    promoterType: r.promoter_type || r.promoterType || 'independent',
    payoutEmail: r.payout_email || r.payoutEmail || '',
    notes: r.notes || '',
    status: r.status || 'active',
    commissionRate: Number(r.commission_rate ?? r.commissionRate ?? 25),
    createdAt: r.created_at || r.createdAt
  };
}
function mapAffiliateReferral(r) {
  return {
    id: r.id,
    affiliateId: r.affiliate_id ?? r.affiliateId,
    affiliateCode: r.affiliate_code || r.affiliateCode || '',
    companyId: r.company_id ?? r.companyId ?? null,
    companyName: r.company_name || r.companyName || '',
    plan: r.plan || '',
    driverQuantity: Number(r.driver_quantity ?? r.driverQuantity ?? 0),
    status: r.status || 'signup_submitted',
    commissionRate: Number(r.commission_rate ?? r.commissionRate ?? 25),
    estimatedMonthlyCommission: Number(r.estimated_monthly_commission ?? r.estimatedMonthlyCommission ?? 0),
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt
  };
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
    trackingEnabled: r.tracking_enabled ?? r.trackingEnabled ?? false,
    locationHistory: r.location_history || r.locationHistory || []
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
    imageKey: r.image_key || r.imageKey || '',
    category: r.category || 'power_unit',
    length: r.length || '',
    maxWeight: r.max_weight ?? r.maxWeight ?? null,
    temperatureCapable: r.temperature_capable ?? r.temperatureCapable ?? false,
    liftgate: r.liftgate ?? false,
    hazmatCapable: r.hazmat_capable ?? r.hazmatCapable ?? false,
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
  return { id: r.id, companyId: r.company_id ?? r.companyId, shiftId: r.shift_id ?? r.shiftId, driverId: r.driver_id ?? r.driverId, vehicleId: r.vehicle_id ?? r.vehicleId, inspectionTime: r.inspection_time || r.inspectionTime, odometer: r.odometer, overallStatus: r.overall_status || r.overallStatus, notes: r.notes || '', itemResults: r.item_results || r.itemResults || [], photos: r.photos || [], signatureName: r.signature_name || r.signatureName || '', signatureDataUrl: r.signature_data_url || r.signatureDataUrl || '', signedAt: r.signed_at || r.signedAt || null };
}
function mapIssue(r) {
  return { id: r.id, companyId: r.company_id ?? r.companyId, shiftId: r.shift_id ?? r.shiftId, inspectionId: r.inspection_id ?? r.inspectionId, driverId: r.driver_id ?? r.driverId, vehicleId: r.vehicle_id ?? r.vehicleId, category: r.category || 'other', severity: r.severity || 'low', description: r.description || '', status: r.status, resolutionNotes: r.resolution_notes || r.resolutionNotes || '', createdAt: r.created_at || r.createdAt, closedAt: r.closed_at || r.closedAt || null, photos: r.photos || [] };
}
function mapLoad(r) {
  return {
    id: r.id,
    companyId: r.company_id ?? r.companyId,
    loadNumber: r.load_number || r.loadNumber,
    loadType: r.load_type || r.loadType || 'dry_van',
    loadDetails: r.load_details || r.loadDetails || {},
    customer: r.customer || '',
    broker: r.broker || '',
    referenceNumber: r.reference_number || r.referenceNumber || '',
    pickupName: r.pickup_name || r.pickupName || '',
    pickupAddress: r.pickup_address || r.pickupAddress || '',
    pickupAppointment: r.pickup_appointment || r.pickupAppointment || '',
    pickupContactName: r.pickup_contact_name || r.pickupContactName || '',
    pickupPhone: r.pickup_phone || r.pickupPhone || '',
    pickupHours: r.pickup_hours || r.pickupHours || '',
    pickupDockType: r.pickup_dock_type || r.pickupDockType || '',
    pickupSiteNotes: r.pickup_site_notes || r.pickupSiteNotes || '',
    deliveryName: r.delivery_name || r.deliveryName || '',
    deliveryAddress: r.delivery_address || r.deliveryAddress || '',
    deliveryAppointment: r.delivery_appointment || r.deliveryAppointment || '',
    deliveryContactName: r.delivery_contact_name || r.deliveryContactName || '',
    deliveryPhone: r.delivery_phone || r.deliveryPhone || '',
    deliveryHours: r.delivery_hours || r.deliveryHours || '',
    deliveryDockType: r.delivery_dock_type || r.deliveryDockType || '',
    deliverySiteNotes: r.delivery_site_notes || r.deliverySiteNotes || '',
    commodity: r.commodity || '',
    weight: r.weight ?? 0,
    pieces: r.pieces ?? '',
    rate: r.rate ?? '',
    notes: r.notes || '',
    driverId: r.driver_id ?? r.driverId ?? null,
    vehicleId: r.vehicle_id ?? r.vehicleId ?? null,
    trailerId: r.trailer_id ?? r.trailerId ?? null,
    publicTrackingToken: r.public_tracking_token || r.publicTrackingToken || '',
    status: r.status || 'new',
    events: r.events || [],
    documents: r.documents || [],
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt
  };
}
function mapAddress(r) {
  return {
    id: r.id,
    companyId: r.company_id ?? r.companyId,
    customer: r.customer || '',
    name: r.name || '',
    address: r.address || '',
    type: r.type || 'both',
    contactName: r.contact_name || r.contactName || '',
    phone: r.phone || '',
    email: r.email || '',
    hours: r.hours || '',
    dockNotes: r.dock_notes || r.dockNotes || '',
    notes: r.notes || '',
    createdAt: r.created_at || r.createdAt,
    lastUsedAt: r.last_used_at || r.lastUsedAt || null
  };
}
function mapBugReport(r) {
  return {
    id: r.id,
    companyId: r.company_id ?? r.companyId,
    reporterUserId: r.reporter_user_id ?? r.reporterUserId ?? null,
    reporterName: r.reporter_name || r.reporterName || '',
    reporterRole: r.reporter_role || r.reporterRole || '',
    page: r.page || '',
    category: r.category || 'bug',
    priority: r.priority || 'normal',
    title: r.title || '',
    description: r.description || '',
    status: r.status || 'open',
    resolutionNotes: r.resolution_notes || r.resolutionNotes || '',
    photos: r.photos || [],
    createdAt: r.created_at || r.createdAt,
    closedAt: r.closed_at || r.closedAt || null
  };
}
function mapNotification(r) {
  return {
    id: r.id,
    companyId: r.company_id ?? r.companyId ?? null,
    userId: r.user_id ?? r.userId ?? null,
    audience: r.audience || 'staff',
    type: r.type || 'info',
    severity: r.severity || 'info',
    title: r.title || '',
    message: r.message || '',
    link: r.link || '',
    metadata: r.metadata || {},
    createdAt: r.created_at || r.createdAt,
    readAt: r.read_at || r.readAt || null
  };
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

async function syncPostgresSerialSequences() {
  if (!usePostgres) return;
  const tables = ['companies', 'users', 'drivers', 'vehicles', 'assignments', 'shifts', 'inspections', 'issues', 'loads', 'addresses', 'bug_reports', 'notifications', 'affiliates', 'affiliate_referrals'];
  for (const table of tables) {
    await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`);
  }
}

async function initPostgres() {
  const schema = `
  CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    billing_status TEXT NOT NULL DEFAULT 'active',
    billing_plan TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_current_period_end TIMESTAMPTZ,
    affiliate_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS affiliates (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company_name TEXT,
    promotion_url TEXT,
    promoter_type TEXT NOT NULL DEFAULT 'independent',
    payout_email TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    commission_rate NUMERIC NOT NULL DEFAULT 25,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS affiliate_referrals (
    id SERIAL PRIMARY KEY,
    affiliate_id INTEGER REFERENCES affiliates(id) ON DELETE SET NULL,
    affiliate_code TEXT NOT NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    company_name TEXT,
    plan TEXT,
    driver_quantity INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'signup_submitted',
    commission_rate NUMERIC NOT NULL DEFAULT 25,
    estimated_monthly_commission NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    tracking_enabled BOOLEAN NOT NULL DEFAULT false,
    location_history JSONB NOT NULL DEFAULT '[]'::jsonb
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
    image_key TEXT,
    category TEXT NOT NULL DEFAULT 'power_unit',
    length TEXT,
    max_weight INTEGER,
    temperature_capable BOOLEAN NOT NULL DEFAULT false,
    liftgate BOOLEAN NOT NULL DEFAULT false,
    hazmat_capable BOOLEAN NOT NULL DEFAULT false,
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
  );
  CREATE TABLE IF NOT EXISTS loads (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    load_number TEXT NOT NULL,
    load_type TEXT NOT NULL DEFAULT 'dry_van',
    load_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    customer TEXT,
    broker TEXT,
    reference_number TEXT,
    pickup_name TEXT,
    pickup_address TEXT,
    pickup_appointment TIMESTAMPTZ,
    pickup_contact_name TEXT,
    pickup_phone TEXT,
    pickup_hours TEXT,
    pickup_dock_type TEXT,
    pickup_site_notes TEXT,
    delivery_name TEXT,
    delivery_address TEXT,
    delivery_appointment TIMESTAMPTZ,
    delivery_contact_name TEXT,
    delivery_phone TEXT,
    delivery_hours TEXT,
    delivery_dock_type TEXT,
    delivery_site_notes TEXT,
    commodity TEXT,
    weight INTEGER DEFAULT 0,
    pieces TEXT,
    rate TEXT,
    notes TEXT,
    driver_id INTEGER,
    vehicle_id INTEGER,
    trailer_id INTEGER,
    public_tracking_token TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer TEXT,
    name TEXT,
    address TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'both',
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    hours TEXT,
    dock_notes TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS bug_reports (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    reporter_user_id INTEGER,
    reporter_name TEXT,
    reporter_role TEXT,
    page TEXT,
    category TEXT,
    priority TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    resolution_notes TEXT,
    photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    audience TEXT NOT NULL DEFAULT 'staff',
    type TEXT NOT NULL DEFAULT 'info',
    severity TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT,
    link TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
  );`;
  await pool.query(schema);
  await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION`);
  await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'active'`);
  await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS billing_plan TEXT`);
  await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`);
  await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`);
  await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS affiliate_code TEXT`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS affiliates_code_unique ON affiliates (lower(code))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS affiliate_referrals_code_idx ON affiliate_referrals (lower(affiliate_code))`);
  await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION`);
  await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS location_history JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS pickup_contact_name TEXT`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS pickup_phone TEXT`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS pickup_hours TEXT`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS pickup_dock_type TEXT`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS pickup_site_notes TEXT`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS delivery_contact_name TEXT`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS delivery_phone TEXT`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS delivery_hours TEXT`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS delivery_dock_type TEXT`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS delivery_site_notes TEXT`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS load_type TEXT NOT NULL DEFAULT 'dry_van'`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS load_details JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE loads ADD COLUMN IF NOT EXISTS public_tracking_token TEXT`);
  await pool.query(`UPDATE loads SET public_tracking_token = md5(id::text || random()::text || clock_timestamp()::text) WHERE public_tracking_token IS NULL OR public_tracking_token = ''`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS loads_public_tracking_token_unique ON loads (public_tracking_token)`);
  await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'power_unit'`);
  await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS image_key TEXT`);
  await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS length TEXT`);
  await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS max_weight INTEGER`);
  await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS temperature_capable BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS liftgate BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS hazmat_capable BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS customer TEXT`);
  await pool.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS signature_name TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS signature_data_url TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE inspections ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS contact_name TEXT`);
  await pool.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS phone TEXT`);
  await pool.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS email TEXT`);
  await pool.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS hours TEXT`);
  await pool.query(`ALTER TABLE addresses ADD COLUMN IF NOT EXISTS dock_notes TEXT`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS addresses_company_address_unique ON addresses (company_id, lower(address))`);

  const companyCount = Number((await pool.query('SELECT COUNT(*) FROM companies')).rows[0].count);
  if (!companyCount) {
    await pool.query(`INSERT INTO companies (id,name,code,status,created_at) VALUES ($1,$2,$3,$4,$5)`, [seedCompany.id, seedCompany.name, seedCompany.code, seedCompany.status, seedCompany.createdAt]);
    for (const d of seed.drivers) {
      await pool.query(`INSERT INTO drivers (id,company_id,first_name,last_name,phone,email,license_number,license_class,license_expiry,status,last_lat,last_lng,last_seen_at,tracking_enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [d.id,d.companyId,d.firstName,d.lastName,d.phone,d.email,d.licenseNumber,d.licenseClass,d.licenseExpiry,d.status,d.lastLat||null,d.lastLng||null,d.lastSeenAt||null,d.trackingEnabled||false]);
    }
    for (const v of seed.vehicles) {
      await pool.query(`INSERT INTO vehicles (id,company_id,unit_number,plate_number,vin,make,model,year,type,image_key,category,length,max_weight,temperature_capable,liftgate,hazmat_capable,odometer,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, [v.id,v.companyId,v.unitNumber,v.plateNumber,v.vin,v.make,v.model,v.year,v.type,v.imageKey || v.type || '',v.category || 'power_unit',v.length || '',v.maxWeight || null,!!v.temperatureCapable,!!v.liftgate,!!v.hazmatCapable,v.odometer,v.status]);
    }
    for (const a of seed.assignments) {
      await pool.query(`INSERT INTO assignments (id,company_id,driver_id,vehicle_id,active,assigned_at,unassigned_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [a.id,a.companyId,a.driverId,a.vehicleId,a.active,a.assignedAt,a.unassignedAt]);
    }
    for (const i of seed.issues) {
      await pool.query(`INSERT INTO issues (id,company_id,shift_id,inspection_id,driver_id,vehicle_id,category,severity,description,status,resolution_notes,created_at,closed_at,photos) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`, [i.id,i.companyId,i.shiftId,i.inspectionId,i.driverId,i.vehicleId,i.category,i.severity,i.description,i.status,i.resolutionNotes,i.createdAt,i.closedAt,JSON.stringify(i.photos)]);
    }
  }
  const companiesForCodes = (await pool.query('SELECT id,name,code FROM companies ORDER BY id')).rows;
  const usedCompanyCodes = new Set();
  for (const company of companiesForCodes) {
    const base = normalizeCompanyCode(company.code || generatedCompanyCode(company.name, company.id));
    let code = base;
    let suffix = 1;
    while (usedCompanyCodes.has(code)) {
      code = `${base.slice(0, 6)}${String(suffix).padStart(2, '0')}`.slice(0, 8);
      suffix += 1;
    }
    if (company.code !== code) await pool.query('UPDATE companies SET code=$2 WHERE id=$1', [company.id, code]);
    usedCompanyCodes.add(code);
  }
  await syncPostgresSerialSequences();
  await ensureSuperUser();
  await syncPostgresSerialSequences();
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
  normalizeLocationHistory(history = [], latest = null) {
    const points = Array.isArray(history) ? history : [];
    const normalized = points.map(point => ({
      lat: Number(point.lat),
      lng: Number(point.lng),
      accuracy: point.accuracy == null ? null : Number(point.accuracy),
      timestamp: point.timestamp || new Date().toISOString()
    })).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    if (latest && Number.isFinite(latest.lat) && Number.isFinite(latest.lng)) normalized.push(latest);
    const deduped = [];
    for (const point of normalized) {
      const previous = deduped[deduped.length - 1];
      if (previous && previous.lat === point.lat && previous.lng === point.lng && previous.timestamp === point.timestamp) continue;
      deduped.push(point);
    }
    return deduped.slice(-100);
  },
  buildLoadEvent(status, note = '', user = null) {
    return {
      status,
      note: note || '',
      userId: user?.id || null,
      userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : '',
      at: new Date().toISOString()
    };
  },
  addressesFromLoads(loads = []) {
    const seen = new Map();
    for (const load of loads) {
      for (const [type, nameKey, addressKey] of [['pickup', 'pickupName', 'pickupAddress'], ['delivery', 'deliveryName', 'deliveryAddress']]) {
        const address = String(load[addressKey] || '').trim();
        if (!address) continue;
        const key = address.toLowerCase();
        const existing = seen.get(key);
        if (existing) {
          existing.type = existing.type === type ? type : 'both';
          continue;
        }
        seen.set(key, {
          id: `load-${seen.size + 1}`,
          companyId: load.companyId,
          customer: String(load.customer || '').trim(),
          name: String(load[nameKey] || '').trim(),
          address,
          type,
          contactName: '',
          phone: '',
          email: '',
          hours: '',
          dockNotes: '',
          notes: '',
          createdAt: load.createdAt || load.updatedAt || null,
          lastUsedAt: load.updatedAt || load.createdAt || null
        });
      }
    }
    return [...seen.values()];
  }
};

const fileDb = {
  async init() { ensureFileDb(); await ensureSuperUser(); },
  async hasAdminSetup() { return readFileDb().users.some(u => u.role === 'super_user'); },
  async getCompanies() { return readFileDb().companies; },
  async createCompany(data) {
    const db = readFileDb();
    const id = nextId(db.companies);
    let code = normalizeCompanyCode(data.code || generatedCompanyCode(data.name, id));
    let suffix = 1;
    while (db.companies.some(company => normalizeCompanyCode(company.code) === code)) {
      code = `${code.slice(0, 6)}${String(suffix).padStart(2, '0')}`.slice(0, 8);
      suffix += 1;
    }
    const company = { id, name: data.name, code, status: data.status || 'active', billingStatus: data.billingStatus || 'active', billingPlan: data.billingPlan || '', stripeCustomerId: data.stripeCustomerId || '', stripeSubscriptionId: data.stripeSubscriptionId || '', subscriptionCurrentPeriodEnd: data.subscriptionCurrentPeriodEnd || null, affiliateCode: data.affiliateCode || '', createdAt: new Date().toISOString() };
    db.companies.push(company);
    writeFileDb(db);
    return company;
  },
  async getAffiliates() { return readFileDb().affiliates.map(mapAffiliate); },
  async findAffiliateByCode(code) {
    const normalized = String(code || '').trim().toUpperCase();
    const found = readFileDb().affiliates.find(item => String(item.code || '').toUpperCase() === normalized);
    return found ? mapAffiliate(found) : null;
  },
  async createAffiliate(data) {
    const db = readFileDb();
    let code = String(data.code || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 16);
    if (!code) {
      const base = String(`${data.firstName || ''}${data.lastName || ''}` || data.companyName || 'PARTNER').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'PARTNER';
      code = base;
    }
    let nextCode = code;
    let suffix = 1;
    while (db.affiliates.some(item => String(item.code || '').toUpperCase() === nextCode)) {
      nextCode = `${code.slice(0, 12)}${String(suffix).padStart(2, '0')}`.slice(0, 16);
      suffix += 1;
    }
    const affiliate = {
      id: nextId(db.affiliates),
      code: nextCode,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: String(data.email || '').toLowerCase(),
      phone: data.phone || '',
      companyName: data.companyName || '',
      promotionUrl: data.promotionUrl || '',
      promoterType: data.promoterType || 'independent',
      payoutEmail: data.payoutEmail || data.email || '',
      notes: data.notes || '',
      status: data.status || 'active',
      commissionRate: Number(data.commissionRate || 25),
      createdAt: new Date().toISOString()
    };
    db.affiliates.push(affiliate);
    writeFileDb(db);
    return mapAffiliate(affiliate);
  },
  async getAffiliateReferrals() { return readFileDb().affiliateReferrals.map(mapAffiliateReferral); },
  async createAffiliateReferral(data) {
    const db = readFileDb();
    const existing = db.affiliateReferrals.find(item => Number(item.companyId) === Number(data.companyId) && String(item.affiliateCode || '').toUpperCase() === String(data.affiliateCode || '').toUpperCase());
    if (existing) return mapAffiliateReferral(existing);
    const referral = {
      id: nextId(db.affiliateReferrals),
      affiliateId: data.affiliateId || null,
      affiliateCode: String(data.affiliateCode || '').toUpperCase(),
      companyId: data.companyId || null,
      companyName: data.companyName || '',
      plan: data.plan || '',
      driverQuantity: Number(data.driverQuantity || 0),
      status: data.status || 'signup_submitted',
      commissionRate: Number(data.commissionRate || 25),
      estimatedMonthlyCommission: Number(data.estimatedMonthlyCommission || 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.affiliateReferrals.push(referral);
    writeFileDb(db);
    return mapAffiliateReferral(referral);
  },
  async updateCompanyStatus(id, status) {
    const db = readFileDb();
    const company = db.companies.find(c => Number(c.id) === Number(id));
    if (!company) throw new Error('Company not found.');
    company.status = status || company.status;
    if (status === 'active') {
      for (const user of db.users) {
        if (Number(user.companyId) === Number(id) && user.role === 'admin') user.isActive = true;
      }
    }
    writeFileDb(db);
    return mapCompany(company);
  },
  async updateCompanyBilling(id, payload = {}) {
    const db = readFileDb();
    const company = db.companies.find(c => Number(c.id) === Number(id));
    if (!company) throw new Error('Company not found.');
    if (payload.billingStatus !== undefined) company.billingStatus = payload.billingStatus || company.billingStatus || 'active';
    if (payload.billingPlan !== undefined) company.billingPlan = payload.billingPlan || '';
    if (payload.stripeCustomerId !== undefined) company.stripeCustomerId = payload.stripeCustomerId || '';
    if (payload.stripeSubscriptionId !== undefined) company.stripeSubscriptionId = payload.stripeSubscriptionId || '';
    if (payload.subscriptionCurrentPeriodEnd !== undefined) company.subscriptionCurrentPeriodEnd = payload.subscriptionCurrentPeriodEnd || null;
    writeFileDb(db);
    return mapCompany(company);
  },
  async getUsers(companyId) {
    return readFileDb().users.filter(u => companyId ? Number(u.companyId) === Number(companyId) : true).map(safeUser);
  },
  async createUser(data) {
    const db = readFileDb();
    const email = String(data.email || '').toLowerCase();
    if (!email) throw new Error('Email is required.');
    if (db.users.some(user => String(user.email || '').toLowerCase() === email)) throw new Error('An account with this email already exists.');
    const user = { id: nextId(db.users), companyId: data.companyId || null, email, passwordHash: hashPassword(data.password), role: data.role, linkedDriverId: data.linkedDriverId || null, firstName: data.firstName || '', lastName: data.lastName || '', isActive: data.isActive !== false };
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
      const email = String(data.email || '').toLowerCase();
      if (!email) throw new Error('Driver email is required to create a login.');
      if (db.users.some(user => String(user.email || '').toLowerCase() === email)) throw new Error('An account with this email already exists.');
      db.users.push({ id: nextId(db.users), companyId, email, passwordHash: hashPassword(data.userPassword), role: 'driver', linkedDriverId: driver.id, firstName: data.firstName, lastName: data.lastName, isActive: true });
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
    if (!db.drivers.find(d => Number(d.companyId) === Number(companyId) && Number(d.id) === Number(driverId))) throw new Error('Driver not found.');
    if (!db.vehicles.find(v => Number(v.companyId) === Number(companyId) && Number(v.id) === Number(vehicleId))) throw new Error('Vehicle not found.');
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
    if (!driverId) throw new Error('Driver is required.');
    if (!vehicleId) throw new Error('Vehicle is required.');
    const assignment = db.assignments.find(a => Number(a.companyId) === Number(companyId) && Number(a.driverId) === Number(driverId) && Number(a.vehicleId) === Number(vehicleId) && a.active);
    if (!assignment) throw new Error('Driver is not assigned to this vehicle.');
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
    if (!db.drivers.find(d => Number(d.companyId) === Number(companyId) && Number(d.id) === Number(payload.driverId))) throw new Error('Driver not found.');
    if (!db.vehicles.find(v => Number(v.companyId) === Number(companyId) && Number(v.id) === Number(payload.vehicleId))) throw new Error('Vehicle not found.');
    const inspection = { id: nextId(db.inspections), companyId, ...payload, inspectionTime: new Date().toISOString(), signedAt: payload.signedAt || new Date().toISOString() };
    db.inspections.push(inspection);
    writeFileDb(db);
    return inspection;
  },
  async getIssues(companyId) { return readFileDb().issues.filter(i => Number(i.companyId) === Number(companyId)); },
  async createIssue(companyId, payload) {
    const db = readFileDb();
    if (payload.driverId && !db.drivers.find(d => Number(d.companyId) === Number(companyId) && Number(d.id) === Number(payload.driverId))) throw new Error('Driver not found.');
    if (payload.vehicleId && !db.vehicles.find(v => Number(v.companyId) === Number(companyId) && Number(v.id) === Number(payload.vehicleId))) throw new Error('Vehicle not found.');
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
  async updateDriverLocation(companyId, driverId, lat, lng, trackingEnabled = true, history = []) {
    const db = readFileDb();
    const driver = db.drivers.find(d => Number(d.companyId) === Number(companyId) && Number(d.id) === Number(driverId));
    if (!driver) throw new Error('Driver not found.');
    driver.lastLat = Number(lat);
    driver.lastLng = Number(lng);
    driver.lastSeenAt = new Date().toISOString();
    driver.trackingEnabled = !!trackingEnabled;
    driver.locationHistory = commonMethods.normalizeLocationHistory([...(driver.locationHistory || []), ...history], {
      lat: driver.lastLat,
      lng: driver.lastLng,
      accuracy: history?.[history.length - 1]?.accuracy ?? null,
      timestamp: driver.lastSeenAt
    });
    writeFileDb(db);
    return driver;
  },
  async getAddresses(companyId) {
    const db = readFileDb();
    const saved = db.addresses.filter(a => Number(a.companyId) === Number(companyId)).map(mapAddress);
    const byAddress = new Map(saved.map(a => [String(a.address || '').toLowerCase(), a]));
    for (const derived of commonMethods.addressesFromLoads(db.loads.filter(l => Number(l.companyId) === Number(companyId)))) {
      const key = String(derived.address || '').toLowerCase();
      if (!byAddress.has(key)) byAddress.set(key, derived);
    }
    return [...byAddress.values()].sort((a, b) => String(b.lastUsedAt || b.createdAt || '').localeCompare(String(a.lastUsedAt || a.createdAt || '')));
  },
  async upsertAddress(companyId, payload) {
    const address = String(payload.address || '').trim();
    if (!address) return null;
    const db = readFileDb();
    const existing = db.addresses.find(a => Number(a.companyId) === Number(companyId) && String(a.address || '').toLowerCase() === address.toLowerCase());
    if (existing) {
      existing.customer = String(payload.customer || existing.customer || '').trim();
      existing.name = String(payload.name || existing.name || '').trim();
      existing.type = payload.type || existing.type || 'both';
      existing.contactName = String(payload.contactName || existing.contactName || '').trim();
      existing.phone = String(payload.phone || existing.phone || '').trim();
      existing.email = String(payload.email || existing.email || '').trim();
      existing.hours = String(payload.hours || existing.hours || '').trim();
      existing.dockNotes = String(payload.dockNotes || existing.dockNotes || '').trim();
      existing.notes = payload.notes || existing.notes || '';
      existing.lastUsedAt = new Date().toISOString();
      writeFileDb(db);
      return mapAddress(existing);
    }
    const item = {
      id: nextId(db.addresses),
      companyId,
      customer: String(payload.customer || '').trim(),
      name: String(payload.name || '').trim(),
      address,
      type: payload.type || 'both',
      contactName: String(payload.contactName || '').trim(),
      phone: String(payload.phone || '').trim(),
      email: String(payload.email || '').trim(),
      hours: String(payload.hours || '').trim(),
      dockNotes: String(payload.dockNotes || '').trim(),
      notes: payload.notes || '',
      createdAt: new Date().toISOString(),
      lastUsedAt: payload.lastUsedAt || null
    };
    db.addresses.push(item);
    writeFileDb(db);
    return mapAddress(item);
  },
  async getLoads(companyId) { return readFileDb().loads.filter(l => Number(l.companyId) === Number(companyId)).map(mapLoad).sort((a, b) => Number(b.id) - Number(a.id)); },
  async createLoad(companyId, payload, user) {
    const db = readFileDb();
    if (payload.driverId && !db.drivers.find(d => Number(d.companyId) === Number(companyId) && Number(d.id) === Number(payload.driverId))) throw new Error('Driver not found.');
    if (payload.vehicleId && !db.vehicles.find(v => Number(v.companyId) === Number(companyId) && Number(v.id) === Number(payload.vehicleId))) throw new Error('Power unit not found.');
    if (payload.trailerId && !db.vehicles.find(v => Number(v.companyId) === Number(companyId) && Number(v.id) === Number(payload.trailerId))) throw new Error('Trailer/equipment not found.');
    const status = payload.driverId ? 'assigned' : 'new';
    const company = db.companies.find(c => Number(c.id) === Number(companyId));
    const loadNumber = ensureCompanyLoadNumber(company, db.loads, payload.loadNumber);
    const load = { id: nextId(db.loads), companyId, ...payload, loadNumber, publicTrackingToken: makeTrackingToken(), status, events: [commonMethods.buildLoadEvent(status, 'Load created', user)], documents: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    db.loads.push(load);
    writeFileDb(db);
    await this.upsertAddress(companyId, { customer: payload.customer, name: payload.pickupName, address: payload.pickupAddress, type: 'pickup', contactName: payload.pickupContactName, phone: payload.pickupPhone, hours: payload.pickupHours, dockNotes: [payload.pickupDockType, payload.pickupSiteNotes].filter(Boolean).join(' - '), lastUsedAt: new Date().toISOString() });
    await this.upsertAddress(companyId, { customer: payload.customer, name: payload.deliveryName, address: payload.deliveryAddress, type: 'delivery', contactName: payload.deliveryContactName, phone: payload.deliveryPhone, hours: payload.deliveryHours, dockNotes: [payload.deliveryDockType, payload.deliverySiteNotes].filter(Boolean).join(' - '), lastUsedAt: new Date().toISOString() });
    return mapLoad(load);
  },
  async getPublicLoadByToken(token) {
    const normalized = String(token || '').trim();
    if (!normalized) return null;
    const load = readFileDb().loads.find(l => l.publicTrackingToken === normalized || String(l.loadNumber || '').toLowerCase() === normalized.toLowerCase());
    return load ? mapLoad(load) : null;
  },
  async updateLoadStatus(companyId, id, status, note, user) {
    const db = readFileDb();
    const load = db.loads.find(l => Number(l.companyId) === Number(companyId) && Number(l.id) === Number(id));
    if (!load) throw new Error('Load not found.');
    load.status = status || load.status;
    load.updatedAt = new Date().toISOString();
    load.events = [...(load.events || []), commonMethods.buildLoadEvent(load.status, note, user)];
    writeFileDb(db);
    return mapLoad(load);
  },
  async updateLoadAssignment(companyId, id, payload, user) {
    const db = readFileDb();
    const load = db.loads.find(l => Number(l.companyId) === Number(companyId) && Number(l.id) === Number(id));
    if (!load) throw new Error('Load not found.');
    load.driverId = payload.driverId || null;
    load.vehicleId = payload.vehicleId || null;
    load.trailerId = payload.trailerId || null;
    if (load.driverId && !['accepted', 'en_route_pickup', 'at_pickup', 'picked_up', 'in_transit', 'at_delivery', 'delivered', 'pod_uploaded', 'closed'].includes(load.status)) load.status = 'assigned';
    load.updatedAt = new Date().toISOString();
    load.events = [...(load.events || []), commonMethods.buildLoadEvent(load.status, load.driverId ? 'Load assigned from dispatch board' : 'Load moved to unassigned queue', user)];
    writeFileDb(db);
    return mapLoad(load);
  },
  async addLoadDocument(companyId, id, document, user) {
    const db = readFileDb();
    const load = db.loads.find(l => Number(l.companyId) === Number(companyId) && Number(l.id) === Number(id));
    if (!load) throw new Error('Load not found.');
    const doc = { ...document, uploadedBy: user?.id || null, uploadedAt: new Date().toISOString() };
    load.documents = [...(load.documents || []), doc];
    load.updatedAt = new Date().toISOString();
    load.events = [...(load.events || []), commonMethods.buildLoadEvent(load.status, `${document.type || 'document'} uploaded`, user)];
    writeFileDb(db);
    return mapLoad(load);
  },
  async updateLoadPublicSettings(companyId, id, settings) {
    const db = readFileDb();
    const load = db.loads.find(l => Number(l.companyId) === Number(companyId) && Number(l.id) === Number(id));
    if (!load) throw new Error('Load not found.');
    load.loadDetails = { ...(load.loadDetails || {}), ...settings };
    load.updatedAt = new Date().toISOString();
    writeFileDb(db);
    return mapLoad(load);
  },
  async getBugReports(companyId) { return readFileDb().bugReports.filter(r => !companyId || Number(r.companyId) === Number(companyId)).map(mapBugReport).sort((a, b) => Number(b.id) - Number(a.id)); },
  async createBugReport(companyId, payload, user) {
    const db = readFileDb();
    const report = {
      id: nextId(db.bugReports),
      companyId,
      reporterUserId: user?.id || null,
      reporterName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : '',
      reporterRole: user?.role || '',
      page: payload.page || '',
      category: payload.category || 'bug',
      priority: payload.priority || 'normal',
      title: payload.title,
      description: payload.description || '',
      status: 'open',
      resolutionNotes: '',
      photos: payload.photos || [],
      createdAt: new Date().toISOString(),
      closedAt: null
    };
    db.bugReports.push(report);
    writeFileDb(db);
    return mapBugReport(report);
  },
  async updateBugReport(companyId, id, status, resolutionNotes) {
    const db = readFileDb();
    const report = db.bugReports.find(r => Number(r.id) === Number(id) && (!companyId || Number(r.companyId) === Number(companyId)));
    if (!report) throw new Error('Bug report not found.');
    report.status = status || report.status;
    report.resolutionNotes = resolutionNotes || report.resolutionNotes || '';
    if (report.status === 'closed') report.closedAt = new Date().toISOString();
    writeFileDb(db);
    return mapBugReport(report);
  },
  async getNotifications(companyId, user) {
    const role = user?.role || 'staff';
    return readFileDb().notifications
      .filter(item => {
        if (item.companyId && companyId && Number(item.companyId) !== Number(companyId)) return false;
        if (item.companyId && !companyId && role !== 'super_user') return false;
        if (item.userId && Number(item.userId) !== Number(user?.id)) return false;
        if (role === 'super_user') return true;
        if (role === 'driver') return ['driver', 'all'].includes(item.audience);
        if (role === 'admin') return ['admin', 'staff', 'dispatcher', 'all'].includes(item.audience);
        return ['staff', 'dispatcher', 'all'].includes(item.audience);
      })
      .map(mapNotification)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 100);
  },
  async createNotification(companyId, payload) {
    const db = readFileDb();
    const notification = {
      id: nextId(db.notifications),
      companyId: companyId || null,
      userId: payload.userId || null,
      audience: payload.audience || 'staff',
      type: payload.type || 'info',
      severity: payload.severity || 'info',
      title: payload.title,
      message: payload.message || '',
      link: payload.link || '',
      metadata: payload.metadata || {},
      createdAt: new Date().toISOString(),
      readAt: null
    };
    db.notifications.push(notification);
    writeFileDb(db);
    return mapNotification(notification);
  },
  async markNotificationRead(companyId, id, user) {
    const db = readFileDb();
    const notification = db.notifications.find(item => Number(item.id) === Number(id) && (!item.companyId || !companyId || Number(item.companyId) === Number(companyId)));
    if (!notification) throw new Error('Notification not found.');
    if (notification.userId && Number(notification.userId) !== Number(user?.id)) throw new Error('Notification not found.');
    notification.readAt = new Date().toISOString();
    writeFileDb(db);
    return mapNotification(notification);
  },
  ...commonMethods
};

const pgDb = {
  async init() { await initPostgres(); },
  async hasAdminSetup() { const r = await pool.query(`SELECT COUNT(*) FROM users WHERE role='super_user' AND is_active=true`); return Number(r.rows[0].count) > 0; },
  async getCompanies() { const r = await pool.query('SELECT * FROM companies ORDER BY name'); return r.rows.map(mapCompany); },
  async createCompany(data) {
    const idRow = await pool.query(`SELECT nextval(pg_get_serial_sequence('companies','id')) AS id`);
    const id = Number(idRow.rows[0].id);
    let code = normalizeCompanyCode(data.code || generatedCompanyCode(data.name, id));
    let suffix = 1;
    while ((await pool.query('SELECT id FROM companies WHERE code=$1 LIMIT 1', [code])).rows[0]) {
      code = `${code.slice(0, 6)}${String(suffix).padStart(2, '0')}`.slice(0, 8);
      suffix += 1;
    }
    const r = await pool.query(`INSERT INTO companies (id,name,code,status,billing_status,billing_plan,stripe_customer_id,stripe_subscription_id,subscription_current_period_end,affiliate_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [id, data.name, code, data.status || 'active', data.billingStatus || 'active', data.billingPlan || '', data.stripeCustomerId || '', data.stripeSubscriptionId || '', data.subscriptionCurrentPeriodEnd || null, data.affiliateCode || '']);
    return mapCompany(r.rows[0]);
  },
  async getAffiliates() {
    const r = await pool.query('SELECT * FROM affiliates ORDER BY created_at DESC');
    return r.rows.map(mapAffiliate);
  },
  async findAffiliateByCode(code) {
    const r = await pool.query('SELECT * FROM affiliates WHERE lower(code)=lower($1) LIMIT 1', [String(code || '').trim()]);
    return r.rows[0] ? mapAffiliate(r.rows[0]) : null;
  },
  async createAffiliate(data) {
    let code = String(data.code || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 16);
    if (!code) {
      code = String(`${data.firstName || ''}${data.lastName || ''}` || data.companyName || 'PARTNER').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'PARTNER';
    }
    let nextCode = code;
    let suffix = 1;
    while ((await pool.query('SELECT id FROM affiliates WHERE lower(code)=lower($1) LIMIT 1', [nextCode])).rows[0]) {
      nextCode = `${code.slice(0, 12)}${String(suffix).padStart(2, '0')}`.slice(0, 16);
      suffix += 1;
    }
    const r = await pool.query(
      `INSERT INTO affiliates (code,first_name,last_name,email,phone,company_name,promotion_url,promoter_type,payout_email,notes,status,commission_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [nextCode, data.firstName || '', data.lastName || '', String(data.email || '').toLowerCase(), data.phone || '', data.companyName || '', data.promotionUrl || '', data.promoterType || 'independent', data.payoutEmail || data.email || '', data.notes || '', data.status || 'active', Number(data.commissionRate || 25)]
    );
    return mapAffiliate(r.rows[0]);
  },
  async getAffiliateReferrals() {
    const r = await pool.query('SELECT * FROM affiliate_referrals ORDER BY created_at DESC');
    return r.rows.map(mapAffiliateReferral);
  },
  async createAffiliateReferral(data) {
    const existing = await pool.query('SELECT * FROM affiliate_referrals WHERE company_id=$1 AND lower(affiliate_code)=lower($2) LIMIT 1', [data.companyId || null, data.affiliateCode || '']);
    if (existing.rows[0]) return mapAffiliateReferral(existing.rows[0]);
    const r = await pool.query(
      `INSERT INTO affiliate_referrals (affiliate_id,affiliate_code,company_id,company_name,plan,driver_quantity,status,commission_rate,estimated_monthly_commission)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.affiliateId || null, String(data.affiliateCode || '').toUpperCase(), data.companyId || null, data.companyName || '', data.plan || '', Number(data.driverQuantity || 0), data.status || 'signup_submitted', Number(data.commissionRate || 25), Number(data.estimatedMonthlyCommission || 0)]
    );
    return mapAffiliateReferral(r.rows[0]);
  },
  async updateCompanyStatus(id, status) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query('UPDATE companies SET status=$2 WHERE id=$1 RETURNING *', [id, status]);
      if (!r.rows[0]) throw new Error('Company not found.');
      if (status === 'active') {
        await client.query(`UPDATE users SET is_active=true WHERE company_id=$1 AND role='admin'`, [id]);
      }
      await client.query('COMMIT');
      return mapCompany(r.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  },
  async updateCompanyBilling(id, payload = {}) {
    const r = await pool.query(
      `UPDATE companies
       SET billing_status=COALESCE($2,billing_status),
           billing_plan=COALESCE($3,billing_plan),
           stripe_customer_id=COALESCE($4,stripe_customer_id),
           stripe_subscription_id=COALESCE($5,stripe_subscription_id),
           subscription_current_period_end=COALESCE($6,subscription_current_period_end)
       WHERE id=$1 RETURNING *`,
      [id, payload.billingStatus ?? null, payload.billingPlan ?? null, payload.stripeCustomerId ?? null, payload.stripeSubscriptionId ?? null, payload.subscriptionCurrentPeriodEnd ?? null]
    );
    if (!r.rows[0]) throw new Error('Company not found.');
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
    const r = await pool.query(`INSERT INTO users (company_id,email,password_hash,role,linked_driver_id,first_name,last_name,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,company_id,email,role,linked_driver_id,first_name,last_name,is_active`, [data.companyId || null, String(data.email).toLowerCase(), hashPassword(data.password), data.role, data.linkedDriverId || null, data.firstName || '', data.lastName || '', data.isActive !== false]);
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
  async createVehicle(companyId, data) { const r = await pool.query(`INSERT INTO vehicles (company_id,unit_number,plate_number,vin,make,model,year,type,image_key,category,length,max_weight,temperature_capable,liftgate,hazmat_capable,odometer,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`, [companyId, data.unitNumber, data.plateNumber || '', data.vin || '', data.make || '', data.model || '', data.year || null, data.type || 'tractor', data.imageKey || data.type || '', data.category || 'power_unit', data.length || '', data.maxWeight || null, !!data.temperatureCapable, !!data.liftgate, !!data.hazmatCapable, data.odometer || 0, data.status || 'active']); return mapVehicle(r.rows[0]); },
  async getAssignments(companyId) { const r = await pool.query('SELECT * FROM assignments WHERE company_id=$1 ORDER BY id DESC', [companyId]); return r.rows.map(mapAssignment); },
  async assignVehicle(companyId, driverId, vehicleId) {
    const driver = await pool.query('SELECT id FROM drivers WHERE company_id=$1 AND id=$2', [companyId, driverId]);
    if (!driver.rows[0]) throw new Error('Driver not found.');
    const vehicle = await pool.query('SELECT id FROM vehicles WHERE company_id=$1 AND id=$2', [companyId, vehicleId]);
    if (!vehicle.rows[0]) throw new Error('Vehicle not found.');
    await pool.query('UPDATE assignments SET active=false, unassigned_at=NOW() WHERE company_id=$1 AND driver_id=$2 AND active=true', [companyId, driverId]);
    const r = await pool.query('INSERT INTO assignments (company_id,driver_id,vehicle_id,active,assigned_at) VALUES ($1,$2,$3,true,NOW()) RETURNING *', [companyId, driverId, vehicleId]);
    return mapAssignment(r.rows[0]);
  },
  async getShifts(companyId) { const r = await pool.query('SELECT * FROM shifts WHERE company_id=$1 ORDER BY id DESC', [companyId]); return r.rows.map(mapShift); },
  async getActiveShiftForDriver(companyId, driverId) { const r = await pool.query('SELECT * FROM shifts WHERE company_id=$1 AND driver_id=$2 AND status=$3 ORDER BY id DESC LIMIT 1', [companyId, driverId, 'started']); return r.rows[0] ? mapShift(r.rows[0]) : null; },
  async startShift(companyId, driverId, vehicleId, startOdometer) {
    if (!driverId) throw new Error('Driver is required.');
    if (!vehicleId) throw new Error('Vehicle is required.');
    const assignment = await pool.query('SELECT id FROM assignments WHERE company_id=$1 AND driver_id=$2 AND vehicle_id=$3 AND active=true LIMIT 1', [companyId, driverId, vehicleId]);
    if (!assignment.rows[0]) throw new Error('Driver is not assigned to this vehicle.');
    const existing = await this.getActiveShiftForDriver(companyId, driverId);
    if (existing) throw new Error('Driver already has an active shift.');
    const r = await pool.query('INSERT INTO shifts (company_id,driver_id,vehicle_id,start_time,start_odometer,status) VALUES ($1,$2,$3,NOW(),$4,$5) RETURNING *', [companyId, driverId, vehicleId, startOdometer || 0, 'started']);
    return mapShift(r.rows[0]);
  },
  async endShift(companyId, shiftId, endOdometer) { const r = await pool.query('UPDATE shifts SET end_time=NOW(), end_odometer=$3, status=$4 WHERE company_id=$1 AND id=$2 RETURNING *', [companyId, shiftId, endOdometer || null, 'completed']); if (!r.rows[0]) throw new Error('Shift not found.'); return mapShift(r.rows[0]); },
  async getInspections(companyId) { const r = await pool.query('SELECT * FROM inspections WHERE company_id=$1 ORDER BY id DESC', [companyId]); return r.rows.map(mapInspection); },
  async createInspection(companyId, payload) {
    const driver = await pool.query('SELECT id FROM drivers WHERE company_id=$1 AND id=$2', [companyId, payload.driverId]);
    if (!driver.rows[0]) throw new Error('Driver not found.');
    const vehicle = await pool.query('SELECT id FROM vehicles WHERE company_id=$1 AND id=$2', [companyId, payload.vehicleId]);
    if (!vehicle.rows[0]) throw new Error('Vehicle not found.');
    const r = await pool.query(`INSERT INTO inspections (company_id,shift_id,driver_id,vehicle_id,inspection_time,odometer,overall_status,notes,item_results,photos,signature_name,signature_data_url,signed_at) VALUES ($1,$2,$3,$4,NOW(),$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,NOW()) RETURNING *`, [companyId, payload.shiftId || null, payload.driverId, payload.vehicleId, payload.odometer || 0, payload.overallStatus || 'pass', payload.notes || '', JSON.stringify(payload.itemResults || []), JSON.stringify(payload.photos || []), payload.signatureName || '', payload.signatureDataUrl || '']);
    return mapInspection(r.rows[0]);
  },
  async getIssues(companyId) { const r = await pool.query('SELECT * FROM issues WHERE company_id=$1 ORDER BY id DESC', [companyId]); return r.rows.map(mapIssue); },
  async createIssue(companyId, payload) {
    if (payload.driverId) {
      const driver = await pool.query('SELECT id FROM drivers WHERE company_id=$1 AND id=$2', [companyId, payload.driverId]);
      if (!driver.rows[0]) throw new Error('Driver not found.');
    }
    if (payload.vehicleId) {
      const vehicle = await pool.query('SELECT id FROM vehicles WHERE company_id=$1 AND id=$2', [companyId, payload.vehicleId]);
      if (!vehicle.rows[0]) throw new Error('Vehicle not found.');
    }
    const r = await pool.query(`INSERT INTO issues (company_id,shift_id,inspection_id,driver_id,vehicle_id,category,severity,description,status,resolution_notes,created_at,photos) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11::jsonb) RETURNING *`, [companyId, payload.shiftId || null, payload.inspectionId || null, payload.driverId || null, payload.vehicleId || null, payload.category || 'other', payload.severity || 'low', payload.description || '', payload.status || 'open', payload.resolutionNotes || '', JSON.stringify(payload.photos || [])]);
    return mapIssue(r.rows[0]);
  },
  async updateIssue(companyId, id, status, resolutionNotes) { const r = await pool.query(`UPDATE issues SET status=$3,resolution_notes=COALESCE($4,resolution_notes),closed_at=CASE WHEN $3='closed' THEN NOW() ELSE closed_at END WHERE company_id=$1 AND id=$2 RETURNING *`, [companyId, id, status, resolutionNotes || null]); if (!r.rows[0]) throw new Error('Issue not found.'); return mapIssue(r.rows[0]); },
  async updateDriverLocation(companyId, driverId, lat, lng, trackingEnabled = true, history = []) {
    const existing = await pool.query('SELECT location_history FROM drivers WHERE company_id=$1 AND id=$2', [companyId, driverId]);
    if (!existing.rows[0]) throw new Error('Driver not found.');
    const now = new Date().toISOString();
    const locationHistory = commonMethods.normalizeLocationHistory([...(existing.rows[0].location_history || []), ...history], {
      lat: Number(lat),
      lng: Number(lng),
      accuracy: history?.[history.length - 1]?.accuracy ?? null,
      timestamp: now
    });
    const r = await pool.query('UPDATE drivers SET last_lat=$3,last_lng=$4,last_seen_at=NOW(),tracking_enabled=$5,location_history=$6::jsonb WHERE company_id=$1 AND id=$2 RETURNING *', [companyId, driverId, Number(lat), Number(lng), !!trackingEnabled, JSON.stringify(locationHistory)]);
    return mapDriver(r.rows[0]);
  },
  async updateVehicleStatus(companyId, vehicleId, status) { const r = await pool.query('UPDATE vehicles SET status=$3 WHERE company_id=$1 AND id=$2 RETURNING *', [companyId, vehicleId, status]); return r.rows[0] ? mapVehicle(r.rows[0]) : null; },
  async getAddresses(companyId) {
    const saved = await pool.query('SELECT * FROM addresses WHERE company_id=$1 ORDER BY COALESCE(last_used_at, created_at) DESC, name', [companyId]);
    const loads = await this.getLoads(companyId);
    const byAddress = new Map(saved.rows.map(row => {
      const item = mapAddress(row);
      return [String(item.address || '').toLowerCase(), item];
    }));
    for (const derived of commonMethods.addressesFromLoads(loads)) {
      const key = String(derived.address || '').toLowerCase();
      if (!byAddress.has(key)) byAddress.set(key, derived);
    }
    return [...byAddress.values()].sort((a, b) => String(b.lastUsedAt || b.createdAt || '').localeCompare(String(a.lastUsedAt || a.createdAt || '')));
  },
  async upsertAddress(companyId, payload) {
    const address = String(payload.address || '').trim();
    if (!address) return null;
    const r = await pool.query(`INSERT INTO addresses (company_id,customer,name,address,type,contact_name,phone,email,hours,dock_notes,notes,last_used_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (company_id, lower(address)) DO UPDATE SET customer=COALESCE(NULLIF(EXCLUDED.customer, ''), addresses.customer), name=COALESCE(NULLIF(EXCLUDED.name, ''), addresses.name), type=EXCLUDED.type, contact_name=COALESCE(NULLIF(EXCLUDED.contact_name, ''), addresses.contact_name), phone=COALESCE(NULLIF(EXCLUDED.phone, ''), addresses.phone), email=COALESCE(NULLIF(EXCLUDED.email, ''), addresses.email), hours=COALESCE(NULLIF(EXCLUDED.hours, ''), addresses.hours), dock_notes=COALESCE(NULLIF(EXCLUDED.dock_notes, ''), addresses.dock_notes), notes=COALESCE(NULLIF(EXCLUDED.notes, ''), addresses.notes), last_used_at=NOW()
      RETURNING *`, [companyId, String(payload.customer || '').trim(), String(payload.name || '').trim(), address, payload.type || 'both', String(payload.contactName || '').trim(), String(payload.phone || '').trim(), String(payload.email || '').trim(), String(payload.hours || '').trim(), String(payload.dockNotes || '').trim(), payload.notes || '']);
    return mapAddress(r.rows[0]);
  },
  async getLoads(companyId) { const r = await pool.query('SELECT * FROM loads WHERE company_id=$1 ORDER BY id DESC', [companyId]); return r.rows.map(mapLoad); },
  async createLoad(companyId, payload, user) {
    if (payload.driverId) { const driver = await pool.query('SELECT id FROM drivers WHERE company_id=$1 AND id=$2', [companyId, payload.driverId]); if (!driver.rows[0]) throw new Error('Driver not found.'); }
    if (payload.vehicleId) { const vehicle = await pool.query('SELECT id FROM vehicles WHERE company_id=$1 AND id=$2', [companyId, payload.vehicleId]); if (!vehicle.rows[0]) throw new Error('Power unit not found.'); }
    if (payload.trailerId) { const trailer = await pool.query('SELECT id FROM vehicles WHERE company_id=$1 AND id=$2', [companyId, payload.trailerId]); if (!trailer.rows[0]) throw new Error('Trailer/equipment not found.'); }
    const status = payload.driverId ? 'assigned' : 'new';
    const events = [commonMethods.buildLoadEvent(status, 'Load created', user)];
    const companyResult = await pool.query('SELECT * FROM companies WHERE id=$1', [companyId]);
    const loadCount = await pool.query('SELECT load_number, company_id FROM loads WHERE company_id=$1', [companyId]);
    const loadNumber = ensureCompanyLoadNumber(mapCompany(companyResult.rows[0] || { id: companyId, code: 'COMPANY' }), loadCount.rows.map(mapLoad), payload.loadNumber);
    const r = await pool.query(`INSERT INTO loads (company_id,load_number,load_type,load_details,customer,broker,reference_number,pickup_name,pickup_address,pickup_appointment,pickup_contact_name,pickup_phone,pickup_hours,pickup_dock_type,pickup_site_notes,delivery_name,delivery_address,delivery_appointment,delivery_contact_name,delivery_phone,delivery_hours,delivery_dock_type,delivery_site_notes,commodity,weight,pieces,rate,notes,driver_id,vehicle_id,trailer_id,public_tracking_token,status,events,documents,created_at,updated_at) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34::jsonb,'[]'::jsonb,NOW(),NOW()) RETURNING *`, [companyId,loadNumber,payload.loadType || 'dry_van',JSON.stringify(payload.loadDetails || {}),payload.customer || '',payload.broker || '',payload.referenceNumber || '',payload.pickupName || '',payload.pickupAddress || '',payload.pickupAppointment || null,payload.pickupContactName || '',payload.pickupPhone || '',payload.pickupHours || '',payload.pickupDockType || '',payload.pickupSiteNotes || '',payload.deliveryName || '',payload.deliveryAddress || '',payload.deliveryAppointment || null,payload.deliveryContactName || '',payload.deliveryPhone || '',payload.deliveryHours || '',payload.deliveryDockType || '',payload.deliverySiteNotes || '',payload.commodity || '',payload.weight || 0,payload.pieces || '',payload.rate || '',payload.notes || '',payload.driverId || null,payload.vehicleId || null,payload.trailerId || null,makeTrackingToken(),status,JSON.stringify(events)]);
    await this.upsertAddress(companyId, { customer: payload.customer, name: payload.pickupName, address: payload.pickupAddress, type: 'pickup', contactName: payload.pickupContactName, phone: payload.pickupPhone, hours: payload.pickupHours, dockNotes: [payload.pickupDockType, payload.pickupSiteNotes].filter(Boolean).join(' - ') });
    await this.upsertAddress(companyId, { customer: payload.customer, name: payload.deliveryName, address: payload.deliveryAddress, type: 'delivery', contactName: payload.deliveryContactName, phone: payload.deliveryPhone, hours: payload.deliveryHours, dockNotes: [payload.deliveryDockType, payload.deliverySiteNotes].filter(Boolean).join(' - ') });
    return mapLoad(r.rows[0]);
  },
  async getPublicLoadByToken(token) {
    const normalized = String(token || '').trim();
    if (!normalized) return null;
    const r = await pool.query('SELECT * FROM loads WHERE public_tracking_token=$1 OR lower(load_number)=lower($1) LIMIT 1', [normalized]);
    return r.rows[0] ? mapLoad(r.rows[0]) : null;
  },
  async updateLoadStatus(companyId, id, status, note, user) {
    const existing = await pool.query('SELECT * FROM loads WHERE company_id=$1 AND id=$2', [companyId, id]);
    if (!existing.rows[0]) throw new Error('Load not found.');
    const events = [...(existing.rows[0].events || []), commonMethods.buildLoadEvent(status || existing.rows[0].status, note, user)];
    const r = await pool.query('UPDATE loads SET status=$3, events=$4::jsonb, updated_at=NOW() WHERE company_id=$1 AND id=$2 RETURNING *', [companyId, id, status || existing.rows[0].status, JSON.stringify(events)]);
    return mapLoad(r.rows[0]);
  },
  async updateLoadAssignment(companyId, id, payload, user) {
    const existing = await pool.query('SELECT * FROM loads WHERE company_id=$1 AND id=$2', [companyId, id]);
    if (!existing.rows[0]) throw new Error('Load not found.');
    const nextStatus = payload.driverId && !['accepted', 'en_route_pickup', 'at_pickup', 'picked_up', 'in_transit', 'at_delivery', 'delivered', 'pod_uploaded', 'closed'].includes(existing.rows[0].status)
      ? 'assigned'
      : existing.rows[0].status;
    const events = [...(existing.rows[0].events || []), commonMethods.buildLoadEvent(nextStatus, payload.driverId ? 'Load assigned from dispatch board' : 'Load moved to unassigned queue', user)];
    const r = await pool.query(
      'UPDATE loads SET driver_id=$3, vehicle_id=$4, trailer_id=$5, status=$6, events=$7::jsonb, updated_at=NOW() WHERE company_id=$1 AND id=$2 RETURNING *',
      [companyId, id, payload.driverId || null, payload.vehicleId || null, payload.trailerId || null, nextStatus, JSON.stringify(events)]
    );
    return mapLoad(r.rows[0]);
  },
  async addLoadDocument(companyId, id, document, user) {
    const existing = await pool.query('SELECT * FROM loads WHERE company_id=$1 AND id=$2', [companyId, id]);
    if (!existing.rows[0]) throw new Error('Load not found.');
    const doc = { ...document, uploadedBy: user?.id || null, uploadedAt: new Date().toISOString() };
    const docs = [...(existing.rows[0].documents || []), doc];
    const events = [...(existing.rows[0].events || []), commonMethods.buildLoadEvent(existing.rows[0].status, `${document.type || 'document'} uploaded`, user)];
    const r = await pool.query('UPDATE loads SET documents=$3::jsonb, events=$4::jsonb, updated_at=NOW() WHERE company_id=$1 AND id=$2 RETURNING *', [companyId, id, JSON.stringify(docs), JSON.stringify(events)]);
    return mapLoad(r.rows[0]);
  },
  async updateLoadPublicSettings(companyId, id, settings) {
    const r = await pool.query(`UPDATE loads SET load_details=COALESCE(load_details, '{}'::jsonb) || $3::jsonb, updated_at=NOW() WHERE company_id=$1 AND id=$2 RETURNING *`, [companyId, id, JSON.stringify(settings || {})]);
    if (!r.rows[0]) throw new Error('Load not found.');
    return mapLoad(r.rows[0]);
  },
  async getBugReports(companyId) { const r = await pool.query('SELECT * FROM bug_reports WHERE ($1::int IS NULL OR company_id=$1) ORDER BY id DESC', [companyId || null]); return r.rows.map(mapBugReport); },
  async createBugReport(companyId, payload, user) {
    const reporterName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : '';
    const r = await pool.query(`INSERT INTO bug_reports (company_id,reporter_user_id,reporter_name,reporter_role,page,category,priority,title,description,status,resolution_notes,photos,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open','',$10::jsonb,NOW()) RETURNING *`, [companyId || null, user?.id || null, reporterName, user?.role || '', payload.page || '', payload.category || 'bug', payload.priority || 'normal', payload.title, payload.description || '', JSON.stringify(payload.photos || [])]);
    return mapBugReport(r.rows[0]);
  },
  async updateBugReport(companyId, id, status, resolutionNotes) {
    const r = await pool.query(`UPDATE bug_reports SET status=$3,resolution_notes=COALESCE($4,resolution_notes),closed_at=CASE WHEN $3='closed' THEN NOW() ELSE closed_at END WHERE id=$2 AND ($1::int IS NULL OR company_id=$1) RETURNING *`, [companyId || null, id, status, resolutionNotes || null]);
    if (!r.rows[0]) throw new Error('Bug report not found.');
    return mapBugReport(r.rows[0]);
  },
  async getNotifications(companyId, user) {
    const role = user?.role || 'staff';
    const audiences = role === 'super_user'
      ? ['super_user', 'admin', 'staff', 'dispatcher', 'driver', 'all']
      : role === 'driver'
        ? ['driver', 'all']
        : role === 'admin'
          ? ['admin', 'staff', 'dispatcher', 'all']
          : ['staff', 'dispatcher', 'all'];
    const r = await pool.query(
      `SELECT * FROM notifications
       WHERE ($1::int IS NULL OR company_id IS NULL OR company_id=$1)
         AND (user_id IS NULL OR user_id=$2)
         AND audience = ANY($3::text[])
       ORDER BY created_at DESC
       LIMIT 100`,
      [companyId || null, user?.id || null, audiences]
    );
    return r.rows.map(mapNotification);
  },
  async createNotification(companyId, payload) {
    const r = await pool.query(
      `INSERT INTO notifications (company_id,user_id,audience,type,severity,title,message,link,metadata,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NOW()) RETURNING *`,
      [companyId || null, payload.userId || null, payload.audience || 'staff', payload.type || 'info', payload.severity || 'info', payload.title, payload.message || '', payload.link || '', JSON.stringify(payload.metadata || {})]
    );
    return mapNotification(r.rows[0]);
  },
  async markNotificationRead(companyId, id, user) {
    const r = await pool.query(
      `UPDATE notifications SET read_at=NOW()
       WHERE id=$1
         AND ($2::int IS NULL OR company_id IS NULL OR company_id=$2)
         AND (user_id IS NULL OR user_id=$3)
       RETURNING *`,
      [id, companyId || null, user?.id || null]
    );
    if (!r.rows[0]) throw new Error('Notification not found.');
    return mapNotification(r.rows[0]);
  },
  ...commonMethods
};

module.exports = usePostgres ? pgDb : fileDb;
