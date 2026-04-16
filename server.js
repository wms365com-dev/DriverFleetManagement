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

app.get('/api/dashboard', auth, requireCompanyScope, async (req, res) => res.json(await db.getDashboard(req.companyId)));
app.get('/api/drivers', auth, requireCompanyScope, async (req, res) => res.json(await db.getDrivers(req.companyId)));
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

app.get('/api/vehicles', auth, requireCompanyScope, async (req, res) => res.json(await db.getVehicles(req.companyId)));
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
      odometer: Number(req.body.odometer) || 0,
      status: req.body.status || 'active'
    });
    res.json(vehicle);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create vehicle' });
  }
});

app.get('/api/assignments', auth, requireCompanyScope, async (req, res) => res.json(await db.getAssignments(req.companyId)));
app.post('/api/assignments', auth, staffOnly, requireCompanyScope, async (req, res) => {
  try {
    const assignment = await db.assignVehicle(req.companyId, Number(req.body.driverId), Number(req.body.vehicleId));
    res.json(assignment);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to assign vehicle' });
  }
});

app.get('/api/shifts', auth, requireCompanyScope, async (req, res) => res.json(await db.getShifts(req.companyId)));
app.post('/api/shifts/start', auth, requireCompanyScope, async (req, res) => {
  try {
    const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : Number(req.body.driverId || 0);
    const shift = await db.startShift(req.companyId, driverId, Number(req.body.vehicleId), Number(req.body.startOdometer) || 0);
    res.json(shift);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.post('/api/shifts/end', auth, requireCompanyScope, async (req, res) => {
  try {
    const shift = await db.endShift(req.companyId, Number(req.body.shiftId), Number(req.body.endOdometer) || 0);
    res.json(shift);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/driver-view/:driverId', auth, requireCompanyScope, async (req, res) => {
  const requestedDriverId = Number(req.params.driverId);
  const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : requestedDriverId;
  res.json(await db.getDriverView(req.companyId, driverId));
});

app.get('/api/inspections', auth, requireCompanyScope, async (req, res) => res.json(await db.getInspections(req.companyId)));
app.post('/api/inspections', auth, requireCompanyScope, upload.array('photos', 8), async (req, res) => {
  try {
    const itemResults = JSON.parse(req.body.itemResults || '[]');
    const issueFlag = req.body.issueFlag === 'true';
    const severity = req.body.severity || 'low';
    const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : Number(req.body.driverId);
    const photos = (req.files || []).map(file => ({ filename: file.filename, url: `/uploads/${file.filename}` }));

    const inspection = await db.createInspection(req.companyId, {
      shiftId: Number(req.body.shiftId) || null,
      driverId,
      vehicleId: Number(req.body.vehicleId),
      odometer: Number(req.body.odometer) || 0,
      overallStatus: req.body.overallStatus || 'pass',
      notes: req.body.notes || '',
      itemResults,
      photos
    });

    if (issueFlag) {
      await db.createIssue(req.companyId, {
        shiftId: Number(req.body.shiftId) || null,
        inspectionId: inspection.id,
        driverId,
        vehicleId: Number(req.body.vehicleId),
        category: req.body.category || 'other',
        severity,
        description: req.body.issueDescription || 'Inspection defect reported',
        status: 'open',
        photos
      });
      await db.updateVehicleStatus(req.companyId, Number(req.body.vehicleId), severity === 'critical' ? 'out_of_service' : 'needs_review');
    }

    res.json(inspection);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to save inspection' });
  }
});

app.get('/api/issues', auth, requireCompanyScope, async (req, res) => res.json(await db.getIssues(req.companyId)));
app.post('/api/issues', auth, requireCompanyScope, upload.array('photos', 8), async (req, res) => {
  try {
    const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : Number(req.body.driverId || 0);
    const issue = await db.createIssue(req.companyId, {
      shiftId: Number(req.body.shiftId) || null,
      inspectionId: null,
      driverId,
      vehicleId: Number(req.body.vehicleId),
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
