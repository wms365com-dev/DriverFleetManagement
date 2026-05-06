const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');
const { verifyPassword, createSessionToken } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const uploadsBase = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const UPLOADS_DIR = path.resolve(uploadsBase);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const sessions = new Map();
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024, files: 8 } });

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}
function setSessionCookie(res, token) {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `dfm_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}${secure}`);
}
function clearSessionCookie(res) {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `dfm_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}
function getTokenFromReq(req) {
  return parseCookies(req).dfm_session || req.headers['x-session-token'] || '';
}
function auth(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Unauthorized' });
  req.sessionUser = sessions.get(token);
  next();
}
function hasRole(user, roles) { return roles.includes(user.role); }
function superOnly(req, res, next) {
  if (!hasRole(req.sessionUser, ['super_user'])) return res.status(403).json({ error: 'Super user access required' });
  next();
}
function companyAdminOnly(req, res, next) {
  if (!hasRole(req.sessionUser, ['super_user', 'admin'])) return res.status(403).json({ error: 'Company admin access required' });
  next();
}
function staffOnly(req, res, next) {
  if (!hasRole(req.sessionUser, ['super_user', 'admin', 'support_staff'])) return res.status(403).json({ error: 'Staff access required' });
  next();
}
function isDriver(req) {
  return req.sessionUser?.role === 'driver';
}
function sanitizeUser(user) {
  return {
    id: user.id,
    companyId: user.companyId ?? null,
    email: user.email,
    role: user.role,
    linkedDriverId: user.linkedDriverId,
    firstName: user.firstName,
    lastName: user.lastName
  };
}
function getRequestedCompanyId(req) {
  return Number(req.query.companyId || req.body.companyId || req.params.companyId || 0) || null;
}
async function resolveCompanyId(req) {
  if (req.sessionUser.role === 'super_user') {
    const requested = getRequestedCompanyId(req);
    if (requested) return requested;
    const companies = await db.getCompanies();
    return companies[0]?.id || null;
  }
  return Number(req.sessionUser.companyId || 0) || null;
}
async function requireCompanyScope(req, res, next) {
  const companyId = await resolveCompanyId(req);
  if (!companyId) return res.status(400).json({ error: 'No company selected' });
  req.companyId = companyId;
  next();
}
async function requireDriverProfile(req, res, next) {
  if (!isDriver(req)) return next();
  const driverId = Number(req.sessionUser.linkedDriverId || 0);
  if (!driverId) return res.status(403).json({ error: 'Driver account is not linked to a driver record' });
  const view = await db.getDriverView(req.companyId, driverId);
  if (!view.driver) return res.status(403).json({ error: 'Driver profile was not found' });
  req.driverProfile = view;
  next();
}
function requireAssignedVehicle(req, vehicleId) {
  if (!isDriver(req)) return;
  const assignedVehicleId = Number(req.driverProfile?.vehicle?.id || 0);
  if (!assignedVehicleId || Number(vehicleId) !== assignedVehicleId) {
    throw new Error('Drivers can only work with their assigned vehicle.');
  }
}
function parseInspectionItems(raw) {
  const parsed = JSON.parse(raw || '[]');
  if (!Array.isArray(parsed)) throw new Error('Inspection checklist is invalid.');
  return parsed.map(item => ({
    item: String(item.item || '').slice(0, 80),
    result: ['pass', 'fail', 'na'].includes(String(item.result)) ? String(item.result) : 'pass',
    notes: String(item.notes || '').slice(0, 500)
  }));
}
function loadPayload(body) {
  return {
    loadNumber: String(body.loadNumber || '').trim(),
    customer: body.customer || '',
    broker: body.broker || '',
    referenceNumber: body.referenceNumber || '',
    pickupName: body.pickupName || '',
    pickupAddress: body.pickupAddress || '',
    pickupAppointment: body.pickupAppointment || null,
    deliveryName: body.deliveryName || '',
    deliveryAddress: body.deliveryAddress || '',
    deliveryAppointment: body.deliveryAppointment || null,
    commodity: body.commodity || '',
    weight: Number(body.weight) || 0,
    pieces: body.pieces || '',
    rate: body.rate || '',
    notes: body.notes || '',
    driverId: Number(body.driverId) || null,
    vehicleId: Number(body.vehicleId) || null,
    trailerId: Number(body.trailerId) || null
  };
}
function addressPayload(body) {
  const type = String(body.type || 'both');
  return {
    name: String(body.name || '').trim(),
    address: String(body.address || '').trim(),
    type: ['pickup', 'delivery', 'both'].includes(type) ? type : 'both',
    notes: String(body.notes || '').trim()
  };
}
function canDriverAccessLoad(req, load) {
  return !isDriver(req) || Number(load.driverId) === Number(req.sessionUser.linkedDriverId);
}
const driverLoadStatuses = new Set(['accepted', 'en_route_pickup', 'at_pickup', 'picked_up', 'in_transit', 'at_delivery', 'delivered', 'exception']);
function bugPayload(body, files = []) {
  return {
    page: body.page || '',
    category: body.category || 'bug',
    priority: body.priority || 'normal',
    title: String(body.title || '').trim(),
    description: body.description || '',
    photos: files.map(file => ({ filename: file.filename, url: `/uploads/${file.filename}` }))
  };
}

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, postgres: !!process.env.DATABASE_URL, uploadsDir: UPLOADS_DIR, superUserConfigured: await db.hasAdminSetup() });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await db.findUserByEmail(email);
  if (!user || user.isActive === false || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = createSessionToken();
  const safeUser = sanitizeUser(user);
  sessions.set(token, safeUser);
  setSessionCookie(res, token);
  res.json({ user: safeUser });
});

app.get('/api/session', auth, async (req, res) => res.json({ user: req.sessionUser }));
app.post('/api/auth/logout', auth, async (req, res) => {
  sessions.delete(getTokenFromReq(req));
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/companies', auth, async (req, res) => {
  if (req.sessionUser.role === 'super_user') return res.json(await db.getCompanies());
  const companies = await db.getCompanies();
  return res.json(companies.filter(c => Number(c.id) === Number(req.sessionUser.companyId)));
});
app.post('/api/companies', auth, superOnly, async (req, res) => {
  try {
    const company = await db.createCompany({ name: req.body.name, code: req.body.code || '', status: req.body.status || 'active' });
    if (req.body.adminEmail && req.body.adminPassword) {
      await db.createUser({
        companyId: company.id,
        email: req.body.adminEmail,
        password: req.body.adminPassword,
        role: 'admin',
        firstName: req.body.adminFirstName || 'Company',
        lastName: req.body.adminLastName || 'Admin'
      });
    }
    res.json(company);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create company' });
  }
});

app.get('/api/users', auth, companyAdminOnly, requireCompanyScope, async (req, res) => res.json(await db.getUsers(req.companyId)));
app.post('/api/users', auth, companyAdminOnly, requireCompanyScope, async (req, res) => {
  try {
    const role = String(req.body.role || 'support_staff');
    if (!['admin', 'support_staff'].includes(role) && req.sessionUser.role !== 'super_user') {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const user = await db.createUser({
      companyId: req.companyId,
      email: req.body.email,
      password: req.body.password,
      role,
      firstName: req.body.firstName || '',
      lastName: req.body.lastName || '',
      linkedDriverId: null
    });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create user' });
  }
});

app.get('/api/dashboard', auth, requireCompanyScope, async (req, res) => {
  if (isDriver(req)) return res.status(403).json({ error: 'Staff access required' });
  res.json(await db.getDashboard(req.companyId));
});
app.get('/api/drivers', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  if (isDriver(req)) return res.json([req.driverProfile.driver]);
  res.json(await db.getDrivers(req.companyId));
});
app.post('/api/drivers', auth, staffOnly, requireCompanyScope, async (req, res) => {
  try {
    const driver = await db.createDriver(req.companyId, {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone || '',
      email: req.body.email || '',
      licenseNumber: req.body.licenseNumber || '',
      licenseClass: req.body.licenseClass || '',
      licenseExpiry: req.body.licenseExpiry || '',
      status: req.body.status || 'active',
      createLogin: req.body.createLogin === true || req.body.createLogin === 'true',
      userPassword: req.body.userPassword || ''
    });
    res.json(driver);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create driver' });
  }
});

app.get('/api/vehicles', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  if (isDriver(req)) return res.json(req.driverProfile.vehicle ? [req.driverProfile.vehicle] : []);
  res.json(await db.getVehicles(req.companyId));
});
app.post('/api/vehicles', auth, staffOnly, requireCompanyScope, async (req, res) => {
  try {
    const vehicle = await db.createVehicle(req.companyId, {
      unitNumber: req.body.unitNumber,
      plateNumber: req.body.plateNumber || '',
      vin: req.body.vin || '',
      make: req.body.make || '',
      model: req.body.model || '',
      year: Number(req.body.year) || null,
      type: req.body.type || 'tractor',
      category: req.body.category || 'power_unit',
      length: req.body.length || '',
      maxWeight: Number(req.body.maxWeight) || null,
      temperatureCapable: req.body.temperatureCapable === true || req.body.temperatureCapable === 'true',
      liftgate: req.body.liftgate === true || req.body.liftgate === 'true',
      hazmatCapable: req.body.hazmatCapable === true || req.body.hazmatCapable === 'true',
      odometer: Number(req.body.odometer) || 0,
      status: req.body.status || 'active'
    });
    res.json(vehicle);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create vehicle' });
  }
});

app.get('/api/assignments', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  const assignments = await db.getAssignments(req.companyId);
  if (isDriver(req)) return res.json(assignments.filter(a => Number(a.driverId) === Number(req.sessionUser.linkedDriverId)));
  res.json(assignments);
});
app.post('/api/assignments', auth, staffOnly, requireCompanyScope, async (req, res) => {
  try {
    const assignment = await db.assignVehicle(req.companyId, Number(req.body.driverId), Number(req.body.vehicleId));
    res.json(assignment);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to assign vehicle' });
  }
});

app.get('/api/shifts', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  const shifts = await db.getShifts(req.companyId);
  if (isDriver(req)) return res.json(shifts.filter(s => Number(s.driverId) === Number(req.sessionUser.linkedDriverId)));
  res.json(shifts);
});
app.post('/api/shifts/start', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  try {
    const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : Number(req.body.driverId || 0);
    const vehicleId = Number(req.body.vehicleId);
    requireAssignedVehicle(req, vehicleId);
    const shift = await db.startShift(req.companyId, driverId, vehicleId, Number(req.body.startOdometer) || 0);
    res.json(shift);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.post('/api/shifts/end', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  try {
    if (isDriver(req) && Number(req.driverProfile?.activeShift?.id || 0) !== Number(req.body.shiftId)) {
      return res.status(403).json({ error: 'Drivers can only end their active shift.' });
    }
    const shift = await db.endShift(req.companyId, Number(req.body.shiftId), Number(req.body.endOdometer) || 0);
    res.json(shift);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


app.post('/api/location', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  try {
    const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : Number(req.body.driverId || 0);
    if (!driverId) return res.status(400).json({ error: 'Driver is required' });
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'Valid latitude and longitude are required' });
    const driver = await db.updateDriverLocation(req.companyId, driverId, lat, lng, true);
    res.json(driver);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to update location' });
  }
});

app.get('/api/driver-view/:driverId', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  const requestedDriverId = Number(req.params.driverId);
  const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : requestedDriverId;
  res.json(await db.getDriverView(req.companyId, driverId));
});

app.get('/api/inspections', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  const inspections = await db.getInspections(req.companyId);
  if (isDriver(req)) return res.json(inspections.filter(i => Number(i.driverId) === Number(req.sessionUser.linkedDriverId)));
  res.json(inspections);
});
app.post('/api/inspections', auth, requireCompanyScope, requireDriverProfile, upload.array('photos', 8), async (req, res) => {
  try {
    const itemResults = parseInspectionItems(req.body.itemResults);
    const hasFailedItem = itemResults.some(item => item.result === 'fail');
    const issueFlag = req.body.issueFlag === 'true' || hasFailedItem || ['fail', 'pass_with_defects'].includes(req.body.overallStatus);
    const severity = req.body.severity || 'low';
    const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : Number(req.body.driverId);
    const vehicleId = Number(req.body.vehicleId);
    requireAssignedVehicle(req, vehicleId);
    const photos = (req.files || []).map(file => ({ filename: file.filename, url: `/uploads/${file.filename}` }));

    const inspection = await db.createInspection(req.companyId, {
      shiftId: Number(req.body.shiftId) || null,
      driverId,
      vehicleId,
      odometer: Number(req.body.odometer) || 0,
      overallStatus: hasFailedItem && req.body.overallStatus === 'pass' ? 'pass_with_defects' : (req.body.overallStatus || 'pass'),
      notes: req.body.notes || '',
      itemResults,
      photos
    });

    if (issueFlag) {
      await db.createIssue(req.companyId, {
        shiftId: Number(req.body.shiftId) || null,
        inspectionId: inspection.id,
        driverId,
        vehicleId,
        category: req.body.category || 'other',
        severity,
        description: req.body.issueDescription || (hasFailedItem ? `Inspection defects: ${itemResults.filter(item => item.result === 'fail').map(item => item.item).join(', ')}` : 'Inspection defect reported'),
        status: 'open',
        photos
      });
      await db.updateVehicleStatus(req.companyId, vehicleId, severity === 'critical' || req.body.overallStatus === 'fail' ? 'out_of_service' : 'needs_review');
    }

    res.json(inspection);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to save inspection' });
  }
});

app.get('/api/issues', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  const issues = await db.getIssues(req.companyId);
  if (isDriver(req)) return res.json(issues.filter(i => Number(i.driverId) === Number(req.sessionUser.linkedDriverId)));
  res.json(issues);
});

app.get('/api/addresses', auth, staffOnly, requireCompanyScope, async (req, res) => {
  res.json(await db.getAddresses(req.companyId));
});
app.post('/api/addresses', auth, staffOnly, requireCompanyScope, async (req, res) => {
  try {
    const payload = addressPayload(req.body);
    if (!payload.address) return res.status(400).json({ error: 'Address is required' });
    const address = await db.upsertAddress(req.companyId, payload);
    res.json(address);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to save address' });
  }
});

app.post('/api/issues', auth, requireCompanyScope, requireDriverProfile, upload.array('photos', 8), async (req, res) => {
  try {
    const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : Number(req.body.driverId || 0);
    const vehicleId = Number(req.body.vehicleId);
    requireAssignedVehicle(req, vehicleId);
    const issue = await db.createIssue(req.companyId, {
      shiftId: Number(req.body.shiftId) || null,
      inspectionId: null,
      driverId,
      vehicleId,
      category: req.body.category || 'other',
      severity: req.body.severity || 'low',
      description: req.body.description || '',
      status: 'open',
      photos: (req.files || []).map(file => ({ filename: file.filename, url: `/uploads/${file.filename}` }))
    });
    await db.updateVehicleStatus(req.companyId, issue.vehicleId, issue.severity === 'critical' ? 'out_of_service' : 'needs_review');
    res.json(issue);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create issue' });
  }
});
app.patch('/api/issues/:id', auth, staffOnly, requireCompanyScope, async (req, res) => {
  try {
    const issue = await db.updateIssue(req.companyId, Number(req.params.id), req.body.status, req.body.resolutionNotes);
    if (issue.status === 'closed' && issue.vehicleId) await db.updateVehicleStatus(req.companyId, issue.vehicleId, 'active');
    res.json(issue);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/loads', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  const loads = await db.getLoads(req.companyId);
  if (isDriver(req)) return res.json(loads.filter(load => Number(load.driverId) === Number(req.sessionUser.linkedDriverId)));
  res.json(loads);
});
app.post('/api/loads', auth, staffOnly, requireCompanyScope, async (req, res) => {
  try {
    const payload = loadPayload(req.body);
    if (!payload.loadNumber) return res.status(400).json({ error: 'Load number is required' });
    const load = await db.createLoad(req.companyId, payload, req.sessionUser);
    res.json(load);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create load' });
  }
});
app.patch('/api/loads/:id/status', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  try {
    const loads = await db.getLoads(req.companyId);
    const load = loads.find(l => Number(l.id) === Number(req.params.id));
    if (!load) return res.status(404).json({ error: 'Load not found' });
    if (!canDriverAccessLoad(req, load)) return res.status(403).json({ error: 'Drivers can only update assigned loads' });
    const status = String(req.body.status || '').trim();
    if (isDriver(req) && !driverLoadStatuses.has(status)) return res.status(400).json({ error: 'Invalid driver load status' });
    const updated = await db.updateLoadStatus(req.companyId, load.id, status, req.body.note || '', req.sessionUser);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to update load' });
  }
});
app.post('/api/loads/:id/documents', auth, requireCompanyScope, requireDriverProfile, upload.array('photos', 8), async (req, res) => {
  try {
    const loads = await db.getLoads(req.companyId);
    const load = loads.find(l => Number(l.id) === Number(req.params.id));
    if (!load) return res.status(404).json({ error: 'Load not found' });
    if (!canDriverAccessLoad(req, load)) return res.status(403).json({ error: 'Drivers can only upload documents for assigned loads' });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'At least one photo is required' });
    let updated = load;
    for (const file of files) {
      updated = await db.addLoadDocument(req.companyId, load.id, {
        type: req.body.type || 'bol',
        note: req.body.note || '',
        filename: file.filename,
        url: `/uploads/${file.filename}`
      }, req.sessionUser);
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to upload document' });
  }
});

app.get('/api/bug-reports', auth, staffOnly, requireCompanyScope, async (req, res) => {
  res.json(await db.getBugReports(req.companyId));
});
app.post('/api/bug-reports', auth, requireCompanyScope, upload.array('photos', 4), async (req, res) => {
  try {
    const payload = bugPayload(req.body, req.files || []);
    if (!payload.title) return res.status(400).json({ error: 'Title is required' });
    const report = await db.createBugReport(req.companyId, payload, req.sessionUser);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to submit bug report' });
  }
});
app.patch('/api/bug-reports/:id', auth, staffOnly, requireCompanyScope, async (req, res) => {
  try {
    const report = await db.updateBugReport(req.companyId, Number(req.params.id), req.body.status, req.body.resolutionNotes);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to update bug report' });
  }
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

(async () => {
  try {
    await db.init();
    app.listen(PORT, () => {
      console.log(`Fleet Operations listening on ${PORT}`);
      console.log(`Database mode: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'Local JSON fallback'}`);
      console.log(`Uploads dir: ${UPLOADS_DIR}`);
      console.log(`Super user configured: ${Boolean(process.env.ADMIN_PASSWORD || process.env.SUPER_PASSWORD)}`);
    });
  } catch (error) {
    console.error('Startup failed', error);
    process.exit(1);
  }
})();
