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
function adminOnly(req, res, next) {
  if (req.sessionUser.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
function sanitizeUser(user) {
  return { id: user.id, email: user.email, role: user.role, linkedDriverId: user.linkedDriverId, firstName: user.firstName, lastName: user.lastName };
}

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, postgres: !!process.env.DATABASE_URL, uploadsDir: UPLOADS_DIR, adminConfigured: await db.hasAdminSetup() });
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

app.get('/api/session', auth, async (req, res) => {
  res.json({ user: req.sessionUser });
});

app.post('/api/auth/logout', auth, async (req, res) => {
  const token = getTokenFromReq(req);
  sessions.delete(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/dashboard', auth, async (_req, res) => res.json(await db.getDashboard()));
app.get('/api/users', auth, adminOnly, async (_req, res) => res.json(await db.getUsers()));
app.get('/api/drivers', auth, async (_req, res) => res.json(await db.getDrivers()));
app.post('/api/drivers', auth, adminOnly, async (req, res) => {
  try {
    const driver = await db.createDriver({
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

app.get('/api/vehicles', auth, async (_req, res) => res.json(await db.getVehicles()));
app.post('/api/vehicles', auth, adminOnly, async (req, res) => {
  const vehicle = await db.createVehicle({
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
});

app.get('/api/assignments', auth, async (_req, res) => res.json(await db.getAssignments()));
app.post('/api/assignments', auth, adminOnly, async (req, res) => {
  const assignment = await db.assignVehicle(Number(req.body.driverId), Number(req.body.vehicleId));
  res.json(assignment);
});

app.get('/api/shifts', auth, async (_req, res) => res.json(await db.getShifts()));
app.post('/api/shifts/start', auth, async (req, res) => {
  try {
    const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : Number(req.body.driverId);
    const shift = await db.startShift(driverId, Number(req.body.vehicleId), Number(req.body.startOdometer) || 0);
    res.json(shift);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.post('/api/shifts/end', auth, async (req, res) => {
  try {
    const shift = await db.endShift(Number(req.body.shiftId), Number(req.body.endOdometer) || 0);
    res.json(shift);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/driver-view/:driverId', auth, async (req, res) => {
  const requestedDriverId = Number(req.params.driverId);
  const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : requestedDriverId;
  res.json(await db.getDriverView(driverId));
});

app.get('/api/inspections', auth, async (_req, res) => res.json(await db.getInspections()));
app.post('/api/inspections', auth, upload.array('photos', 8), async (req, res) => {
  const itemResults = JSON.parse(req.body.itemResults || '[]');
  const issueFlag = req.body.issueFlag === 'true';
  const severity = req.body.severity || 'low';
  const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : Number(req.body.driverId);
  const photos = (req.files || []).map(file => ({ filename: file.filename, url: `/uploads/${file.filename}` }));

  const inspection = await db.createInspection({
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
    await db.createIssue({
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
    await db.updateVehicleStatus(Number(req.body.vehicleId), severity === 'critical' ? 'out_of_service' : 'needs_review');
  }

  res.json(inspection);
});

app.get('/api/issues', auth, async (_req, res) => res.json(await db.getIssues()));
app.post('/api/issues', auth, upload.array('photos', 8), async (req, res) => {
  const driverId = req.sessionUser.role === 'driver' ? Number(req.sessionUser.linkedDriverId) : Number(req.body.driverId || 0);
  const issue = await db.createIssue({
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
  await db.updateVehicleStatus(issue.vehicleId, issue.severity === 'critical' ? 'out_of_service' : 'needs_review');
  res.json(issue);
});
app.patch('/api/issues/:id', auth, adminOnly, async (req, res) => {
  try {
    const issue = await db.updateIssue(Number(req.params.id), req.body.status, req.body.resolutionNotes);
    if (issue.status === 'closed' && issue.vehicleId) await db.updateVehicleStatus(issue.vehicleId, 'active');
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
      console.log(`Driver Fleet Management listening on ${PORT}`);
      console.log(`Database mode: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'Local JSON fallback'}`);
      console.log(`Uploads dir: ${UPLOADS_DIR}`);
      console.log(`Admin configured: ${Boolean(process.env.ADMIN_PASSWORD)}`);
    });
  } catch (error) {
    console.error('Startup failed', error);
    process.exit(1);
  }
})();
