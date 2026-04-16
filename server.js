const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const seed = {
  counters: {
    driver: 2,
    vehicle: 2,
    shift: 1,
    inspection: 1,
    issue: 1
  },
  drivers: [
    { id: 1, firstName: 'John', lastName: 'Driver', phone: '555-100-2000', email: 'john@example.com', licenseNumber: 'D1234567', licenseClass: 'AZ', licenseExpiry: '2027-12-31', status: 'active' },
    { id: 2, firstName: 'Maria', lastName: 'Lopez', phone: '555-200-3000', email: 'maria@example.com', licenseNumber: 'D7654321', licenseClass: 'AZ', licenseExpiry: '2028-05-30', status: 'active' }
  ],
  vehicles: [
    { id: 1, unitNumber: 'TRK-101', plateNumber: 'ABCD123', vin: '1HGBH41JXMN109186', make: 'Freightliner', model: 'Cascadia', year: 2022, type: 'tractor', odometer: 124500, status: 'active' },
    { id: 2, unitNumber: 'TRK-102', plateNumber: 'EFGH456', vin: '2HGBH41JXMN109187', make: 'Volvo', model: 'VNL', year: 2021, type: 'tractor', odometer: 156900, status: 'active' }
  ],
  assignments: [
    { driverId: 1, vehicleId: 1, active: true, assignedAt: new Date().toISOString() },
    { driverId: 2, vehicleId: 2, active: true, assignedAt: new Date().toISOString() }
  ],
  shifts: [],
  inspections: [],
  issues: []
};

function readDb() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return structuredClone(seed);
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function nextId(db, key) {
  db.counters[key] = (db.counters[key] || 0) + 1;
  return db.counters[key];
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, safeName);
  }
});
const upload = multer({ storage });

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/dashboard', (_req, res) => {
  const db = readDb();
  const today = new Date().toISOString().slice(0, 10);
  const activeShifts = db.shifts.filter(s => s.status === 'started').length;
  const inspectionsToday = db.inspections.filter(i => (i.inspectionTime || '').slice(0, 10) === today).length;
  const openIssues = db.issues.filter(i => i.status !== 'closed').length;
  const outOfService = db.vehicles.filter(v => v.status === 'out_of_service').length;
  res.json({ activeShifts, inspectionsToday, openIssues, outOfService, drivers: db.drivers.length, vehicles: db.vehicles.length });
});

app.get('/api/drivers', (_req, res) => res.json(readDb().drivers));
app.post('/api/drivers', (req, res) => {
  const db = readDb();
  const driver = {
    id: nextId(db, 'driver'),
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    phone: req.body.phone || '',
    email: req.body.email || '',
    licenseNumber: req.body.licenseNumber || '',
    licenseClass: req.body.licenseClass || '',
    licenseExpiry: req.body.licenseExpiry || '',
    status: req.body.status || 'active'
  };
  db.drivers.push(driver);
  writeDb(db);
  res.json(driver);
});

app.get('/api/vehicles', (_req, res) => res.json(readDb().vehicles));
app.post('/api/vehicles', (req, res) => {
  const db = readDb();
  const vehicle = {
    id: nextId(db, 'vehicle'),
    unitNumber: req.body.unitNumber,
    plateNumber: req.body.plateNumber || '',
    vin: req.body.vin || '',
    make: req.body.make || '',
    model: req.body.model || '',
    year: Number(req.body.year) || '',
    type: req.body.type || 'tractor',
    odometer: Number(req.body.odometer) || 0,
    status: req.body.status || 'active'
  };
  db.vehicles.push(vehicle);
  writeDb(db);
  res.json(vehicle);
});

app.get('/api/assignments', (_req, res) => res.json(readDb().assignments));
app.post('/api/assignments', (req, res) => {
  const db = readDb();
  db.assignments = db.assignments.map(a => a.driverId === Number(req.body.driverId) ? { ...a, active: false, unassignedAt: new Date().toISOString() } : a);
  const assignment = {
    driverId: Number(req.body.driverId),
    vehicleId: Number(req.body.vehicleId),
    active: true,
    assignedAt: new Date().toISOString()
  };
  db.assignments.push(assignment);
  writeDb(db);
  res.json(assignment);
});

app.get('/api/driver-view/:driverId', (req, res) => {
  const db = readDb();
  const driverId = Number(req.params.driverId);
  const driver = db.drivers.find(d => d.id === driverId);
  const assignment = db.assignments.find(a => a.driverId === driverId && a.active);
  const vehicle = assignment ? db.vehicles.find(v => v.id === assignment.vehicleId) : null;
  const activeShift = db.shifts.find(s => s.driverId === driverId && s.status === 'started');
  res.json({ driver, vehicle, activeShift });
});

app.post('/api/shifts/start', (req, res) => {
  const db = readDb();
  const driverId = Number(req.body.driverId);
  const vehicleId = Number(req.body.vehicleId);
  const existing = db.shifts.find(s => s.driverId === driverId && s.status === 'started');
  if (existing) return res.status(400).json({ error: 'Driver already has an active shift.' });
  const shift = {
    id: nextId(db, 'shift'),
    driverId,
    vehicleId,
    startTime: new Date().toISOString(),
    endTime: null,
    startOdometer: Number(req.body.startOdometer) || 0,
    endOdometer: null,
    status: 'started'
  };
  db.shifts.push(shift);
  writeDb(db);
  res.json(shift);
});

app.post('/api/shifts/end', (req, res) => {
  const db = readDb();
  const shift = db.shifts.find(s => s.id === Number(req.body.shiftId));
  if (!shift) return res.status(404).json({ error: 'Shift not found.' });
  shift.endTime = new Date().toISOString();
  shift.endOdometer = Number(req.body.endOdometer) || shift.endOdometer;
  shift.status = 'completed';
  writeDb(db);
  res.json(shift);
});

app.get('/api/inspections', (_req, res) => res.json(readDb().inspections));
app.post('/api/inspections', upload.array('photos', 8), (req, res) => {
  const db = readDb();
  const itemResults = JSON.parse(req.body.itemResults || '[]');
  const issueFlag = req.body.issueFlag === 'true';
  const severity = req.body.severity || 'low';

  const inspection = {
    id: nextId(db, 'inspection'),
    shiftId: Number(req.body.shiftId),
    driverId: Number(req.body.driverId),
    vehicleId: Number(req.body.vehicleId),
    inspectionTime: new Date().toISOString(),
    odometer: Number(req.body.odometer) || 0,
    overallStatus: req.body.overallStatus || 'pass',
    notes: req.body.notes || '',
    itemResults,
    photos: (req.files || []).map(file => ({
      filename: file.filename,
      url: `/uploads/${file.filename}`
    }))
  };
  db.inspections.push(inspection);

  if (issueFlag) {
    const issue = {
      id: nextId(db, 'issue'),
      shiftId: Number(req.body.shiftId) || null,
      inspectionId: inspection.id,
      driverId: Number(req.body.driverId),
      vehicleId: Number(req.body.vehicleId),
      category: req.body.category || 'other',
      severity,
      description: req.body.issueDescription || 'Inspection defect reported',
      status: 'open',
      createdAt: new Date().toISOString(),
      photos: inspection.photos
    };
    db.issues.push(issue);
    const vehicle = db.vehicles.find(v => v.id === Number(req.body.vehicleId));
    if (vehicle) {
      vehicle.status = severity === 'critical' ? 'out_of_service' : 'needs_review';
    }
  }

  writeDb(db);
  res.json(inspection);
});

app.get('/api/issues', (_req, res) => res.json(readDb().issues));
app.post('/api/issues', upload.array('photos', 8), (req, res) => {
  const db = readDb();
  const issue = {
    id: nextId(db, 'issue'),
    shiftId: Number(req.body.shiftId) || null,
    inspectionId: null,
    driverId: Number(req.body.driverId),
    vehicleId: Number(req.body.vehicleId),
    category: req.body.category || 'other',
    severity: req.body.severity || 'low',
    description: req.body.description || '',
    status: 'open',
    createdAt: new Date().toISOString(),
    photos: (req.files || []).map(file => ({ filename: file.filename, url: `/uploads/${file.filename}` }))
  };
  db.issues.push(issue);
  const vehicle = db.vehicles.find(v => v.id === issue.vehicleId);
  if (vehicle) vehicle.status = issue.severity === 'critical' ? 'out_of_service' : 'needs_review';
  writeDb(db);
  res.json(issue);
});

app.patch('/api/issues/:id', (req, res) => {
  const db = readDb();
  const issue = db.issues.find(i => i.id === Number(req.params.id));
  if (!issue) return res.status(404).json({ error: 'Issue not found.' });
  issue.status = req.body.status || issue.status;
  issue.resolutionNotes = req.body.resolutionNotes || issue.resolutionNotes || '';
  if (issue.status === 'closed') {
    issue.closedAt = new Date().toISOString();
    const vehicle = db.vehicles.find(v => v.id === issue.vehicleId);
    if (vehicle && vehicle.status !== 'active') vehicle.status = 'active';
  }
  writeDb(db);
  res.json(issue);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Driver fleet prototype running on port ${PORT}`);
});
