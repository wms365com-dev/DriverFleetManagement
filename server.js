const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Stripe = require('stripe');
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
const GEOAPIFY_API_KEY = String(process.env.GEOAPIFY_API_KEY || '').trim();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' }) : null;
const STRIPE_TRIAL_DAYS = Number(process.env.STRIPE_TRIAL_DAYS || 14);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe webhook is not configured');
    const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook failed:', error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));
app.get(['/portal', '/login', '/app'], (_req, res) => res.sendFile(path.join(__dirname, 'public', 'portal.html')));
app.get('/signup', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/affiliate', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'affiliate.html')));
app.get(['/tracking', '/track'], (_req, res) => res.sendFile(path.join(__dirname, 'public', 'tracking.html')));
app.get('/track/:token', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'tracking.html')));

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
  return enforceCompanyBilling(req, res, next);
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
function companyCodeFromName(name) {
  const base = String(name || 'COMPANY').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 4).padEnd(4, 'X') || 'COMP';
  return `${base}${Date.now().toString(36).toUpperCase()}`.slice(0, 8);
}
function normalizeAffiliateCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 16);
}
function signupPayload(body) {
  return {
    companyName: String(body.companyName || '').trim(),
    fleetSize: String(body.fleetSize || '').trim(),
    plan: String(body.plan || 'operations').trim().toLowerCase(),
    driverQuantity: Math.max(1, Math.min(500, Number(body.driverQuantity) || 1)),
    firstName: String(body.firstName || '').trim(),
    lastName: String(body.lastName || '').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    password: String(body.password || ''),
    affiliateCode: normalizeAffiliateCode(body.affiliateCode || body.referralCode || body.ref || ''),
    website: String(body.website || '').trim()
  };
}
function affiliatePayload(body) {
  return {
    firstName: String(body.firstName || '').trim(),
    lastName: String(body.lastName || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    phone: String(body.phone || '').trim(),
    companyName: String(body.companyName || '').trim(),
    promotionUrl: String(body.promotionUrl || '').trim(),
    promoterType: String(body.promoterType || 'independent').trim(),
    payoutEmail: String(body.payoutEmail || body.email || '').trim().toLowerCase(),
    notes: String(body.notes || '').trim(),
    website: String(body.website || '').trim()
  };
}
function validateSignup(payload) {
  if (payload.website) throw new Error('Unable to create signup.');
  if (payload.companyName.length < 2) throw new Error('Company name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw new Error('Valid admin email is required.');
  if (payload.password.length < 10) throw new Error('Password must be at least 10 characters.');
  if (!payload.firstName) throw new Error('Admin first name is required.');
  if (!payload.lastName) throw new Error('Admin last name is required.');
}
function validateAffiliate(payload) {
  if (payload.website) throw new Error('Unable to create affiliate account.');
  if (!payload.firstName) throw new Error('First name is required.');
  if (!payload.lastName) throw new Error('Last name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw new Error('Valid email is required.');
  if (payload.payoutEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.payoutEmail)) throw new Error('Valid payout email is required.');
}
function validatePassword(password, label = 'Password') {
  if (String(password || '').length < 10) throw new Error(`${label} must be at least 10 characters.`);
}
const affiliatePlanPricing = {
  starter: { base: 99, driver: 10 },
  operations: { base: 149, driver: 15 },
  pro: { base: 399, driver: 18 }
};
function affiliateCommissionEstimate(planKey = 'operations', driverQuantity = 1) {
  const plan = affiliatePlanPricing[planKey] || affiliatePlanPricing.operations;
  const monthly = plan.base + (plan.driver * Math.max(1, Number(driverQuantity) || 1));
  return Math.round(monthly * 25) / 100;
}
function publicSignupError(error) {
  const message = String(error?.message || '');
  if (message.includes('companies_pkey') || message.includes('duplicate key value')) {
    return 'We could not create the company workspace because setup is being refreshed. Please try again in a minute.';
  }
  return message || 'Unable to create company signup';
}
async function notify(companyId, payload) {
  try {
    if (!payload?.title) return null;
    return await db.createNotification(companyId || null, payload);
  } catch (error) {
    console.error('Notification failed:', error.message);
    return null;
  }
}
function loadNotificationMeta(load) {
  return {
    loadId: load?.id || null,
    loadNumber: load?.loadNumber || '',
    status: load?.status || '',
    trackingToken: load?.publicTrackingToken || ''
  };
}
async function ensureApprovedCompanyForLogin(user) {
  if (user.role === 'super_user') return;
  const companies = await db.getCompanies();
  const company = companies.find(c => Number(c.id) === Number(user.companyId));
  if (!company || company.status !== 'active') {
    throw new Error('Your company signup is pending super admin approval.');
  }
  if (!companyBillingAllowsAccess(company)) {
    throw new Error('Your company subscription needs payment attention. Please update billing to restore portal access.');
  }
}
const billingBlockedStatuses = new Set(['incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'canceled', 'cancelled', 'payment_required', 'suspended']);
function companyBillingAllowsAccess(company) {
  return !billingBlockedStatuses.has(String(company?.billingStatus || 'active').toLowerCase());
}
async function enforceCompanyBilling(req, res, next) {
  if (req.sessionUser?.role === 'super_user') return next();
  const companies = await db.getCompanies();
  const company = companies.find(c => Number(c.id) === Number(req.companyId));
  if (!companyBillingAllowsAccess(company)) {
    return res.status(402).json({
      error: 'Subscription payment required. Please update billing to restore Dispatcher365 access.',
      billingStatus: company?.billingStatus || 'payment_required'
    });
  }
  next();
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
const loadCompatibilityRules = {
  container: {
    power: ['tractor', 'day_cab', 'sleeper_cab'],
    trailer: ['container_chassis'],
    label: 'Container / port drayage'
  },
  flatbed: {
    power: ['tractor', 'day_cab', 'sleeper_cab', 'hotshot_truck', 'pickup_truck'],
    trailer: ['flatbed', 'step_deck', 'double_drop', 'conestoga', 'lowboy', 'gooseneck', 'curtain_side'],
    label: 'Flatbed / open deck'
  },
  dry_van: {
    power: ['tractor', 'day_cab', 'sleeper_cab', 'straight_truck', 'box_truck'],
    trailer: ['dry_van', 'reefer', 'liftgate_trailer'],
    label: 'Dry van / enclosed'
  },
  straight_truck: {
    power: ['straight_truck', 'box_truck'],
    trailer: [],
    label: 'Straight truck / box truck'
  },
  sprinter_van: {
    power: ['sprinter_van', 'cargo_van'],
    trailer: [],
    label: 'Sprinter van / cargo van'
  }
};
const loadDocumentRequirements = {
  dry_van: ['bol', 'pod'],
  container: ['delivery_order', 'port_pickup_proof', 'container_photo', 'seal_photo', 'empty_return_proof'],
  flatbed: ['securement_photo', 'signed_bol', 'pod'],
  straight_truck: ['pod', 'signature'],
  sprinter_van: ['pod', 'signature']
};
const publicDocumentTypes = new Set(['bol', 'signed_bol', 'pod', 'proof', 'delivery', 'receipt', 'delivery_order', 'port_pickup_proof', 'container_photo', 'seal_photo', 'empty_return_proof', 'securement_photo', 'tarp_photo']);
const defaultPublicDocumentTypes = ['bol', 'signed_bol', 'pod'];
const inactiveLoadStatuses = new Set(['delivered', 'pod_uploaded', 'closed', 'cancelled']);
function isActiveLoad(load) {
  return !inactiveLoadStatuses.has(String(load.status || 'new'));
}
function parseFeet(value) {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}
function hasHeavyLicense(driver) {
  const license = String(driver?.licenseClass || '').toUpperCase();
  return license === 'A' || license.includes('AZ') || license.includes('CLASS A') || license.includes('CDL-A') || license.includes('CDL A');
}
function requiresHeavyLicense(payload, power, trailer) {
  if (['container', 'flatbed'].includes(payload.loadType)) return true;
  return ['tractor', 'day_cab', 'sleeper_cab'].includes(power?.type) || Boolean(trailer);
}
function loadDetailPayload(body) {
  let extraStops = [];
  try {
    const parsed = JSON.parse(body.extraStops || '[]');
    if (Array.isArray(parsed)) {
      extraStops = parsed.slice(0, 12).map((stop, index) => ({
        id: String(stop.id || `stop-${index + 1}`),
        type: ['pickup', 'delivery'].includes(String(stop.type || '').toLowerCase()) ? String(stop.type).toLowerCase() : 'delivery',
        name: String(stop.name || '').trim(),
        address: String(stop.address || '').trim(),
        appointment: String(stop.appointment || '').trim(),
        contactName: String(stop.contactName || '').trim(),
        phone: String(stop.phone || '').trim(),
        notes: String(stop.notes || '').trim()
      })).filter(stop => stop.name || stop.address);
    }
  } catch {}
  return {
    hazmatRequired: body.hazmatRequired === true || body.hazmatRequired === 'true',
    temperatureControlled: body.temperatureControlled === true || body.temperatureControlled === 'true',
    generalLiftgateRequired: body.generalLiftgateRequired === true || body.generalLiftgateRequired === 'true',
    containerNumber: String(body.containerNumber || '').trim(),
    containerSize: String(body.containerSize || '').trim(),
    portTerminal: String(body.portTerminal || '').trim(),
    returnTerminal: String(body.returnTerminal || '').trim(),
    sealNumber: String(body.sealNumber || '').trim(),
    lastFreeDay: String(body.lastFreeDay || '').trim(),
    containerNotes: String(body.containerNotes || '').trim(),
    freightDimensions: String(body.freightDimensions || '').trim(),
    loadingMethod: String(body.loadingMethod || '').trim(),
    tarpRequired: String(body.tarpRequired || '').trim(),
    securement: String(body.securement || '').trim(),
    flatbedNotes: String(body.flatbedNotes || '').trim(),
    palletCount: String(body.palletCount || '').trim(),
    cartonCount: String(body.cartonCount || '').trim(),
    sealRequired: String(body.sealRequired || '').trim(),
    temperatureRequirement: String(body.temperatureRequirement || '').trim(),
    dryVanNotes: String(body.dryVanNotes || '').trim(),
    liftgateRequired: String(body.liftgateRequired || '').trim(),
    palletJackRequired: String(body.palletJackRequired || '').trim(),
    accessLimits: String(body.accessLimits || '').trim(),
    insideDelivery: String(body.insideDelivery || '').trim(),
    straightTruckNotes: String(body.straightTruckNotes || '').trim(),
    maxPieceDimensions: String(body.maxPieceDimensions || '').trim(),
    floorLoaded: String(body.floorLoaded || '').trim(),
    vanPieceCount: String(body.vanPieceCount || '').trim(),
    expediteService: String(body.expediteService || '').trim(),
    sprinterNotes: String(body.sprinterNotes || '').trim(),
    extraStops
  };
}
function loadPayload(body) {
  const loadType = loadCompatibilityRules[body.loadType] ? body.loadType : 'dry_van';
  return {
    loadNumber: String(body.loadNumber || '').trim(),
    loadType,
    loadDetails: loadDetailPayload(body),
    customer: body.customer || '',
    broker: body.broker || '',
    referenceNumber: body.referenceNumber || '',
    pickupName: body.pickupName || '',
    pickupAddress: body.pickupAddress || '',
    pickupAppointment: body.pickupAppointment || null,
    pickupContactName: body.pickupContactName || '',
    pickupPhone: body.pickupPhone || '',
    pickupHours: body.pickupHours || '',
    pickupDockType: body.pickupDockType || '',
    pickupSiteNotes: body.pickupSiteNotes || '',
    deliveryName: body.deliveryName || '',
    deliveryAddress: body.deliveryAddress || '',
    deliveryAppointment: body.deliveryAppointment || null,
    deliveryContactName: body.deliveryContactName || '',
    deliveryPhone: body.deliveryPhone || '',
    deliveryHours: body.deliveryHours || '',
    deliveryDockType: body.deliveryDockType || '',
    deliverySiteNotes: body.deliverySiteNotes || '',
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
function equipmentName(vehicle) {
  return vehicle ? `${vehicle.unitNumber || 'Unit'} (${String(vehicle.type || '').replaceAll('_', ' ')})` : 'Unassigned equipment';
}
async function validateLoadCompatibility(companyId, payload) {
  const rule = loadCompatibilityRules[payload.loadType] || loadCompatibilityRules.dry_van;
  const [vehicles, drivers, loads] = await Promise.all([
    db.getVehicles(companyId),
    db.getDrivers(companyId),
    db.getLoads(companyId)
  ]);
  const power = payload.vehicleId ? vehicles.find(v => Number(v.id) === Number(payload.vehicleId)) : null;
  const trailer = payload.trailerId ? vehicles.find(v => Number(v.id) === Number(payload.trailerId)) : null;
  const driver = payload.driverId ? drivers.find(d => Number(d.id) === Number(payload.driverId)) : null;
  if (power && !rule.power.includes(power.type)) {
    throw new Error(`${equipmentName(power)} is not compatible with ${rule.label} loads.`);
  }
  if (trailer && !rule.trailer.includes(trailer.type)) {
    throw new Error(`${equipmentName(trailer)} is not compatible with ${rule.label} loads.`);
  }
  if (!rule.trailer.length && trailer) {
    throw new Error(`${rule.label} loads should not have trailer equipment assigned.`);
  }
  if (driver) {
    if (driver.status !== 'active') throw new Error(`${driver.firstName || 'Driver'} ${driver.lastName || ''}`.trim() + ' is not active.');
    const activeDriverLoad = loads.find(load => isActiveLoad(load) && Number(load.id) !== Number(payload.id) && Number(load.driverId) === Number(driver.id));
    if (activeDriverLoad) throw new Error(`${driver.firstName || 'Driver'} ${driver.lastName || ''}`.trim() + ` is already assigned to active load ${activeDriverLoad.loadNumber}.`);
    if (requiresHeavyLicense(payload, power, trailer) && !hasHeavyLicense(driver)) throw new Error(`${driver.firstName || 'Driver'} ${driver.lastName || ''}`.trim() + ' needs an AZ/Class A license for this load.');
  }
  for (const unit of [power, trailer].filter(Boolean)) {
    if (unit.status === 'out_of_service') throw new Error(`${equipmentName(unit)} is out of service.`);
    const activeUnitLoad = loads.find(load => isActiveLoad(load) && Number(load.id) !== Number(payload.id) && (Number(load.vehicleId) === Number(unit.id) || Number(load.trailerId) === Number(unit.id)));
    if (activeUnitLoad) throw new Error(`${equipmentName(unit)} is already assigned to active load ${activeUnitLoad.loadNumber}.`);
  }
  const limits = [power?.maxWeight, trailer?.maxWeight].filter(value => Number(value) > 0).map(Number);
  const maxAllowedWeight = limits.length ? Math.min(...limits) : null;
  if (maxAllowedWeight && Number(payload.weight || 0) > maxAllowedWeight) {
    throw new Error(`Load weight exceeds equipment limit of ${maxAllowedWeight.toLocaleString()}.`);
  }
  const freightLength = parseFeet(payload.loadDetails.freightDimensions || payload.loadDetails.maxPieceDimensions);
  const unitLengths = [power?.length, trailer?.length].map(parseFeet).filter(Number.isFinite);
  const maxLength = unitLengths.length ? Math.max(...unitLengths) : null;
  if (freightLength && maxLength && freightLength > maxLength) throw new Error(`Freight length exceeds available equipment length of ${maxLength} ft.`);
  const needsHazmat = Boolean(payload.loadDetails.hazmatRequired);
  if (needsHazmat && ![power, trailer].filter(Boolean).some(unit => unit.hazmatCapable)) throw new Error('Hazmat load requires hazmat-capable equipment.');
  const tempText = String(payload.loadDetails.temperatureRequirement || '').trim().toLowerCase();
  const needsTemp = Boolean(payload.loadDetails.temperatureControlled) || (tempText && !['ambient', 'none', 'n/a', 'na'].includes(tempText));
  if (needsTemp && ![power, trailer].filter(Boolean).some(unit => unit.temperatureCapable)) throw new Error('Temperature-controlled freight requires temperature-capable equipment.');
  const needsLiftgate = payload.loadDetails.generalLiftgateRequired || String(payload.loadDetails.liftgateRequired || '').toLowerCase() === 'yes' || payload.deliveryDockType === 'tailgate';
  if (needsLiftgate && ![power, trailer].filter(Boolean).some(unit => unit.liftgate)) throw new Error('Liftgate service requires liftgate-capable equipment.');
}
function loadMissingRequiredDocs(load) {
  const required = loadDocumentRequirements[load.loadType || 'dry_van'] || loadDocumentRequirements.dry_van;
  const present = new Set((load.documents || []).map(doc => String(doc.type || '').toLowerCase()));
  return required.filter(type => !present.has(type));
}
function validateLoadCloseRequirements(load, status) {
  if (!['delivered', 'pod_uploaded', 'closed'].includes(status)) return;
  const missing = loadMissingRequiredDocs(load);
  if (missing.length) {
    throw new Error(`Required proof missing before ${status.replaceAll('_', ' ')}: ${missing.map(type => type.replaceAll('_', ' ')).join(', ')}.`);
  }
}
function publicLoadPayload(load) {
  if (!load) return null;
  const visibleDocTypes = new Set(Array.isArray(load.loadDetails?.publicDocumentTypes) ? load.loadDetails.publicDocumentTypes : defaultPublicDocumentTypes);
  const { customerEmail, customerPhone, publicDocumentTypes: _publicDocumentTypes, ...publicLoadDetails } = load.loadDetails || {};
  return {
    loadNumber: load.loadNumber,
    loadType: load.loadType,
    loadDetails: publicLoadDetails,
    companyName: load.companyName || '',
    companyCode: load.companyCode || '',
    customer: load.customer,
    referenceNumber: load.referenceNumber,
    pickupName: load.pickupName,
    pickupAddress: load.pickupAddress,
    pickupAppointment: load.pickupAppointment,
    deliveryName: load.deliveryName,
    deliveryAddress: load.deliveryAddress,
    deliveryAppointment: load.deliveryAppointment,
    extraStops: Array.isArray(load.loadDetails?.extraStops) ? load.loadDetails.extraStops : [],
    commodity: load.commodity,
    pieces: load.pieces,
    status: load.status,
    updatedAt: load.updatedAt,
    events: (load.events || []).map(event => ({
      status: event.status,
      note: event.note || '',
      at: event.at
    })),
    documents: (load.documents || [])
      .filter(doc => publicDocumentTypes.has(String(doc.type || '').toLowerCase()))
      .filter(doc => visibleDocTypes.has(String(doc.type || '').toLowerCase()))
      .map(doc => ({
        type: doc.type || 'document',
        note: doc.note || '',
        url: doc.url,
        uploadedAt: doc.uploadedAt
      }))
  };
}
function demoPublicLoad(token) {
  const normalized = String(token || '').trim().toLowerCase();
  const demoIds = new Set(['demo0001-2026-000777', 'd365-demo-orlando', 'orlando-demo']);
  if (!demoIds.has(normalized)) return null;
  const createdAt = '2026-05-04T09:00:00-04:00';
  const deliveredAt = '2026-05-04T14:00:00-04:00';
  return {
    loadNumber: 'DEMO0001-2026-000777',
    loadType: 'straight_truck',
    loadDetails: { palletCount: '2', cartonCount: '30', liftgateRequired: 'No', publicDocumentTypes: ['pod'] },
    companyName: 'Dispatcher365 Demo Fleet',
    companyCode: 'DEMO0001',
    customer: 'Demo Customer',
    referenceNumber: 'ORLANDO-35',
    pickupName: 'Dispatcher365 Demo Warehouse',
    pickupAddress: 'Demo pickup location',
    pickupAppointment: createdAt,
    deliveryName: '35 Orlando Drive',
    deliveryAddress: '35 Orlando Drive, St. Catharines, Ontario',
    deliveryAppointment: deliveredAt,
    commodity: 'General freight',
    pieces: '2 pallets / 30 cartons',
    status: 'delivered',
    updatedAt: deliveredAt,
    events: [
      { status: 'assigned', note: 'Demo shipment assigned to driver.', at: createdAt },
      { status: 'en_route_pickup', note: 'Driver en route to pickup.', at: '2026-05-04T09:30:00-04:00' },
      { status: 'picked_up', note: 'Pickup confirmed: 2 pallets, 30 cartons.', at: '2026-05-04T10:15:00-04:00' },
      { status: 'in_transit', note: 'Shipment in transit to St. Catharines.', at: '2026-05-04T11:00:00-04:00' },
      { status: 'at_delivery', note: 'Driver arrived at 35 Orlando Drive.', at: '2026-05-04T13:45:00-04:00' },
      { status: 'delivered', note: 'Delivered May 4 at 2:00 PM.', at: deliveredAt }
    ],
    documents: [
      { type: 'pod', note: 'Demo proof of delivery uploaded.', url: '', uploadedAt: deliveredAt },
      { type: 'signature', note: 'Demo receiver signature captured.', uploadedAt: deliveredAt }
    ]
  };
}
function escHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}
function bolDate(value) {
  return value ? new Date(value).toLocaleString() : '';
}
function renderInspectionHtml(inspection, company, driver, vehicle) {
  const failed = (inspection.itemResults || []).filter(item => item.result === 'fail');
  const rows = (inspection.itemResults || []).map(item => `
    <tr>
      <td>${escHtml(item.item)}</td>
      <td>${escHtml(String(item.result || '').toUpperCase())}</td>
      <td>${escHtml(item.notes || '')}</td>
    </tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8" /><title>Inspection ${escHtml(inspection.id)}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#111;margin:24px}.sheet{max-width:900px;margin:auto}.head{display:flex;justify-content:space-between;border-bottom:3px solid #111;padding-bottom:12px;margin-bottom:18px}.brand{font-size:22px;font-weight:800}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.cell{border:1px solid #999;padding:8px;min-height:46px}.label{font-size:10px;text-transform:uppercase;color:#555;display:block;margin-bottom:4px}.value{font-weight:700}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #999;padding:7px;text-align:left}th{background:#eee}.status{display:inline-block;border:1px solid #111;padding:5px 9px;text-transform:uppercase;font-weight:700}.sig{border:1px solid #111;min-height:74px;padding:8px;margin-top:18px}.muted{color:#666;font-weight:400}@media print{body{margin:0}.sheet{max-width:none}}
  </style></head><body><main class="sheet">
    <section class="head"><div><div class="brand">${escHtml(company?.name || 'Dispatcher365')}</div><div>Driver Vehicle Inspection Report</div></div><div class="status">${escHtml(inspection.overallStatus || '')}</div></section>
    <section class="grid">
      <div class="cell"><span class="label">Inspection ID</span><div class="value">#${escHtml(inspection.id)}</div></div>
      <div class="cell"><span class="label">Inspection Time</span><div class="value">${escHtml(bolDate(inspection.inspectionTime))}</div></div>
      <div class="cell"><span class="label">Odometer</span><div class="value">${Number(inspection.odometer || 0).toLocaleString()}</div></div>
      <div class="cell"><span class="label">Driver</span><div class="value">${escHtml(`${driver?.firstName || ''} ${driver?.lastName || ''}`.trim())}</div></div>
      <div class="cell"><span class="label">Vehicle</span><div class="value">${escHtml(vehicle?.unitNumber || '')}</div></div>
      <div class="cell"><span class="label">Failed Items</span><div class="value">${failed.length}</div></div>
    </section>
    <table><thead><tr><th>Item</th><th>Result</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>
    <section class="sig"><span class="label">Driver Electronic Certification</span><div class="value">${escHtml(inspection.signatureName || `${driver?.firstName || ''} ${driver?.lastName || ''}`.trim())}</div><div class="muted">Signed ${escHtml(bolDate(inspection.signedAt || inspection.inspectionTime))}</div><p class="muted">I certify this inspection was completed and reported accurately.</p></section>
    ${inspection.notes ? `<p><strong>General notes:</strong> ${escHtml(inspection.notes)}</p>` : ''}
  </main></body></html>`;
}
function loadDocumentSignatures(load) {
  return (load.documents || []).filter(doc => String(doc.type || '').toLowerCase() === 'signature');
}
function renderBolHtml(load, company, driver, vehicle, trailer) {
  const signatures = loadDocumentSignatures(load);
  const latestSignature = signatures[signatures.length - 1] || null;
  const freightTerms = load.rate ? 'Prepaid' : 'Collect / 3rd Party';
  const totalPieces = load.pieces || '';
  const totalWeight = load.weight ? `${Number(load.weight).toLocaleString()} lb` : '';
  const handlingUnit = trailer ? `${trailer.unitNumber} / ${trailer.type || 'Trailer'}` : vehicle?.unitNumber || '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VICS BOL ${escHtml(load.loadNumber)} | Dispatcher365</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#111;background:#f4f6f8}
    .bol-page{width:8.5in;min-height:11in;margin:24px auto;padding:.35in;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.18)}
    h1{font-size:20px;margin:0;text-align:center;letter-spacing:.04em}
    .top{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end;margin-bottom:8px}
    .brand{font-size:12px;color:#444}.bol-number{text-align:right;font-size:12px}.bol-number strong{display:block;font-size:18px;color:#000}
    .box{border:1px solid #111;margin-top:8px}.box h2{margin:0;padding:5px 7px;font-size:11px;background:#e8edf3;border-bottom:1px solid #111;text-transform:uppercase;letter-spacing:.03em}
    .grid-2{display:grid;grid-template-columns:1fr 1fr}.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr}
    .cell{padding:7px;min-height:54px;border-right:1px solid #111}.cell:last-child{border-right:0}
    .label{display:block;font-size:9px;text-transform:uppercase;color:#555;margin-bottom:4px}.value{font-size:12px;white-space:pre-wrap}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #111;padding:5px;font-size:11px;text-align:left;vertical-align:top}th{background:#e8edf3;text-transform:uppercase;font-size:9px}
    .legal{font-size:9px;line-height:1.35;color:#222;padding:7px}
    .signature-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sig-box{border:1px solid #111;min-height:86px;padding:7px}.sig-box img{max-height:42px;max-width:260px}
    .muted{color:#555}.print-actions{width:8.5in;margin:20px auto 0;text-align:right}.print-actions button{padding:10px 14px;border:0;border-radius:6px;background:#2f7dd1;color:#fff;font-weight:700}
    @media print{body{background:#fff}.bol-page{margin:0;box-shadow:none}.print-actions{display:none}}
  </style>
</head>
<body>
  <div class="print-actions"><button onclick="window.print()">Print / Save PDF</button></div>
  <main class="bol-page">
    <div class="top">
      <div class="brand"><strong>Dispatcher365</strong><br>${escHtml(company?.name || 'Company')} ${company?.code ? `(${escHtml(company.code)})` : ''}</div>
      <div class="bol-number"><span>Bill of Lading Number</span><strong>${escHtml(load.loadNumber)}</strong><span>${escHtml(load.publicTrackingToken || '')}</span></div>
    </div>
    <h1>VICS / GS1 US Bill of Lading</h1>
    <section class="box">
      <h2>Ship From / Ship To</h2>
      <div class="grid-2">
        <div class="cell"><span class="label">Ship From</span><div class="value">${escHtml(load.pickupName || company?.name || '')}
${escHtml(load.pickupAddress || '')}
${escHtml(load.pickupContactName || '')} ${escHtml(load.pickupPhone || '')}</div></div>
        <div class="cell"><span class="label">Ship To</span><div class="value">${escHtml(load.deliveryName || load.customer || '')}
${escHtml(load.deliveryAddress || '')}
${escHtml(load.deliveryContactName || '')} ${escHtml(load.deliveryPhone || '')}</div></div>
      </div>
    </section>
    <section class="box">
      <h2>Bill To / Carrier</h2>
      <div class="grid-3">
        <div class="cell"><span class="label">Bill Freight To</span><div class="value">${escHtml(load.broker || load.customer || company?.name || '')}</div></div>
        <div class="cell"><span class="label">Carrier Name / Driver</span><div class="value">${escHtml(company?.name || '')}
${escHtml(driver ? `${driver.firstName || ''} ${driver.lastName || ''}`.trim() : '')}</div></div>
        <div class="cell"><span class="label">Trailer / Seal / Pickup Date</span><div class="value">${escHtml(handlingUnit)}
${escHtml(load.referenceNumber || '')}
${escHtml(bolDate(load.pickupAppointment))}</div></div>
      </div>
    </section>
    <section class="box">
      <h2>Special Instructions</h2>
      <div class="legal">${escHtml([load.pickupHours ? `Pickup hours: ${load.pickupHours}` : '', load.pickupDockType ? `Pickup dock: ${load.pickupDockType}` : '', load.pickupSiteNotes || '', load.deliveryHours ? `Delivery hours: ${load.deliveryHours}` : '', load.deliveryDockType ? `Delivery dock: ${load.deliveryDockType}` : '', load.deliverySiteNotes || '', load.notes || ''].filter(Boolean).join('\n'))}</div>
    </section>
    <section class="box">
      <h2>Customer Order Information</h2>
      <table>
        <thead><tr><th>Customer Order #</th><th>PKGS</th><th>Weight</th><th>Pallet / Slip</th><th>Additional Shipper Info</th></tr></thead>
        <tbody>
          <tr><td>${escHtml(load.referenceNumber || load.loadNumber)}</td><td>${escHtml(totalPieces)}</td><td>${escHtml(totalWeight)}</td><td>${escHtml(trailer ? 'Y' : '')}</td><td>${escHtml(load.customer || '')}</td></tr>
        </tbody>
      </table>
    </section>
    <section class="box">
      <h2>Carrier Information</h2>
      <table>
        <thead><tr><th>Handling Unit Qty</th><th>Package Qty</th><th>Commodity Description</th><th>NMFC #</th><th>Class</th><th>Weight</th><th>Hazmat</th></tr></thead>
        <tbody>
          <tr><td>${escHtml(totalPieces)}</td><td>${escHtml(totalPieces)}</td><td>${escHtml(load.commodity || 'Freight of all kinds')}</td><td></td><td></td><td>${escHtml(totalWeight)}</td><td></td></tr>
        </tbody>
      </table>
    </section>
    <section class="box">
      <h2>COD Amount / Freight Charge Terms</h2>
      <div class="grid-3">
        <div class="cell"><span class="label">COD Amount</span><div class="value"></div></div>
        <div class="cell"><span class="label">Fee Terms</span><div class="value">${escHtml(freightTerms)}</div></div>
        <div class="cell"><span class="label">Load Status</span><div class="value">${escHtml(load.status || 'new')}</div></div>
      </div>
    </section>
    <section class="box">
      <h2>Liability / Receipt</h2>
      <div class="legal">Carrier acknowledges receipt of packages and required placards, if any, from the shipper listed above in apparent good order except as noted. This printable BOL is generated from Dispatcher365 load data and should be reviewed by the shipper/carrier for completeness before use.</div>
    </section>
    <section class="signature-row" style="margin-top:8px">
      <div class="sig-box"><span class="label">Shipper Signature / Date</span><div class="value"></div></div>
      <div class="sig-box"><span class="label">Carrier Signature / Pickup Date</span>${latestSignature?.dataUrl ? `<img src="${escHtml(latestSignature.dataUrl)}" alt="Digital signature" />` : '<div class="value muted">No digital signature captured.</div>'}<div class="value">${escHtml(latestSignature?.signerName || '')} ${latestSignature?.signedAt ? `- ${escHtml(bolDate(latestSignature.signedAt))}` : ''}</div></div>
    </section>
  </main>
</body>
</html>`;
}
function addressPayload(body) {
  const type = String(body.type || 'both');
  return {
    customer: String(body.customer || '').trim(),
    name: String(body.name || '').trim(),
    address: String(body.address || '').trim(),
    type: ['pickup', 'delivery', 'both'].includes(type) ? type : 'both',
    contactName: String(body.contactName || '').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim(),
    hours: String(body.hours || '').trim(),
    dockNotes: String(body.dockNotes || '').trim(),
    notes: String(body.notes || '').trim()
  };
}
function locationHistoryPayload(body) {
  const raw = Array.isArray(body.history) ? body.history : [];
  return raw.slice(-100).map(point => ({
    lat: Number(point.lat),
    lng: Number(point.lng),
    accuracy: point.accuracy == null ? null : Number(point.accuracy),
    timestamp: point.timestamp || new Date().toISOString()
  })).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}
function mapGeoapifySuggestion(item) {
  const formatted = item.formatted || [item.housenumber, item.street, item.city, item.state, item.postcode].filter(Boolean).join(', ');
  return {
    source: 'geoapify',
    name: item.name || item.address_line1 || [item.housenumber, item.street].filter(Boolean).join(' '),
    address: formatted,
    city: item.city || '',
    state: item.state || '',
    postalCode: item.postcode || '',
    country: item.country || '',
    lat: item.lat ?? null,
    lng: item.lon ?? null
  };
}
function canDriverAccessLoad(req, load) {
  return !isDriver(req) || Number(load.driverId) === Number(req.sessionUser.linkedDriverId);
}
function inspectionIsCurrent(inspection, driverId, vehicleId) {
  const inspectedAt = new Date(inspection.inspectionTime || inspection.createdAt || 0).getTime();
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  return Number(inspection.driverId) === Number(driverId)
    && Number(inspection.vehicleId) === Number(vehicleId)
    && inspectedAt >= cutoff
    && !['fail'].includes(String(inspection.overallStatus || '').toLowerCase());
}
async function requireCurrentVehicleInspection(companyId, driverId, vehicleId) {
  const [inspections, vehicles] = await Promise.all([
    db.getInspections(companyId),
    db.getVehicles(companyId)
  ]);
  const vehicle = vehicles.find(item => Number(item.id) === Number(vehicleId));
  if (!vehicle) throw new Error('Assigned vehicle was not found.');
  if (vehicle.status === 'out_of_service') throw new Error(`${vehicle.unitNumber || 'Vehicle'} is out of service and cannot be used for work.`);
  const current = inspections
    .filter(item => inspectionIsCurrent(item, driverId, vehicleId))
    .sort((a, b) => String(b.inspectionTime || '').localeCompare(String(a.inspectionTime || '')))[0];
  if (!current) throw new Error('Complete a pre-trip inspection for this assigned vehicle before becoming ready for work.');
  return current;
}
const driverLoadStatuses = new Set(['accepted', 'en_route_pickup', 'at_pickup', 'picked_up', 'in_transit', 'at_delivery', 'delivered', 'pod_uploaded', 'closed', 'exception']);
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
const stripePricingPlans = {
  starter: {
    name: 'Starter',
    basePriceId: process.env.STRIPE_PRICE_STARTER_BASE,
    driverPriceId: process.env.STRIPE_PRICE_STARTER_DRIVER,
    defaultDrivers: 3
  },
  operations: {
    name: 'Operations',
    basePriceId: process.env.STRIPE_PRICE_OPERATIONS_BASE,
    driverPriceId: process.env.STRIPE_PRICE_OPERATIONS_DRIVER,
    defaultDrivers: 10
  },
  pro: {
    name: 'Pro',
    basePriceId: process.env.STRIPE_PRICE_PRO_BASE,
    driverPriceId: process.env.STRIPE_PRICE_PRO_DRIVER,
    defaultDrivers: 25
  }
};
function requestedOrigin(req) {
  return process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
}
function stripeCheckoutPayload(body) {
  const planKey = String(body.plan || 'operations').toLowerCase();
  const plan = stripePricingPlans[planKey];
  if (!plan) throw new Error('Unknown pricing plan.');
  if (!plan.basePriceId || !plan.driverPriceId) throw new Error(`Stripe price IDs are not configured for ${plan.name}.`);
  const driverQuantity = Math.max(1, Math.min(500, Number(body.driverQuantity) || plan.defaultDrivers));
  return {
    planKey,
    plan,
    driverQuantity,
    customerEmail: String(body.email || '').trim().toLowerCase(),
    companyName: String(body.companyName || '').trim(),
    companyId: Number(body.companyId) || null,
    affiliateCode: normalizeAffiliateCode(body.affiliateCode || body.ref || '')
  };
}
function stripePeriodEnd(subscription) {
  const unix = subscription?.current_period_end;
  return unix ? new Date(unix * 1000).toISOString() : null;
}
async function findCompanyForStripe({ companyId, customerId, subscriptionId, email, companyName }) {
  const companies = await db.getCompanies();
  if (companyId) {
    const match = companies.find(company => Number(company.id) === Number(companyId));
    if (match) return match;
  }
  if (customerId) {
    const match = companies.find(company => company.stripeCustomerId === customerId);
    if (match) return match;
  }
  if (subscriptionId) {
    const match = companies.find(company => company.stripeSubscriptionId === subscriptionId);
    if (match) return match;
  }
  if (email) {
    const users = await db.getUsers(null);
    const user = users.find(item => String(item.email || '').toLowerCase() === String(email).toLowerCase());
    const match = user ? companies.find(company => Number(company.id) === Number(user.companyId)) : null;
    if (match) return match;
  }
  if (companyName) {
    return companies.find(company => String(company.name || '').toLowerCase() === String(companyName).toLowerCase()) || null;
  }
  return null;
}
async function updateCompanyFromStripeSubscription(subscription, fallback = {}) {
  const company = await findCompanyForStripe({
    companyId: subscription.metadata?.companyId || fallback.companyId,
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    subscriptionId: subscription.id,
    email: fallback.email,
    companyName: subscription.metadata?.companyName || fallback.companyName
  });
  if (!company) return null;
  return db.updateCompanyBilling(company.id, {
    billingStatus: subscription.status || fallback.billingStatus || 'active',
    billingPlan: subscription.metadata?.plan || fallback.plan || company.billingPlan || '',
    stripeCustomerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || company.stripeCustomerId || '',
    stripeSubscriptionId: subscription.id || company.stripeSubscriptionId || '',
    subscriptionCurrentPeriodEnd: stripePeriodEnd(subscription)
  });
}
async function handleStripeEvent(event) {
  if (!stripe) return;
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.mode === 'subscription' && session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      await updateCompanyFromStripeSubscription(subscription, {
        companyId: session.metadata?.companyId,
        email: session.customer_details?.email || session.customer_email,
        companyName: session.metadata?.companyName,
        plan: session.metadata?.plan
      });
    }
    return;
  }
  if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    await updateCompanyFromStripeSubscription(event.data.object);
    return;
  }
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    const company = await findCompanyForStripe({
      customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
      subscriptionId: typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id,
      email: invoice.customer_email
    });
    if (company) await db.updateCompanyBilling(company.id, { billingStatus: 'past_due' });
    return;
  }
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await updateCompanyFromStripeSubscription(subscription, { email: invoice.customer_email });
    }
  }
}

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, postgres: !!process.env.DATABASE_URL, uploadsDir: UPLOADS_DIR, superUserConfigured: await db.hasAdminSetup() });
});

app.get('/api/public/billing-config', (_req, res) => {
  res.json({
    stripeConfigured: Boolean(stripe),
    plans: Object.fromEntries(Object.entries(stripePricingPlans).map(([key, plan]) => [key, {
      name: plan.name,
      configured: Boolean(plan.basePriceId && plan.driverPriceId),
      defaultDrivers: plan.defaultDrivers
    }]))
  });
});

app.post('/api/public/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY and Price IDs in Railway.' });
    const payload = stripeCheckoutPayload(req.body);
    if (payload.affiliateCode) {
      const affiliate = await db.findAffiliateByCode(payload.affiliateCode);
      if (!affiliate || affiliate.status !== 'active') return res.status(400).json({ error: 'Affiliate code was not found. Remove the referral code or ask the affiliate for a fresh link.' });
    }
    const origin = requestedOrigin(req);
    const referralParam = payload.affiliateCode ? `&ref=${encodeURIComponent(payload.affiliateCode)}` : '';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: payload.customerEmail || undefined,
      client_reference_id: payload.companyId ? String(payload.companyId) : payload.companyName || undefined,
      line_items: [
        { price: payload.plan.basePriceId, quantity: 1 },
        { price: payload.plan.driverPriceId, quantity: payload.driverQuantity }
      ],
      payment_method_collection: 'always',
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: STRIPE_TRIAL_DAYS,
        metadata: {
          plan: payload.planKey,
          companyId: payload.companyId ? String(payload.companyId) : '',
          companyName: payload.companyName,
          driverQuantity: String(payload.driverQuantity),
          affiliateCode: payload.affiliateCode
        }
      },
      metadata: {
        plan: payload.planKey,
        companyId: payload.companyId ? String(payload.companyId) : '',
        companyName: payload.companyName,
        driverQuantity: String(payload.driverQuantity),
        affiliateCode: payload.affiliateCode,
        trialDays: String(STRIPE_TRIAL_DAYS)
      },
      success_url: process.env.STRIPE_SUCCESS_URL || `${origin}/signup?payment=success&session_id={CHECKOUT_SESSION_ID}${referralParam}`,
      cancel_url: process.env.STRIPE_CANCEL_URL || `${origin}/signup?payment=cancelled${referralParam}`
    });
    res.json({ ok: true, url: session.url });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to start Stripe checkout.' });
  }
});

app.post('/api/public/affiliates', async (req, res) => {
  try {
    const payload = affiliatePayload(req.body);
    validateAffiliate(payload);
    const affiliate = await db.createAffiliate({
      ...payload,
      status: 'active',
      commissionRate: 25
    });
    await notify(null, {
      audience: 'super_user',
      type: 'affiliate_signup',
      severity: 'info',
      title: 'New affiliate partner joined',
      message: `${affiliate.firstName} ${affiliate.lastName} can now promote Dispatcher365 with code ${affiliate.code}.`,
      link: '#affiliates',
      metadata: { affiliateId: affiliate.id, affiliateCode: affiliate.code }
    });
    res.json({ ok: true, affiliate });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create affiliate account.' });
  }
});

app.get('/api/public/affiliate/:code', async (req, res) => {
  const affiliate = await db.findAffiliateByCode(req.params.code);
  if (!affiliate || affiliate.status !== 'active') return res.status(404).json({ error: 'Affiliate code was not found.' });
  res.json({
    ok: true,
    affiliate: {
      code: affiliate.code,
      name: `${affiliate.firstName || ''} ${affiliate.lastName || ''}`.trim(),
      companyName: affiliate.companyName || ''
    }
  });
});

app.post('/api/public/signup', async (req, res) => {
  try {
    const payload = signupPayload(req.body);
    validateSignup(payload);
    const existing = await db.findUserByEmail(payload.email);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    const affiliate = payload.affiliateCode ? await db.findAffiliateByCode(payload.affiliateCode) : null;
    if (payload.affiliateCode && (!affiliate || affiliate.status !== 'active')) {
      return res.status(400).json({ error: 'Affiliate code was not found. Remove the referral code or ask the affiliate for a fresh link.' });
    }

    const company = await db.createCompany({
      name: payload.companyName,
      code: companyCodeFromName(payload.companyName),
      status: 'pending',
      billingStatus: 'payment_required',
      billingPlan: payload.plan,
      affiliateCode: affiliate?.code || payload.affiliateCode || ''
    });
    await db.createUser({
      companyId: company.id,
      email: payload.email,
      password: payload.password,
      role: 'admin',
      firstName: payload.firstName,
      lastName: payload.lastName,
      isActive: false
    });
    if (affiliate) {
      await db.createAffiliateReferral({
        affiliateId: affiliate.id,
        affiliateCode: affiliate.code,
        companyId: company.id,
        companyName: company.name,
        plan: payload.plan,
        driverQuantity: payload.driverQuantity,
        status: 'signup_submitted',
        commissionRate: 25,
        estimatedMonthlyCommission: affiliateCommissionEstimate(payload.plan, payload.driverQuantity)
      });
      await notify(null, {
        audience: 'super_user',
        type: 'affiliate_referral',
        severity: 'info',
        title: 'Affiliate referred a company',
        message: `${affiliate.code} referred ${company.name}.`,
        link: '#affiliates',
        metadata: { affiliateId: affiliate.id, affiliateCode: affiliate.code, companyId: company.id }
      });
    }
    await notify(null, {
      audience: 'super_user',
      type: 'company_signup',
      severity: 'warning',
      title: 'New company signup needs approval',
      message: `${company.name} submitted a workspace request for ${payload.firstName} ${payload.lastName}.`,
      link: '#companies',
      metadata: { companyId: company.id, companyName: company.name, adminEmail: payload.email }
    });
    res.json({ ok: true, company, pendingApproval: true, message: 'Your company workspace request has been submitted. A super admin must approve the company and billing must be active before login is enabled.' });
  } catch (error) {
    res.status(400).json({ error: publicSignupError(error) });
  }
});

app.get('/api/affiliates', auth, superOnly, async (_req, res) => {
  const [affiliates, referrals, companies] = await Promise.all([
    db.getAffiliates(),
    db.getAffiliateReferrals(),
    db.getCompanies()
  ]);
  const companyById = new Map(companies.map(company => [Number(company.id), company]));
  const enrichedReferrals = referrals.map(referral => {
    const company = companyById.get(Number(referral.companyId));
    return {
      ...referral,
      companyStatus: company?.status || referral.status,
      billingStatus: company?.billingStatus || '',
      companyCode: company?.code || ''
    };
  });
  res.json({ affiliates, referrals: enrichedReferrals });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await db.findUserByEmail(email);
  if (!user || user.isActive === false || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  try {
    await ensureApprovedCompanyForLogin(user);
  } catch (error) {
    return res.status(403).json({ error: error.message });
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
      validatePassword(req.body.adminPassword, 'Initial admin password');
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
app.patch('/api/companies/:id/status', auth, superOnly, async (req, res) => {
  try {
    const status = String(req.body.status || '').trim();
    if (!['active', 'pending', 'inactive'].includes(status)) return res.status(400).json({ error: 'Invalid company status' });
    const company = await db.updateCompanyStatus(Number(req.params.id), status);
    if (status === 'active') {
      await notify(company.id, {
        audience: 'admin',
        type: 'company_approved',
        severity: 'success',
        title: 'Company workspace approved',
        message: `${company.name} is active. Admin users can now log in and add drivers.`,
        link: '#adminHome',
        metadata: { companyId: company.id, companyName: company.name }
      });
    }
    res.json(company);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to update company status' });
  }
});
app.patch('/api/companies/:id/billing', auth, superOnly, async (req, res) => {
  try {
    const allowed = new Set(['active', 'trialing', 'payment_required', 'past_due', 'unpaid', 'canceled', 'suspended']);
    const billingStatus = String(req.body.billingStatus || '').trim().toLowerCase();
    if (billingStatus && !allowed.has(billingStatus)) return res.status(400).json({ error: 'Invalid billing status' });
    const company = await db.updateCompanyBilling(Number(req.params.id), {
      billingStatus: billingStatus || undefined,
      billingPlan: req.body.billingPlan,
      stripeCustomerId: req.body.stripeCustomerId,
      stripeSubscriptionId: req.body.stripeSubscriptionId,
      subscriptionCurrentPeriodEnd: req.body.subscriptionCurrentPeriodEnd || null
    });
    res.json(company);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to update billing' });
  }
});

app.get('/api/users', auth, companyAdminOnly, requireCompanyScope, async (req, res) => res.json(await db.getUsers(req.companyId)));
app.post('/api/users', auth, companyAdminOnly, requireCompanyScope, async (req, res) => {
  try {
    const role = String(req.body.role || 'support_staff');
    if (!['admin', 'support_staff'].includes(role) && req.sessionUser.role !== 'super_user') {
      return res.status(400).json({ error: 'Invalid role' });
    }
    validatePassword(req.body.password);
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
    const createLogin = req.body.createLogin === true || req.body.createLogin === 'true';
    if (createLogin) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(req.body.email || '').trim())) throw new Error('Valid driver email is required to create a login.');
      validatePassword(req.body.userPassword, 'Driver password');
    }
    const driver = await db.createDriver(req.companyId, {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone || '',
      email: req.body.email || '',
      licenseNumber: req.body.licenseNumber || '',
      licenseClass: req.body.licenseClass || '',
      licenseExpiry: req.body.licenseExpiry || '',
      status: req.body.status || 'active',
      createLogin,
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
      imageKey: req.body.imageKey || req.body.type || '',
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
    await requireCurrentVehicleInspection(req.companyId, driverId, vehicleId);
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
    const driver = await db.updateDriverLocation(req.companyId, driverId, lat, lng, true, locationHistoryPayload(req.body));
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
app.get('/inspection/:id', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  try {
    const [inspections, companies, drivers, vehicles] = await Promise.all([
      db.getInspections(req.companyId),
      db.getCompanies(),
      db.getDrivers(req.companyId),
      db.getVehicles(req.companyId)
    ]);
    const inspection = inspections.find(i => Number(i.id) === Number(req.params.id));
    if (!inspection) return res.status(404).send('Inspection not found');
    if (isDriver(req) && Number(inspection.driverId) !== Number(req.sessionUser.linkedDriverId)) return res.status(403).send('Drivers can only view their own inspections');
    const company = companies.find(c => Number(c.id) === Number(req.companyId));
    const driver = drivers.find(d => Number(d.id) === Number(inspection.driverId));
    const vehicle = vehicles.find(v => Number(v.id) === Number(inspection.vehicleId));
    res.type('html').send(renderInspectionHtml(inspection, company, driver, vehicle));
  } catch (error) {
    res.status(400).send(error.message || 'Unable to generate inspection report');
  }
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
      photos,
      signatureName: `${req.sessionUser.firstName || ''} ${req.sessionUser.lastName || ''}`.trim() || req.sessionUser.email,
      signatureDataUrl: String(req.body.signatureDataUrl || '')
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
app.get('/api/address-suggestions', auth, staffOnly, requireCompanyScope, async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 3) return res.json({ configured: !!GEOAPIFY_API_KEY, suggestions: [] });
    if (!GEOAPIFY_API_KEY) return res.json({ configured: false, suggestions: [] });
    const params = new URLSearchParams({
      text: query,
      format: 'json',
      limit: '6',
      filter: 'countrycode:us,ca',
      apiKey: GEOAPIFY_API_KEY
    });
    const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'DriverFleetManagement/1.0' }
    });
    if (!response.ok) throw new Error('Address lookup service unavailable');
    const body = await response.json();
    res.json({ configured: true, suggestions: (body.results || []).map(mapGeoapifySuggestion).filter(item => item.address) });
  } catch (error) {
    res.status(502).json({ error: error.message || 'Unable to search addresses' });
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
    if (issue.status === 'closed' && issue.vehicleId) {
      const remaining = (await db.getIssues(req.companyId)).filter(item => item.status !== 'closed' && Number(item.vehicleId) === Number(issue.vehicleId));
      if (!remaining.length) await db.updateVehicleStatus(req.companyId, issue.vehicleId, 'active');
    }
    await notify(req.companyId, {
      audience: 'staff',
      type: 'maintenance_issue',
      severity: issue.status === 'closed' ? 'success' : 'warning',
      title: `Defect ${issue.status === 'closed' ? 'closed' : 'updated'}`,
      message: req.body.resolutionNotes || issue.description || 'Maintenance issue updated.',
      link: '#maintenance',
      metadata: { issueId: issue.id, vehicleId: issue.vehicleId, status: issue.status }
    });
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
    await validateLoadCompatibility(req.companyId, payload);
    const load = await db.createLoad(req.companyId, payload, req.sessionUser);
    await notify(req.companyId, {
      audience: 'dispatcher',
      type: load.driverId ? 'load_assigned' : 'load_created',
      severity: load.driverId ? 'success' : 'info',
      title: load.driverId ? `Load ${load.loadNumber} assigned` : `Load ${load.loadNumber} created`,
      message: `${load.pickupName || load.pickupAddress || 'Pickup'} to ${load.deliveryName || load.deliveryAddress || 'delivery'}${load.pickupAppointment ? `, pickup ${new Date(load.pickupAppointment).toLocaleString()}` : ''}.`,
      link: '#loads',
      metadata: loadNotificationMeta(load)
    });
    if (load.driverId) {
      const users = await db.getUsers(req.companyId);
      const driverUser = users.find(user => Number(user.linkedDriverId) === Number(load.driverId));
      await notify(req.companyId, {
        userId: driverUser?.id || null,
        audience: 'driver',
        type: 'driver_load_assigned',
        severity: 'warning',
        title: `New assigned load ${load.loadNumber}`,
        message: `Pickup: ${load.pickupName || load.pickupAddress || 'Review pickup details'}. Delivery: ${load.deliveryName || load.deliveryAddress || 'Review delivery details'}.`,
        link: '#driverWork',
        metadata: loadNotificationMeta(load)
      });
    }
    res.json(load);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create load' });
  }
});
app.patch('/api/loads/:id/assignment', auth, staffOnly, requireCompanyScope, async (req, res) => {
  try {
    const loads = await db.getLoads(req.companyId);
    const current = loads.find(l => Number(l.id) === Number(req.params.id));
    if (!current) return res.status(404).json({ error: 'Load not found' });
    const payload = {
      ...current,
      driverId: Number(req.body.driverId) || null,
      vehicleId: Number(req.body.vehicleId) || null,
      trailerId: Number(req.body.trailerId) || null
    };
    await validateLoadCompatibility(req.companyId, payload);
    const load = await db.updateLoadAssignment(req.companyId, current.id, payload, req.sessionUser);
    await notify(req.companyId, {
      audience: 'dispatcher',
      type: load.driverId ? 'load_assigned' : 'load_unassigned',
      severity: load.driverId ? 'success' : 'warning',
      title: load.driverId ? `Load ${load.loadNumber} assigned` : `Load ${load.loadNumber} unassigned`,
      message: load.driverId ? `Dispatch board assignment updated for ${load.loadNumber}.` : `${load.loadNumber} is back in the unassigned queue.`,
      link: '#loads',
      metadata: loadNotificationMeta(load)
    });
    if (load.driverId) {
      const users = await db.getUsers(req.companyId);
      const driverUser = users.find(user => Number(user.linkedDriverId) === Number(load.driverId));
      await notify(req.companyId, {
        userId: driverUser?.id || null,
        audience: 'driver',
        type: 'driver_load_assigned',
        severity: 'warning',
        title: `Assigned load ${load.loadNumber}`,
        message: `Pickup: ${load.pickupName || load.pickupAddress || 'Review pickup details'}. Delivery: ${load.deliveryName || load.deliveryAddress || 'Review delivery details'}.`,
        link: '#driverWork',
        metadata: loadNotificationMeta(load)
      });
    }
    res.json(load);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to assign load' });
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
    if (isDriver(req) && status !== 'exception') {
      await requireCurrentVehicleInspection(req.companyId, Number(req.sessionUser.linkedDriverId), Number(load.vehicleId));
    }
    validateLoadCloseRequirements(load, status);
    const updated = await db.updateLoadStatus(req.companyId, load.id, status, req.body.note || '', req.sessionUser);
    if (status && status !== load.status) {
      const importantCustomerStatuses = new Set(['picked_up', 'delivered', 'pod_uploaded', 'closed']);
      await notify(req.companyId, {
        audience: 'dispatcher',
        type: 'load_status',
        severity: ['at_pickup', 'at_delivery'].includes(status) ? 'warning' : 'info',
        title: `Load ${updated.loadNumber} is ${status.replaceAll('_', ' ')}`,
        message: req.body.note || `${req.sessionUser.firstName || req.sessionUser.email} updated the load status.`,
        link: '#loads',
        metadata: loadNotificationMeta(updated)
      });
      if (importantCustomerStatuses.has(status)) {
        await notify(req.companyId, {
          audience: 'staff',
          type: 'customer_update_ready',
          severity: 'success',
          title: `Customer update ready for ${updated.loadNumber}`,
          message: `${updated.customer || 'Customer'} can be notified that the shipment is ${status.replaceAll('_', ' ')}.`,
          link: '#customerTracking',
          metadata: loadNotificationMeta(updated)
        });
      }
    }
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
    await notify(req.companyId, {
      audience: 'staff',
      type: 'load_document',
      severity: ['pod', 'signed_bol', 'bol'].includes(String(req.body.type || '').toLowerCase()) ? 'success' : 'info',
      title: `${String(req.body.type || 'Document').replaceAll('_', ' ')} uploaded for ${updated.loadNumber}`,
      message: `${files.length} file${files.length === 1 ? '' : 's'} uploaded by ${req.sessionUser.firstName || req.sessionUser.email}.`,
      link: '#documents',
      metadata: { ...loadNotificationMeta(updated), documentType: req.body.type || 'bol', fileCount: files.length }
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to upload document' });
  }
});
app.patch('/api/loads/:id/customer-visibility', auth, staffOnly, requireCompanyScope, async (req, res) => {
  try {
    const publicDocumentTypes = Array.isArray(req.body.publicDocumentTypes)
      ? req.body.publicDocumentTypes.map(type => String(type || '').trim().toLowerCase()).filter(Boolean)
      : [];
    const updated = await db.updateLoadPublicSettings(req.companyId, Number(req.params.id), {
      publicDocumentTypes,
      customerEmail: String(req.body.customerEmail || '').trim(),
      customerPhone: String(req.body.customerPhone || '').trim()
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to update customer visibility' });
  }
});
app.post('/api/loads/:id/signature', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  try {
    const loads = await db.getLoads(req.companyId);
    const load = loads.find(l => Number(l.id) === Number(req.params.id));
    if (!load) return res.status(404).json({ error: 'Load not found' });
    if (!canDriverAccessLoad(req, load)) return res.status(403).json({ error: 'Drivers can only sign assigned loads' });
    const dataUrl = String(req.body.signatureDataUrl || '');
    if (!dataUrl.startsWith('data:image/png;base64,')) return res.status(400).json({ error: 'Signature is required' });
    const updated = await db.addLoadDocument(req.companyId, load.id, {
      type: 'signature',
      note: req.body.note || 'Digital BOL signature',
      signerName: String(req.body.signerName || '').trim(),
      signerRole: req.sessionUser.role,
      dataUrl,
      signedAt: new Date().toISOString()
    }, req.sessionUser);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to save signature' });
  }
});
app.get('/bol/:id', auth, requireCompanyScope, requireDriverProfile, async (req, res) => {
  try {
    const [loads, companies, drivers, vehicles] = await Promise.all([
      db.getLoads(req.companyId),
      db.getCompanies(),
      db.getDrivers(req.companyId),
      db.getVehicles(req.companyId)
    ]);
    const load = loads.find(l => Number(l.id) === Number(req.params.id));
    if (!load) return res.status(404).send('Load not found');
    if (!canDriverAccessLoad(req, load)) return res.status(403).send('Drivers can only view BOLs for assigned loads');
    const company = companies.find(c => Number(c.id) === Number(req.companyId));
    const driver = drivers.find(d => Number(d.id) === Number(load.driverId));
    const vehicle = vehicles.find(v => Number(v.id) === Number(load.vehicleId));
    const trailer = vehicles.find(v => Number(v.id) === Number(load.trailerId));
    res.type('html').send(renderBolHtml(load, company, driver, vehicle, trailer));
  } catch (error) {
    res.status(400).send(error.message || 'Unable to generate BOL');
  }
});

app.get('/api/public/loads/:token', async (req, res) => {
  try {
    const load = await db.getPublicLoadByToken(req.params.token) || demoPublicLoad(req.params.token);
    if (!load) return res.status(404).json({ error: 'Tracking link not found' });
    if (!load.companyName && load.companyId) {
      const companies = await db.getCompanies();
      const company = companies.find(item => Number(item.id) === Number(load.companyId));
      if (company) {
        load.companyName = company.name;
        load.companyCode = company.code;
      }
    }
    res.json(publicLoadPayload(load));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to load tracking details' });
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
    await notify(req.companyId, {
      audience: 'staff',
      type: 'bug_report',
      severity: payload.priority === 'urgent' ? 'danger' : payload.priority === 'high' ? 'warning' : 'info',
      title: `New ${payload.priority || 'normal'} bug report`,
      message: `${report.title} reported by ${report.reporterName || req.sessionUser.email}.`,
      link: '#bugReports',
      metadata: { bugReportId: report.id, priority: report.priority, category: report.category }
    });
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

app.get('/api/notifications', auth, requireCompanyScope, async (req, res) => {
  try {
    res.json(await db.getNotifications(req.companyId, req.sessionUser));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to load notifications' });
  }
});
app.get('/api/notification-settings', auth, staffOnly, requireCompanyScope, async (_req, res) => {
  res.json({
    email: {
      configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
      provider: process.env.SMTP_HOST ? 'SMTP' : 'Not configured',
      requiredEnv: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']
    },
    sms: {
      configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM),
      provider: process.env.TWILIO_ACCOUNT_SID ? 'Twilio' : 'Not configured',
      requiredEnv: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM']
    },
    rules: [
      'Driver assigned a load',
      'Pickup or delivery status changed',
      'POD/BOL document uploaded',
      'Maintenance defect opened or closed',
      'New company signup requires super admin approval'
    ]
  });
});
app.patch('/api/notifications/:id/read', auth, requireCompanyScope, async (req, res) => {
  try {
    res.json(await db.markNotificationRead(req.companyId, Number(req.params.id), req.sessionUser));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to update notification' });
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
