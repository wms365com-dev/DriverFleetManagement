const state = {
  user: null,
  companies: [],
  users: [],
  dashboard: null,
  drivers: [],
  vehicles: [],
  assignments: [],
  shifts: [],
  inspections: [],
  issues: [],
  loads: [],
  addresses: [],
  bugReports: [],
  notifications: [],
  selectedCompanyId: null,
  selectedDriverId: null,
  activeView: null,
  toastTimer: null,
  trackingWatch: null,
  trackingTimer: null,
  mapRefreshTimer: null,
  leafletMap: null,
  gpsStatus: 'idle',
  gpsMessage: 'Tap Allow GPS to start location tracking.',
  gpsLastUpdate: null,
  gpsAccuracy: null,
  submitLocks: {},
  addressLookups: {},
  addressLookupTimers: {},
  locationBuffer: [],
  lastServerSyncAt: null
};

const inspectionItems = [
  'Lights', 'Brakes', 'Horn', 'Mirrors', 'Tires', 'Windshield', 'Wipers', 'Fluid Leaks', 'Coupling Equipment', 'Load Securement', 'Documents', 'Safety Equipment'
];
const equipmentTypes = [
  ['tractor', 'Tractor'],
  ['day_cab', 'Day Cab'],
  ['sleeper_cab', 'Sleeper Cab'],
  ['straight_truck', 'Straight Truck'],
  ['box_truck', 'Box Truck'],
  ['cargo_van', 'Cargo Van'],
  ['sprinter_van', 'Sprinter Van'],
  ['pickup_truck', 'Pickup Truck'],
  ['hotshot_truck', 'Hotshot Truck'],
  ['dry_van', 'Dry Van Trailer'],
  ['reefer', 'Reefer Trailer'],
  ['flatbed', 'Flatbed Trailer'],
  ['step_deck', 'Step Deck Trailer'],
  ['double_drop', 'Double Drop Trailer'],
  ['conestoga', 'Conestoga Trailer'],
  ['tanker', 'Tanker'],
  ['dump_trailer', 'Dump Trailer'],
  ['container_chassis', 'Container Chassis'],
  ['gooseneck', 'Gooseneck'],
  ['lowboy', 'Lowboy'],
  ['car_hauler', 'Car Hauler'],
  ['curtain_side', 'Curtain Side'],
  ['liftgate_trailer', 'Liftgate Trailer'],
  ['other', 'Other']
];
const equipmentCatalog = [
  { key: 'freightliner-cascadia', type: 'sleeper_cab', category: 'power_unit', year: 2026, make: 'Freightliner', model: 'Cascadia', label: 'Freightliner Cascadia Sleeper', color: '#2f7dd1' },
  { key: 'volvo-vnl', type: 'sleeper_cab', category: 'power_unit', year: 2026, make: 'Volvo', model: 'VNL', label: 'Volvo VNL Sleeper', color: '#26a978' },
  { key: 'kenworth-t680', type: 'sleeper_cab', category: 'power_unit', year: 2025, make: 'Kenworth', model: 'T680', label: 'Kenworth T680 Sleeper', color: '#f2a93b' },
  { key: 'peterbilt-579', type: 'sleeper_cab', category: 'power_unit', year: 2025, make: 'Peterbilt', model: '579', label: 'Peterbilt 579 Sleeper', color: '#e95f6f' },
  { key: 'international-lt', type: 'day_cab', category: 'power_unit', year: 2025, make: 'International', model: 'LT', label: 'International LT Day Cab', color: '#7c6be8' },
  { key: 'mack-anthem', type: 'tractor', category: 'power_unit', year: 2025, make: 'Mack', model: 'Anthem', label: 'Mack Anthem Tractor', color: '#3aa8a1' },
  { key: 'hino-268-box', type: 'box_truck', category: 'power_unit', year: 2024, make: 'Hino', model: '268 Box Truck', label: 'Hino 268 Box Truck', color: '#4f8bd8' },
  { key: 'ford-transit', type: 'cargo_van', category: 'power_unit', year: 2024, make: 'Ford', model: 'Transit', label: 'Ford Transit Cargo Van', color: '#5d7892' },
  { key: 'mercedes-sprinter', type: 'sprinter_van', category: 'power_unit', year: 2024, make: 'Mercedes-Benz', model: 'Sprinter', label: 'Mercedes-Benz Sprinter', color: '#8a98a8' },
  { key: 'ford-f550-hotshot', type: 'hotshot_truck', category: 'power_unit', year: 2024, make: 'Ford', model: 'F-550 Hotshot', label: 'Ford F-550 Hotshot', color: '#d97941' },
  { key: 'great-dane-dry-van', type: 'dry_van', category: 'trailer', year: 2025, make: 'Great Dane', model: 'Champion 53 ft', label: 'Great Dane Dry Van', color: '#9aa7b4' },
  { key: 'utility-reefer', type: 'reefer', category: 'trailer', year: 2025, make: 'Utility', model: '3000R Reefer', label: 'Utility Reefer Trailer', color: '#2dbbb2' },
  { key: 'fontaine-flatbed', type: 'flatbed', category: 'trailer', year: 2024, make: 'Fontaine', model: 'Revolution Flatbed', label: 'Fontaine Flatbed', color: '#c99342' },
  { key: 'trail-king-lowboy', type: 'lowboy', category: 'trailer', year: 2024, make: 'Trail King', model: 'Lowboy', label: 'Trail King Lowboy', color: '#b66ad9' },
  { key: 'heil-tanker', type: 'tanker', category: 'trailer', year: 2024, make: 'Heil', model: 'Tanker', label: 'Heil Tanker', color: '#5da2b7' },
  { key: 'strick-chassis', type: 'container_chassis', category: 'trailer', year: 2024, make: 'Strick', model: 'Container Chassis', label: 'Strick Container Chassis', color: '#6e7f8f' }
];
const loadStatusFlow = [
  ['accepted', 'Accept'],
  ['en_route_pickup', 'En Route Pickup'],
  ['at_pickup', 'At Pickup'],
  ['picked_up', 'Confirm Pickup'],
  ['in_transit', 'In Transit'],
  ['at_delivery', 'At Delivery'],
  ['delivered', 'Confirm Delivery'],
  ['pod_uploaded', 'POD Uploaded'],
  ['closed', 'Close Load']
];
const dockTypeOptions = [
  ['dock_level', 'Dock Level'],
  ['tailgate', 'Tailgate Required'],
  ['ground_level', 'Ground Level'],
  ['ramp', 'Ramp'],
  ['forklift', 'Forklift On Site'],
  ['unknown', 'Confirm With Site']
];
const loadTypeOptions = [
  ['dry_van', 'Dry Van / Enclosed Trailer'],
  ['container', 'Container / Port Drayage'],
  ['flatbed', 'Flatbed / Open Deck'],
  ['straight_truck', 'Straight Truck / Box Truck'],
  ['sprinter_van', 'Sprinter Van / Cargo Van']
];
const loadCompatibilityRules = {
  container: {
    power: ['tractor', 'day_cab', 'sleeper_cab'],
    trailer: ['container_chassis'],
    summary: 'Requires a tractor and container chassis. Capture terminal, container, seal, last free day, and empty return.'
  },
  flatbed: {
    power: ['tractor', 'day_cab', 'sleeper_cab', 'hotshot_truck', 'pickup_truck'],
    trailer: ['flatbed', 'step_deck', 'double_drop', 'conestoga', 'lowboy', 'gooseneck', 'curtain_side'],
    summary: 'Requires open-deck capable equipment. Capture dimensions, tarps, securement, and loading method.'
  },
  dry_van: {
    power: ['tractor', 'day_cab', 'sleeper_cab', 'straight_truck', 'box_truck'],
    trailer: ['dry_van', 'reefer', 'liftgate_trailer'],
    summary: 'Requires enclosed equipment. Capture dock/tailgate, pallet count, cartons, weight, and seal if applicable.'
  },
  straight_truck: {
    power: ['straight_truck', 'box_truck'],
    trailer: [],
    summary: 'Requires straight truck or box truck. Capture liftgate, pallet jack, inside delivery, and access restrictions.'
  },
  sprinter_van: {
    power: ['sprinter_van', 'cargo_van'],
    trailer: [],
    summary: 'Requires sprinter or cargo van. Capture piece count, max dimensions, floor loading, and appointment windows.'
  }
};
const loadDocumentRequirements = {
  dry_van: {
    required: ['bol', 'pod'],
    optional: ['seal_photo']
  },
  container: {
    required: ['delivery_order', 'port_pickup_proof', 'container_photo', 'seal_photo', 'empty_return_proof'],
    optional: []
  },
  flatbed: {
    required: ['securement_photo', 'signed_bol', 'pod'],
    optional: ['tarp_photo']
  },
  straight_truck: {
    required: ['pod', 'signature'],
    optional: ['access_notes']
  },
  sprinter_van: {
    required: ['pod', 'signature'],
    optional: ['access_notes']
  }
};
const loadDocumentTypes = [
  ['bol', 'BOL'],
  ['signed_bol', 'Signed BOL'],
  ['pod', 'POD'],
  ['delivery_order', 'Delivery Order'],
  ['port_pickup_proof', 'Port Pickup Proof'],
  ['container_photo', 'Container Photo'],
  ['seal_photo', 'Seal Photo'],
  ['empty_return_proof', 'Empty Return Proof'],
  ['securement_photo', 'Securement Photo'],
  ['tarp_photo', 'Tarp Photo'],
  ['signature', 'Signature'],
  ['access_notes', 'Access Notes'],
  ['receipt', 'Receipt'],
  ['other', 'Other']
];
const viewIcons = {
  platformHome: 'grid',
  adminHome: 'grid',
  dispatchHome: 'grid',
  loads: 'clipboard',
  locations: 'pin',
  customerTracking: 'route',
  map: 'map',
  drivers: 'user',
  vehicles: 'truck',
  assignments: 'link',
  inspections: 'check',
  issues: 'alert',
  maintenance: 'tool',
  documents: 'file',
  reports: 'chart',
  users: 'users',
  companies: 'building',
  settings: 'gear',
  bugReports: 'bug',
  notifications: 'bell',
  driver: 'user',
  driverWork: 'clipboard'
};
const staffOperationsNav = [
  ['dispatchHome', 'Dashboard'],
  ['loads', 'Dispatch / Loads'],
  ['locations', 'Customers / Locations'],
  ['customerTracking', 'Customer Tracking'],
  ['map', 'Live Map'],
  ['drivers', 'Drivers'],
  ['vehicles', 'Equipment'],
  ['inspections', 'Inspections'],
  ['issues', 'Defects / Repairs'],
  ['maintenance', 'Maintenance'],
  ['documents', 'Documents'],
  ['reports', 'Reports'],
  ['settings', 'Settings'],
  ['notifications', 'Notifications'],
  ['bugReports', 'Bug Reports']
];

function setToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `toast show ${type}`;
  toast.textContent = message;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.className = 'toast', 2600);
}

function locationBufferKey() { return `driver_location_buffer_${state.user?.linkedDriverId || 'anon'}`; }
function loadLocationBuffer() {
  try { state.locationBuffer = JSON.parse(localStorage.getItem(locationBufferKey()) || '[]'); }
  catch { state.locationBuffer = []; }
}
function saveLocationBuffer() {
  try { localStorage.setItem(locationBufferKey(), JSON.stringify(state.locationBuffer.slice(-500))); } catch {}
}
function getLastServerSyncAt() {
  try { return Number(localStorage.getItem(`${locationBufferKey()}_last_sync`) || 0) || 0; } catch { return 0; }
}
function setLastServerSyncAt(ts) {
  state.lastServerSyncAt = ts;
  try { localStorage.setItem(`${locationBufferKey()}_last_sync`, String(ts)); } catch {}
}
function bufferLocationPoint(lat, lng, accuracy) {
  const point = { lat:Number(lat), lng:Number(lng), accuracy: accuracy == null ? null : Number(accuracy), timestamp:new Date().toISOString() };
  state.locationBuffer.push(point);
  if (state.locationBuffer.length > 500) state.locationBuffer = state.locationBuffer.slice(-500);
  saveLocationBuffer();
  return point;
}
async function flushBufferedLocations(force = false) {
  if (!state.locationBuffer.length) return;
  const now = Date.now();
  const lastSync = getLastServerSyncAt();
  if (!force && now - lastSync < 60000) return;
  const latest = state.locationBuffer[state.locationBuffer.length - 1];
  try {
    await api('/api/location', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ lat: latest.lat, lng: latest.lng, accuracy: latest.accuracy, history: force ? state.locationBuffer : undefined }) });
    setLastServerSyncAt(now);
    if (force) {
      state.locationBuffer = [];
      saveLocationBuffer();
    }
  } catch (error) {
    console.warn('Buffered location sync failed', error.message);
  }
}

function appendCompanyId(url) {
  if (state.user?.role !== 'super_user' || !state.selectedCompanyId) return url;
  const glue = url.includes('?') ? '&' : '?';
  return `${url}${glue}companyId=${encodeURIComponent(state.selectedCompanyId)}`;
}

async function api(url, options = {}) {
  const opts = { ...options, credentials: 'include', headers: { ...(options.headers || {}) } };
  const finalUrl = appendCompanyId(url);
  const res = await fetch(finalUrl, opts);
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) throw new Error(body?.error || 'Request failed');
  return body;
}

function roleLabel(role) {
  if (role === 'support_staff') return 'dispatcher';
  return String(role || '').replaceAll('_', ' ');
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}
function attr(value) {
  return esc(value);
}
function appIcon(name = 'circle') {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect><rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>',
    clipboard: '<path d="M9 4h6l1 2h3v15H5V6h3l1-2z"></path><path d="M9 11h6"></path><path d="M9 15h4"></path>',
    pin: '<path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11z"></path><circle cx="12" cy="10" r="2"></circle>',
    route: '<circle cx="6" cy="18" r="2"></circle><circle cx="18" cy="6" r="2"></circle><path d="M8 18h3a3 3 0 0 0 0-6h2a3 3 0 0 0 3-3V8"></path>',
    map: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2V6z"></path><path d="M9 4v14"></path><path d="M15 6v14"></path>',
    user: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
    truck: '<path d="M3 7h11v8H3z"></path><path d="M14 10h4l3 3v2h-7z"></path><circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle>',
    check: '<path d="M20 6L9 17l-5-5"></path>',
    alert: '<path d="M12 3l10 18H2L12 3z"></path><path d="M12 9v5"></path><path d="M12 17h.01"></path>',
    tool: '<path d="M14 7a5 5 0 0 0 6 6l-7 7-5-5 7-7z"></path><path d="M4 20l6-6"></path>',
    file: '<path d="M6 3h8l5 5v13H6z"></path><path d="M14 3v5h5"></path>',
    chart: '<path d="M4 20V4"></path><path d="M4 20h16"></path><path d="M8 16v-5"></path><path d="M12 16V8"></path><path d="M16 16v-9"></path>',
    gear: '<circle cx="12" cy="12" r="3"></circle><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z"></path>',
    bug: '<path d="M8 8h8v9a4 4 0 0 1-8 0V8z"></path><path d="M9 4l2 3"></path><path d="M15 4l-2 3"></path><path d="M4 13h4"></path><path d="M16 13h4"></path>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path>',
    building: '<path d="M4 21V5l8-3 8 3v16"></path><path d="M9 21v-6h6v6"></path><path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M16 12h.01"></path>',
    users: '<circle cx="9" cy="8" r="3"></circle><circle cx="17" cy="9" r="2.5"></circle><path d="M3 21a6 6 0 0 1 12 0"></path><path d="M14 18a5 5 0 0 1 7 3"></path>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"></path><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"></path>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || '<circle cx="12" cy="12" r="8"></circle>'}</svg>`;
}
function navLabel(view, label) {
  const unread = view === 'notifications' ? state.notifications.filter(item => !item.readAt).length : 0;
  return `${appIcon(viewIcons[view] || 'circle')}<span>${esc(label)}</span>${unread ? `<b class="nav-badge">${unread}</b>` : ''}`;
}
function statusTag(value) {
  const slug = String(value || '').toLowerCase().replace(/[^a-z0-9_ -]/g, '').replace(/\s+/g, '_');
  return `<span class="tag ${attr(slug)}">${esc(String(value || '').replaceAll('_', ' '))}</span>`;
}
function byId(list, id) { return list.find(item => Number(item.id) === Number(id)); }
function driverName(id) { const d = byId(state.drivers, id); return d ? esc(`${d.firstName || ''} ${d.lastName || ''}`.trim()) : '&mdash;'; }
function vehicleName(id) { const v = byId(state.vehicles, id); return v ? esc(v.unitNumber) : '&mdash;'; }
function fmt(ts) { return ts ? esc(new Date(ts).toLocaleString()) : '&mdash;'; }
function loadTypeLabel(type) {
  return loadTypeOptions.find(([value]) => value === type)?.[1] || String(type || 'dry_van').replaceAll('_', ' ');
}
function vehicleCompatibleWithLoad(vehicle, loadType, slot = 'power') {
  if (!vehicle) return false;
  const rule = loadCompatibilityRules[loadType || 'dry_van'] || loadCompatibilityRules.dry_van;
  const allowed = slot === 'trailer' ? rule.trailer : rule.power;
  return allowed.includes(vehicle.type);
}
function loadTypeRuleSummary(type) {
  return (loadCompatibilityRules[type || 'dry_van'] || loadCompatibilityRules.dry_van).summary;
}
function docTypeLabel(type) {
  return loadDocumentTypes.find(([value]) => value === type)?.[1] || String(type || 'document').replaceAll('_', ' ');
}
function loadDocTypes(loadType) {
  const requirements = loadDocumentRequirements[loadType || 'dry_van'] || loadDocumentRequirements.dry_van;
  const preferred = [...requirements.required, ...requirements.optional, 'receipt', 'other'];
  const seen = new Set();
  return preferred
    .concat(loadDocumentTypes.map(([value]) => value))
    .filter(type => !seen.has(type) && seen.add(type));
}
function loadHasDoc(load, docType) {
  return (load.documents || []).some(doc => String(doc.type || '').toLowerCase() === docType);
}
function loadRequiredDocs(load) {
  return (loadDocumentRequirements[load.loadType || 'dry_van'] || loadDocumentRequirements.dry_van).required;
}
function loadMissingDocs(load) {
  return loadRequiredDocs(load).filter(type => !loadHasDoc(load, type));
}
function renderLoadChecklist(load) {
  const requirements = loadDocumentRequirements[load.loadType || 'dry_van'] || loadDocumentRequirements.dry_van;
  const rows = [
    ...requirements.required.map(type => [type, true]),
    ...requirements.optional.map(type => [type, false])
  ];
  if (!rows.length) return '';
  return `<div class="load-checklist">
    <strong>Required proof</strong>
    <div>${rows.map(([type, required]) => {
      const done = loadHasDoc(load, type);
      return `<span class="${done ? 'done' : ''}">${done ? 'Done' : required ? 'Required' : 'Optional'}: ${esc(docTypeLabel(type))}</span>`;
    }).join('')}</div>
  </div>`;
}
function renderLoadDocumentTypeOptions(load) {
  return loadDocTypes(load.loadType || 'dry_van').map(type => `<option value="${attr(type)}">${esc(docTypeLabel(type))}</option>`).join('');
}
function failedItems(inspection) {
  return (inspection.itemResults || []).filter(item => item.result === 'fail');
}
function typeLabel(type) {
  return equipmentTypes.find(([value]) => value === type)?.[1] || String(type || '').replaceAll('_', ' ');
}
function equipmentCatalogItem(key) {
  return equipmentCatalog.find(item => item.key === key) || null;
}
function equipmentImageUrl(key, type = 'tractor') {
  const item = equipmentCatalogItem(key) || equipmentCatalog.find(entry => entry.type === type) || equipmentCatalog[0];
  const label = (item?.make || 'D365').slice(0, 12);
  const model = (item?.model || typeLabel(type)).slice(0, 18);
  const color = item?.color || '#2f7dd1';
  const isTrailer = item?.category === 'trailer';
  const body = isTrailer
    ? `<rect x="72" y="96" width="236" height="86" rx="10" fill="${color}"/><rect x="310" y="122" width="42" height="60" rx="8" fill="#243247"/><path d="M62 186h296" stroke="#d7e5f4" stroke-width="12" stroke-linecap="round"/>`
    : `<rect x="78" y="112" width="138" height="68" rx="16" fill="${color}"/><path d="M210 132h86l40 48H210z" fill="${color}"/><path d="M296 138h30l24 28h-54z" fill="#dceeff"/><rect x="82" y="84" width="86" height="44" rx="12" fill="${color}" opacity=".9"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 240"><rect width="420" height="240" rx="28" fill="#101923"/><path d="M30 191h360" stroke="#30435a" stroke-width="10" stroke-linecap="round"/>${body}<circle cx="134" cy="190" r="27" fill="#06111d" stroke="#d7e5f4" stroke-width="8"/><circle cx="292" cy="190" r="27" fill="#06111d" stroke="#d7e5f4" stroke-width="8"/><text x="28" y="42" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#eef6ff">${label}</text><text x="28" y="68" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#9bb1c7">${model}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function equipmentCatalogOptions() {
  return [
    '<option value="">Manual entry</option>',
    ...equipmentCatalog.map(item => `<option value="${attr(item.key)}">${esc(item.label)} · ${esc(item.year)}</option>`)
  ].join('');
}
function emptyState(title, detail = '') {
  return `<div class="empty-state"><strong>${esc(title)}</strong>${detail ? `<p>${esc(detail)}</p>` : ''}</div>`;
}
function listSearch(id, placeholder = 'Search') {
  return `<div class="list-toolbar"><label class="search-field"><span>Search</span><input type="search" data-filter-target="${attr(id)}" placeholder="${attr(placeholder)}" autocomplete="off" /></label></div>`;
}
function searchableText(...values) {
  return attr(values.filter(value => value !== null && value !== undefined).join(' ').toLowerCase());
}
function loadStatusTag(load) {
  return statusTag(load.status || 'new');
}
function activeLoads() {
  return state.loads.filter(load => !['delivered', 'pod_uploaded', 'closed', 'cancelled'].includes(load.status));
}
function nextLoadStatus(load) {
  const currentIndex = loadStatusFlow.findIndex(([status]) => status === load.status);
  if (currentIndex < 0) return 'accepted';
  return loadStatusFlow[currentIndex + 1]?.[0] || '';
}
function driverActiveLoad(driverId) {
  return activeLoads().find(load => Number(load.driverId) === Number(driverId)) || null;
}
function vehicleActiveLoad(vehicleId) {
  return activeLoads().find(load => Number(load.vehicleId) === Number(vehicleId) || Number(load.trailerId) === Number(vehicleId)) || null;
}
function driverAvailableForLoad(driver) {
  return driver && driver.status === 'active' && !driverActiveLoad(driver.id);
}
function vehicleAvailableForLoad(vehicle) {
  return vehicle && vehicle.status !== 'out_of_service' && !vehicleActiveLoad(vehicle.id);
}
function driverOptionLabel(driver) {
  const activeLoad = driverActiveLoad(driver.id);
  const status = driver.status !== 'active' ? ` - ${driver.status}` : activeLoad ? ` - on ${activeLoad.loadNumber}` : '';
  return `${driver.firstName || ''} ${driver.lastName || ''}`.trim() + status;
}
function vehicleOptionLabel(vehicle) {
  const activeLoad = vehicleActiveLoad(vehicle.id);
  const status = vehicle.status === 'out_of_service' ? ' - out of service' : activeLoad ? ` - on ${activeLoad.loadNumber}` : '';
  return `${vehicle.unitNumber} - ${typeLabel(vehicle.type)}${status}`;
}
function trackingAge(driver) {
  return hasUsableCoords(driver) && driver?.lastSeenAt ? Date.now() - new Date(driver.lastSeenAt).getTime() : Infinity;
}
function hasUsableCoords(driver) {
  const lat = Number(driver?.lastLat);
  const lng = Number(driver?.lastLng);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}
function trackingState(driver) {
  const age = trackingAge(driver);
  if (!Number.isFinite(age)) return 'offline';
  if (age <= 5 * 60 * 1000) return 'live';
  if (age <= 20 * 60 * 1000) return 'stale';
  return 'offline';
}
function trackingLabel(driver) {
  const stateName = trackingState(driver);
  if (stateName === 'live') return 'live';
  if (stateName === 'stale') return 'stale';
  return hasUsableCoords(driver) && driver?.lastSeenAt ? 'offline' : 'not tracking';
}
function driverInitials(driver) {
  return `${driver?.firstName?.[0] || 'D'}${driver?.lastName?.[0] || ''}`.toUpperCase();
}
function driverFullName(driver) {
  return `${driver?.firstName || ''} ${driver?.lastName || ''}`.trim() || 'Unnamed Driver';
}
function driverStats(driver) {
  const driverId = Number(driver?.id);
  const loads = state.loads.filter(load => Number(load.driverId) === driverId);
  const activeLoad = loads.find(load => !['delivered', 'cancelled'].includes(load.status)) || null;
  const delivered = loads.filter(load => load.status === 'delivered').length;
  const inspections = state.inspections.filter(item => Number(item.driverId) === driverId);
  const failedInspections = inspections.filter(item => item.overallStatus === 'fail').length;
  const openIssues = state.issues.filter(item => Number(item.driverId) === driverId && item.status !== 'closed').length;
  const shifts = state.shifts.filter(item => Number(item.driverId) === driverId);
  const activeShift = shifts.find(item => item.status === 'started') || null;
  const assignment = state.assignments.find(item => Number(item.driverId) === driverId && item.active) || null;
  const safetyScore = Math.max(0, 100 - (openIssues * 12) - (failedInspections * 18));
  const complianceScore = inspections.length ? Math.round(((inspections.length - failedInspections) / inspections.length) * 100) : 100;
  const latestActivity = [
    ...loads.map(load => ({ at: loadLastActivity(load), label: `Load ${load.loadNumber}`, detail: loadStatusLabel(load.status) })),
    ...inspections.map(item => ({ at: item.inspectionTime, label: `Inspection #${item.id}`, detail: item.overallStatus || 'submitted' })),
    ...state.issues.filter(item => Number(item.driverId) === driverId).map(item => ({ at: item.createdAt, label: `Defect #${item.id}`, detail: item.status || item.severity || 'open' }))
  ].filter(item => item.at).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5);
  return { loads, activeLoad, delivered, inspections, failedInspections, openIssues, shifts, activeShift, assignment, safetyScore, complianceScore, latestActivity };
}
function powerUnits() {
  return state.vehicles.filter(v => (v.category || 'power_unit') === 'power_unit');
}
function trailers() {
  return state.vehicles.filter(v => (v.category || 'power_unit') !== 'power_unit');
}
function addressSuggestions(type = 'both') {
  if (type === 'all') return state.addresses;
  return state.addresses.filter(item => ['both', type].includes(item.type || 'both'));
}
function uniqueCustomers() {
  const names = new Set();
  for (const load of state.loads) if (load.customer) names.add(String(load.customer).trim());
  for (const address of state.addresses) {
    if (address.customer) names.add(String(address.customer).trim());
    else if (address.name) names.add(String(address.name).trim());
  }
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b));
}
function locationLabel(item) {
  return [item.customer, item.name].filter(Boolean).join(' - ') || item.address || 'Saved location';
}
function customerNameForLoad(load) {
  return String(load.customer || load.broker || 'Unassigned customer').trim();
}
function loadLastActivity(load) {
  const lastEvent = [...(load.events || [])].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0];
  return lastEvent?.at || load.updatedAt || load.createdAt || '';
}
function loadStatusLabel(status) {
  const match = loadStatusFlow.find(([value]) => value === status);
  return match?.[1] || String(status || 'new').replaceAll('_', ' ');
}
function customerTrackingRecords() {
  const byCustomer = new Map();
  const ensure = customer => {
    const name = String(customer || 'Unassigned customer').trim() || 'Unassigned customer';
    const key = name.toLowerCase();
    if (!byCustomer.has(key)) byCustomer.set(key, { name, loads: [], addresses: [] });
    return byCustomer.get(key);
  };
  for (const address of state.addresses) {
    ensure(address.customer || address.name || 'Unassigned customer').addresses.push(address);
  }
  for (const load of state.loads) {
    ensure(customerNameForLoad(load)).loads.push(load);
  }
  return [...byCustomer.values()]
    .map(record => {
      const latestLoad = [...record.loads].sort((a, b) => String(loadLastActivity(b)).localeCompare(String(loadLastActivity(a))))[0] || null;
      const active = record.loads.filter(load => !['delivered', 'cancelled'].includes(load.status));
      const delivered = record.loads.filter(load => load.status === 'delivered');
      const documents = record.loads.reduce((count, load) => count + (load.documents || []).length, 0);
      const drivers = [...new Set(record.loads.map(load => driverName(load.driverId)).filter(name => name && name !== 'Unassigned'))];
      const contacts = record.addresses.filter(item => item.contactName || item.phone || item.email);
      return { ...record, latestLoad, active, delivered, documents, drivers, contacts };
    })
    .sort((a, b) => String(loadLastActivity(b.latestLoad || {})).localeCompare(String(loadLastActivity(a.latestLoad || {}))) || a.name.localeCompare(b.name));
}
function customerUpdateText(record) {
  const activeSummary = record.active.length
    ? record.active.map(load => `${load.loadNumber}: ${loadStatusLabel(load.status)} from ${load.pickupName || load.pickupAddress || 'pickup'} to ${load.deliveryName || load.deliveryAddress || 'delivery'}`).join('\n')
    : 'No active loads are currently open.';
  const latest = record.latestLoad ? `Last update: ${loadStatusLabel(record.latestLoad.status)} on load ${record.latestLoad.loadNumber} (${fmt(loadLastActivity(record.latestLoad))}).` : 'No load activity recorded yet.';
  return `Dispatcher365 customer update for ${record.name}\n${latest}\n\nActive work:\n${activeSummary}`;
}
function publicTrackingUrl(load) {
  if (!load?.publicTrackingToken) return '';
  return `${window.location.origin}/track/${encodeURIComponent(load.publicTrackingToken)}`;
}
function publicVisibleDocTypes(load) {
  const configured = load.loadDetails?.publicDocumentTypes;
  return new Set(Array.isArray(configured) ? configured : ['bol', 'signed_bol', 'pod']);
}
function customerShareText(load) {
  const url = publicTrackingUrl(load);
  return `Shipment update for load ${load.loadNumber}: ${loadStatusLabel(load.status)}. Track it here: ${url}`;
}
function activeAssignmentForDriver(driverId) {
  return state.assignments.find(a => Number(a.driverId) === Number(driverId) && a.active);
}
function dockTypeLabel(value) {
  return dockTypeOptions.find(([key]) => key === value)?.[1] || String(value || '').replaceAll('_', ' ');
}
function inferDockType(text = '') {
  const value = String(text).toLowerCase();
  if (value.includes('tailgate')) return 'tailgate';
  if (value.includes('ground')) return 'ground_level';
  if (value.includes('ramp')) return 'ramp';
  if (value.includes('forklift')) return 'forklift';
  if (value.includes('dock')) return 'dock_level';
  return '';
}
function combinedAddressSuggestions(type = 'both') {
  const byAddress = new Map();
  for (const item of addressSuggestions(type)) byAddress.set(String(item.address || '').toLowerCase(), item);
  for (const item of Object.values(state.addressLookups)) {
    if (!item?.address) continue;
    if (item.type && !['both', type].includes(item.type)) continue;
    const key = String(item.address || '').toLowerCase();
    if (!byAddress.has(key)) byAddress.set(key, item);
  }
  return [...byAddress.values()].slice(0, 20);
}
function renderAddressDatalist(id, type) {
  return `<datalist id="${attr(id)}">${combinedAddressSuggestions(type).map(item => renderAddressOption(item)).join('')}</datalist>`;
}
function renderAddressOption(item) {
  return `<option value="${attr(item.address)}" label="${attr([locationLabel(item), item.source === 'geoapify' ? 'Geoapify' : item.type].filter(Boolean).join(' - '))}"></option>`;
}
function findAddressByValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return [...state.addresses, ...Object.values(state.addressLookups)].find(item => String(item.address || '').trim().toLowerCase() === normalized) || null;
}
function getCurrentCompany() { return byId(state.companies, state.selectedCompanyId) || null; }
function isSuper() { return state.user?.role === 'super_user'; }
function isAdminLike() { return ['super_user', 'admin'].includes(state.user?.role); }
function isStaffLike() { return ['super_user', 'admin', 'support_staff'].includes(state.user?.role); }
function isDispatcher() { return state.user?.role === 'support_staff'; }
function workspaceName() {
  if (state.user?.role === 'driver') return 'Driver App';
  if (state.user?.role === 'support_staff') return 'Dispatch Console';
  if (state.user?.role === 'admin') return 'Admin Console';
  return 'Platform Console';
}
function canAccessView(view) {
  return getNavItems().some(([allowedView]) => allowedView === view);
}

function setGpsState(status, message = '', extra = {}) {
  state.gpsStatus = status;
  state.gpsMessage = message || state.gpsMessage;
  if (Object.prototype.hasOwnProperty.call(extra, 'lastUpdate')) state.gpsLastUpdate = extra.lastUpdate;
  if (Object.prototype.hasOwnProperty.call(extra, 'accuracy')) state.gpsAccuracy = extra.accuracy;
  const el = document.getElementById('gpsStatusCard');
  if (el) el.dataset.status = status;
  const title = document.getElementById('gpsStatusTitle');
  const msg = document.getElementById('gpsStatusMessage');
  const meta = document.getElementById('gpsStatusMeta');
  const btn = document.getElementById('allowGpsBtn');
  if (title) title.textContent = ({idle:'Not tracking',pending:'Waiting for GPS permission',requesting:'Requesting GPS permission...',tracking:'Tracking active',blocked:'Location access blocked',error:'GPS unavailable'})[status] || 'GPS status';
  if (msg) msg.textContent = state.gpsMessage || '';
  if (meta) meta.textContent = status === 'tracking' ? `Last update ${new Date(state.gpsLastUpdate || Date.now()).toLocaleTimeString()}${state.gpsAccuracy ? ` · ±${Math.round(state.gpsAccuracy)}m` : ''}${state.lastServerSyncAt ? ` · synced ${new Date(state.lastServerSyncAt).toLocaleTimeString()}` : ''}` : '';
  if (btn) {
    if (status === 'tracking') {
      btn.textContent = 'GPS Enabled';
      btn.disabled = true;
      btn.classList.add('is-loading');
    } else if (status === 'requesting' || status === 'pending') {
      btn.textContent = 'Connecting...';
      btn.disabled = true;
      btn.classList.add('is-loading');
    } else if (status === 'blocked') {
      btn.textContent = 'Enable GPS';
      btn.disabled = false;
      btn.classList.remove('is-loading');
    } else {
      btn.textContent = 'Allow GPS';
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  }
}

function lockButton(btn, text='Saving...') {
  if (!btn) return () => {};
  const original = btn.dataset.originalText || btn.textContent;
  btn.dataset.originalText = original;
  btn.disabled = true;
  btn.classList.add('is-loading');
  btn.textContent = text;
  return () => { btn.disabled = false; btn.classList.remove('is-loading'); btn.textContent = original; };
}

async function guardedSubmit(formKey, btn, text, action) {
  if (state.submitLocks[formKey]) return;
  state.submitLocks[formKey] = true;
  const unlockBtn = lockButton(btn, text);
  setToast('Processing... please wait');
  try {
    await action();
  } finally {
    state.submitLocks[formKey] = false;
    unlockBtn();
  }
}

function render() {
  document.getElementById('app').innerHTML = `
    <div class="toast" id="toast"></div>
    ${state.user ? (state.user.role === 'driver' ? renderMobileShell() : renderShell()) : renderLogin()}
  `;
  if (state.user) {
    if (state.user.role === 'driver') bindMobileShell(); else bindShell();
  } else bindLogin();
}

function renderLogin() {
  return `
  <div class="login-page">
    <div class="login-card glass">
      <div class="brand-mark">D365</div>
      <div>
        <p class="eyebrow">Secure fleet portal</p>
        <h1>Driver Fleet Management</h1>
        <p class="subtle">Sign in with your company account to manage drivers, support users, inspections, and fleet activity.</p>
      </div>
      <form id="loginForm" class="stack">
        <label>Email<input type="email" name="email" autocomplete="username" required /></label>
        <label>Password<input type="password" name="password" autocomplete="current-password" required /></label>
        <button class="btn primary" type="submit">Sign In</button>
      </form>
      <div class="login-note">Only authorized users can access this portal.</div>
    </div>
  </div>`;
}

function renderMobileShell() {
  const activeView = canAccessView(state.activeView) ? state.activeView : getDefaultView();
  state.activeView = activeView;
  return `
    <div class="mobile-app-shell">
      <header class="mobile-app-top">
        <div>
          <p class="eyebrow">Driver App</p>
          <h1>${getViewTitle(activeView)}</h1>
        </div>
        <button id="logoutBtn" class="btn ghost small-btn">Log Out</button>
      </header>
      <main id="viewContainer" class="mobile-app-main"></main>
      <nav class="mobile-tabbar">
        ${getNavItems().map(([view, label]) => `<button class="nav-btn ${activeView === view ? 'active' : ''}" data-view="${view}">${navLabel(view, label)}</button>`).join('')}
      </nav>
    </div>`;
}

function getNavItems() {
  if (state.user?.role === 'driver') {
    return [['driver', 'Check-In'], ['driverWork', 'Assigned Work'], ['notifications', 'Notifications'], ['bugReports', 'Report Bug']];
  }
  if (state.user?.role === 'support_staff') {
    return staffOperationsNav.filter(([view]) => !['settings'].includes(view));
  }
  if (state.user?.role === 'admin') {
    return [
      ['adminHome', 'Dashboard'],
      ['loads', 'Dispatch / Loads'],
      ['locations', 'Customers / Locations'],
      ['customerTracking', 'Customer Tracking'],
      ['map', 'Live Map'],
      ['drivers', 'Drivers'],
      ['vehicles', 'Equipment'],
      ['assignments', 'Assignments'],
      ['inspections', 'Inspections'],
      ['issues', 'Defects / Repairs'],
      ['maintenance', 'Maintenance'],
      ['documents', 'Documents'],
      ['reports', 'Reports'],
      ['users', 'Users'],
      ['settings', 'Settings'],
      ['notifications', 'Notifications'],
      ['bugReports', 'Bug Reports']
    ];
  }
  return [
    ['platformHome', 'Dashboard'],
    ['companies', 'Companies'],
    ['users', 'Company Users'],
    ['reports', 'Reports'],
    ['settings', 'Settings'],
    ['notifications', 'Notifications'],
    ['bugReports', 'Bug Reports']
  ];
}

function getDefaultView() {
  if (state.user?.role === 'driver') return 'driver';
  if (state.user?.role === 'support_staff') return 'dispatchHome';
  if (state.user?.role === 'admin') return 'adminHome';
  return 'platformHome';
}

function renderShell() {
  const navItems = getNavItems();
  const company = getCurrentCompany();
  const activeView = canAccessView(state.activeView) ? state.activeView : getDefaultView();
  state.activeView = activeView;
  return `
  <div class="shell">
    <aside class="sidebar glass">
      <div>
        <div class="brand-row">
          <div class="brand-mark small">D365</div>
          <div>
            <h2>${workspaceName()}</h2>
            <p>${esc(state.user.firstName || state.user.email)}</p>
          </div>
        </div>
        <div class="status-panel stack compact">
          <div>${statusTag(roleLabel(state.user.role))}</div>
          ${state.selectedCompanyId ? `<div class="company-chip">${esc(company?.name || 'Selected company')}${company?.code ? ` · ID ${esc(company.code)}` : ''}</div>` : ''}
        </div>
        ${isSuper() ? `
          <div class="scope-picker">
            <label>Working company
              <select id="companyScopeSelect">
                ${state.companies.map(c => `<option value="${attr(c.id)}" ${Number(c.id) === Number(state.selectedCompanyId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
              </select>
            </label>
          </div>` : ''}
      </div>
      <nav>
        ${navItems.map(([view, label]) => `<button class="nav-btn ${activeView === view ? 'active' : ''}" data-view="${view}">${navLabel(view, label)}</button>`).join('')}
      </nav>
      <div class="stack compact">
        <div class="tiny">Version 6 &middot; Role-separated workspaces</div>
        <button id="logoutBtn" class="btn ghost">Log Out</button>
      </div>
    </aside>
    <main class="main">
      <header class="topbar glass">
        <div>
          <p class="eyebrow">${workspaceName()}</p>
          <h1>${getViewTitle(activeView)}</h1>
          <p class="subtle">${esc(company?.name || (state.user.role === 'super_user' ? 'Platform administration' : 'Company workspace'))}</p>
        </div>
        <div class="topbar-actions">
          ${state.companies.length > 1 ? `<label class="topbar-switch">Company<select id="topbarCompanyScopeSelect">${state.companies.map(c => `<option value="${attr(c.id)}" ${Number(c.id) === Number(state.selectedCompanyId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
          <div class="right-chip">${new Date().toLocaleDateString()}</div>
        </div>
      </header>
      <section id="viewContainer"></section>
    </main>
  </div>`;
}

function getViewTitle(view) {
  const titles = {
    platformHome: 'Platform Home',
    adminHome: 'Admin Home',
    dispatchHome: 'Dispatch Home',
    loads: 'Load Dispatch',
    locations: 'Customers / Locations',
    customerTracking: 'Customer Tracking',
    companies: 'Company Setup',
    users: 'Users & Access',
    dashboard: 'Dispatch Dashboard',
    map: 'Live Driver Map',
    drivers: 'Driver Records',
    vehicles: 'Equipment',
    assignments: 'Driver Assignments',
    shifts: 'Shift Timeline',
    inspections: 'Inspection Feed',
    issues: 'Defects / Repairs',
    maintenance: 'Maintenance',
    documents: 'Documents',
    reports: 'Reports',
    settings: 'Settings',
    notifications: 'Notifications',
    bugReports: 'Bug Reports',
    driverWork: 'Assigned Work',
    driver: state.user?.role === 'driver' ? 'My Driver Workspace' : 'Driver Mobile Preview'
  };
  return titles[view] || 'Fleet Portal';
}

function bindLogin() {
  document.getElementById('loginForm').onsubmit = async e => {
    e.preventDefault();
    try {
      const form = new FormData(e.target);
      const body = Object.fromEntries(form);
      const data = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      state.user = data.user;
      state.activeView = getDefaultView();
      await loadEverything();
      render();
      setToast('Logged in successfully', 'success');
    } catch (error) {
      setToast(error.message, 'error');
    }
  };
}

function renderView(view) {
  if (!canAccessView(view)) view = getDefaultView();
  if (view === 'platformHome') return renderPlatformHome();
  if (view === 'adminHome') return renderAdminHome();
  if (view === 'dispatchHome') return renderDispatchHome();
  if (view === 'loads') return renderLoads();
  if (view === 'locations') return renderLocations();
  if (view === 'customerTracking') return renderCustomerTracking();
  if (view === 'companies') return renderCompanies();
  if (view === 'users') return renderUsers();
  if (view === 'dashboard') return renderDashboard();
  if (view === 'map') return renderMapView();
  if (view === 'drivers') return renderDrivers();
  if (view === 'vehicles') return renderVehicles();
  if (view === 'assignments') return renderAssignments();
  if (view === 'shifts') return renderShifts();
  if (view === 'inspections') return renderInspections();
  if (view === 'issues') return renderIssues();
  if (view === 'maintenance') return renderMaintenance();
  if (view === 'documents') return renderDocuments();
  if (view === 'reports') return renderReports();
  if (view === 'settings') return renderSettings();
  if (view === 'notifications') return renderNotifications();
  if (view === 'bugReports') return renderBugReports();
  if (view === 'driverWork') return renderDriverWorkPage();
  return renderDriverWorkspace();
}

function bindShell() {
  const activeView = canAccessView(state.activeView) ? state.activeView : getDefaultView();
  state.activeView = activeView;
  document.getElementById('viewContainer').innerHTML = renderView(activeView);
  bindView(activeView);

  document.querySelectorAll('.nav-btn,[data-view-link]').forEach(btn => {
    btn.onclick = () => {
      state.activeView = btn.dataset.view;
      if (btn.dataset.viewLink) state.activeView = btn.dataset.viewLink;
      render();
    };
  });

  const updateScope = async value => {
    state.selectedCompanyId = Number(value);
    await loadEverything();
    render();
    setToast('Company scope updated', 'success');
  };

  const scopeSelect = document.getElementById('companyScopeSelect');
  if (scopeSelect) scopeSelect.onchange = () => updateScope(scopeSelect.value);
  const topbarScopeSelect = document.getElementById('topbarCompanyScopeSelect');
  if (topbarScopeSelect) topbarScopeSelect.onchange = () => updateScope(topbarScopeSelect.value);

  startDriverTracking();

  document.getElementById('logoutBtn').onclick = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    state.user = null;
    state.companies = [];
    state.users = [];
    state.selectedCompanyId = null;
    state.activeView = null;
    stopDriverTracking();
    render();
  };
}

function bindMobileShell() {
  const activeView = canAccessView(state.activeView) ? state.activeView : getDefaultView();
  state.activeView = activeView;
  document.getElementById('viewContainer').innerHTML = renderView(activeView);
  bindView(activeView);

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
      state.activeView = btn.dataset.view;
      render();
    };
  });

  startDriverTracking();

  document.getElementById('logoutBtn').onclick = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    state.user = null;
    state.companies = [];
    state.users = [];
    state.selectedCompanyId = null;
    state.activeView = null;
    stopDriverTracking();
    render();
  };
}

function renderPlatformHome() {
  return `
    <div class="role-home">
      <section class="panel glass">
        <div class="panel-head"><h3>Platform Control</h3><p>Company-level setup stays here.</p></div>
        <div class="dashboard-grid compact-metrics">
          <div class="metric-card glass"><span>Companies</span><strong>${state.companies.length}</strong></div>
          <div class="metric-card glass"><span>Selected Company</span><strong>${getCurrentCompany() ? '1' : '0'}</strong></div>
        </div>
        <div class="quick-action-grid action-grid">
          <button class="list-card action-card" data-view-link="companies"><strong>Companies</strong><span>Set up company accounts and initial admins.</span></button>
          <button class="list-card action-card" data-view-link="users"><strong>Company Users</strong><span>Manage users for the selected company.</span></button>
        </div>
      </section>
    </div>`;
}

function renderAdminHome() {
  const activeAssignments = state.assignments.filter(a => a.active).length;
  const openDefects = state.issues.filter(issue => issue.status !== 'closed').length;
  return `
    <div class="role-home">
      <section class="panel glass">
        <div class="panel-head"><h3>Admin Setup</h3><p>Maintain the people, vehicles, and assignments dispatch depends on.</p></div>
        <div class="dashboard-grid compact-metrics">
          <div class="metric-card glass"><span>Users</span><strong>${state.users.length}</strong></div>
          <div class="metric-card glass"><span>Drivers</span><strong>${state.drivers.length}</strong></div>
          <div class="metric-card glass"><span>Vehicles</span><strong>${state.vehicles.length}</strong></div>
          <div class="metric-card glass"><span>Assignments</span><strong>${activeAssignments}</strong></div>
          <div class="metric-card glass"><span>Open Defects</span><strong>${openDefects}</strong></div>
        </div>
        <div class="quick-action-grid action-grid">
          <button class="list-card action-card" data-view-link="loads"><strong>Dispatch / Loads</strong><span>Create and review assigned work.</span></button>
          <button class="list-card action-card" data-view-link="users"><strong>Users</strong><span>Create admin and dispatcher logins.</span></button>
          <button class="list-card action-card" data-view-link="drivers"><strong>Drivers</strong><span>Create driver records and driver logins.</span></button>
          <button class="list-card action-card" data-view-link="vehicles"><strong>Equipment</strong><span>Maintain fleet units and status.</span></button>
          <button class="list-card action-card" data-view-link="assignments"><strong>Assignments</strong><span>Assign one active vehicle per driver.</span></button>
          <button class="list-card action-card" data-view-link="maintenance"><strong>Maintenance</strong><span>Review units needing repair or service.</span></button>
          <button class="list-card action-card" data-view-link="reports"><strong>Reports</strong><span>Review fleet activity summaries.</span></button>
        </div>
      </section>
    </div>`;
}

function renderDispatchHome() {
  const d = state.dashboard || { activeShifts: 0, inspectionsToday: 0, openIssues: 0, outOfService: 0, trackedDrivers: 0 };
  const activeDrivers = state.shifts
    .filter(s => s.status === 'started')
    .map(s => {
      const driver = byId(state.drivers, s.driverId);
      return `<article class="list-card"><div><strong>${driverName(s.driverId)}</strong><p>${vehicleName(s.vehicleId)}</p></div><div>${statusTag('started')}</div></article>`;
    }).join('');
  return `
    <div class="role-home">
      <section class="panel glass">
        <div class="panel-head"><h3>Dispatch Monitor</h3><p>Live driver movement, shift status, inspections, and defects.</p></div>
        <div class="dashboard-grid compact-metrics">
          <div class="metric-card glass"><span>Active Shifts</span><strong>${d.activeShifts}</strong></div>
          <div class="metric-card glass"><span>Tracked Drivers</span><strong>${d.trackedDrivers || 0}</strong></div>
          <div class="metric-card glass"><span>Inspections Today</span><strong>${d.inspectionsToday}</strong></div>
          <div class="metric-card glass"><span>Open Issues</span><strong>${d.openIssues}</strong></div>
          <div class="metric-card glass"><span>Active Loads</span><strong>${activeLoads().length}</strong></div>
        </div>
        <div class="quick-action-grid action-grid">
          <button class="list-card action-card" data-view-link="loads"><strong>Dispatch / Loads</strong><span>Create loads and monitor pickup/delivery.</span></button>
          <button class="list-card action-card" data-view-link="map"><strong>Live Map</strong><span>Monitor driver GPS updates.</span></button>
          <button class="list-card action-card" data-view-link="shifts"><strong>Shift Monitor</strong><span>Review check-ins and check-outs.</span></button>
          <button class="list-card action-card" data-view-link="inspections"><strong>Inspections</strong><span>Review submitted vehicle inspections.</span></button>
          <button class="list-card action-card" data-view-link="issues"><strong>Defects / Repairs</strong><span>Track open defects and closures.</span></button>
          <button class="list-card action-card" data-view-link="documents"><strong>Documents</strong><span>Review BOL, POD, and uploaded photos.</span></button>
          <button class="list-card action-card" data-view-link="reports"><strong>Reports</strong><span>Summarize loads, inspections, and defects.</span></button>
        </div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Active Drivers</h3><p>${d.activeShifts} currently checked in</p></div>
        <div class="list-grid">${activeDrivers || '<p class="tiny">No active shifts right now.</p>'}</div>
      </section>
    </div>`;
}

function renderCompanies() {
  const pendingCount = state.companies.filter(c => c.status === 'pending').length;
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Companies</h3><p>${pendingCount} pending approval${pendingCount === 1 ? '' : 's'}</p></div>
        ${listSearch('companyList', 'Search company or code')}
        <div class="table-wrap"><table><thead><tr><th>Company</th><th>Company ID</th><th>Status</th><th>Action</th></tr></thead><tbody data-filter-list="companyList">
          ${state.companies.map(c => `<tr data-search="${searchableText(c.name, c.code, c.status)}"><td>${esc(c.name)}</td><td>${esc(c.code || '') || '&mdash;'}</td><td>${statusTag(c.status)}</td><td>${c.status === 'pending' ? `<button class="btn primary small-btn approve-company" data-company-id="${attr(c.id)}">Approve</button>` : c.status === 'active' ? '<span class="tiny">Approved</span>' : `<button class="btn ghost small-btn approve-company" data-company-id="${attr(c.id)}">Reactivate</button>`}</td></tr>`).join('') || '<tr><td colspan="4">No companies yet</td></tr>'}
          <tr data-filter-empty hidden><td colspan="4">No matching companies.</td></tr>
        </tbody></table></div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Create Company</h3><p>Set up a company and its first admin user</p></div>
        <form id="companyForm" class="stack compact">
          <label>Company name<input name="name" required /></label>
          <label>Company ID<input name="code" placeholder="Optional, e.g. UPS00001" maxlength="8" /></label>
          <label>Status<select name="status"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <hr class="divider" />
          <label>Initial admin email<input name="adminEmail" type="email" required /></label>
          <div class="split"><label>First name<input name="adminFirstName" required /></label><label>Last name<input name="adminLastName" required /></label></div>
          <label>Initial admin password<input name="adminPassword" type="password" autocomplete="new-password" required /></label>
          <button class="btn primary" type="submit">Create Company</button>
        </form>
      </section>
    </div>`;
}

function renderUsers() {
  if (!state.selectedCompanyId && isSuper()) {
    return `<section class="panel glass"><h3>Select a company first</h3><p class="subtle">Use the company picker in the sidebar to manage users for that company.</p></section>`;
  }
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Company Users</h3><p>Admin and dispatcher accounts for this company</p></div>
        ${listSearch('userList', 'Search name, email, or role')}
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody data-filter-list="userList">
          ${state.users.map(u => `<tr data-search="${searchableText(u.firstName, u.lastName, u.email, u.role)}"><td>${esc(`${u.firstName || ''} ${u.lastName || ''}`.trim())}</td><td>${esc(u.email)}</td><td>${statusTag(u.role)}</td></tr>`).join('') || '<tr><td colspan="3">No users yet</td></tr>'}
          <tr data-filter-empty hidden><td colspan="3">No matching users.</td></tr>
        </tbody></table></div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Add User</h3><p>Create an admin or dispatcher login</p></div>
        <form id="userForm" class="stack compact">
          <div class="split"><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label></div>
          <label>Email<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" autocomplete="new-password" required /></label>
          <label>Role<select name="role">
            <option value="support_staff">Dispatcher</option>
            <option value="admin">Admin</option>
          </select></label>
          <button class="btn primary" type="submit">Create User</button>
        </form>
      </section>
    </div>`;
}

function renderDashboard() {
  const d = state.dashboard || { activeShifts: 0, inspectionsToday: 0, openIssues: 0, outOfService: 0 };
  return `
  <div class="dashboard-grid">
    <div class="metric-card glass"><span>Active Shifts</span><strong>${d.activeShifts}</strong></div>
    <div class="metric-card glass"><span>Inspections Today</span><strong>${d.inspectionsToday}</strong></div>
    <div class="metric-card glass"><span>Open Issues</span><strong>${d.openIssues}</strong></div>
    <div class="metric-card glass"><span>Out of Service</span><strong>${d.outOfService}</strong></div>
    <div class="panel glass span-2">
      <div class="panel-head"><h3>Driver Readiness</h3><p>${state.drivers.length} total drivers</p></div>
      <div class="list-grid">${state.drivers.map(driver => {
        const assignment = state.assignments.find(a => a.driverId === driver.id && a.active);
        const vehicle = assignment ? byId(state.vehicles, assignment.vehicleId) : null;
        const activeShift = state.shifts.find(s => s.driverId === driver.id && s.status === 'started');
        return `<article class="list-card"><div><strong>${esc(`${driver.firstName || ''} ${driver.lastName || ''}`.trim())}</strong><p>${vehicle ? esc(vehicle.unitNumber) : 'Unassigned'}</p></div><div>${activeShift ? statusTag('started') : statusTag(driver.status)}</div></article>`;
      }).join('') || '<p class="tiny">No drivers yet.</p>'}</div>
    </div>
    <div class="panel glass span-2">
      <div class="panel-head"><h3>Vehicle Condition</h3><p>Live status by unit</p></div>
      <div class="list-grid">${state.vehicles.map(vehicle => `<article class="list-card"><div><strong>${esc(vehicle.unitNumber)}</strong><p>${esc(`${vehicle.make || ''} ${vehicle.model || ''}`.trim())} &middot; ${(vehicle.odometer || 0).toLocaleString()} km</p></div><div>${statusTag(vehicle.status)}</div></article>`).join('') || '<p class="tiny">No vehicles yet.</p>'}</div>
    </div>
  </div>`;
}


function renderMapView() {
  const hasRealMap = typeof L !== 'undefined';
  const tracked = state.drivers.filter(hasUsableCoords);
  const selected = tracked.find(d => Number(d.id) === Number(state.selectedDriverId)) || tracked[0] || null;
  const bounds = tracked.length ? {
    minLat: Math.min(...tracked.map(d => Number(d.lastLat))),
    maxLat: Math.max(...tracked.map(d => Number(d.lastLat))),
    minLng: Math.min(...tracked.map(d => Number(d.lastLng))),
    maxLng: Math.max(...tracked.map(d => Number(d.lastLng)))
  } : { minLat: 43.60, maxLat: 43.80, minLng: -79.60, maxLng: -79.20 };
  const latRange = Math.max(0.02, bounds.maxLat - bounds.minLat);
  const lngRange = Math.max(0.02, bounds.maxLng - bounds.minLng);
  const markers = hasRealMap ? '' : tracked.map(driver => {
    const rawLeft = ((Number(driver.lastLng) - bounds.minLng) / lngRange) * 100;
    const rawTop = (1 - ((Number(driver.lastLat) - bounds.minLat) / latRange)) * 100;
    const left = Math.max(8, Math.min(92, rawLeft));
    const top = Math.max(8, Math.min(92, rawTop));
    return `<button class="map-marker ${state.selectedDriverId === driver.id ? 'active' : ''} ${attr(trackingState(driver))}" title="${attr(`${driver.firstName || ''} ${driver.lastName || ''}`.trim())}" data-driver-marker="${attr(driver.id)}" style="left:${left}%;top:${top}%"><span>${esc(driver.firstName?.[0] || 'D')}${esc(driver.lastName?.[0] || '')}</span><small>${esc(driver.firstName || '')}</small></button>`;
  }).join('');
  const trail = hasRealMap ? '' : selected?.locationHistory?.slice(-20).map((point, index, points) => {
    const rawLeft = ((Number(point.lng) - bounds.minLng) / lngRange) * 100;
    const rawTop = (1 - ((Number(point.lat) - bounds.minLat) / latRange)) * 100;
    const left = Math.max(8, Math.min(92, rawLeft));
    const top = Math.max(8, Math.min(92, rawTop));
    const opacity = Math.max(.25, (index + 1) / points.length);
    return `<span class="map-trail-dot" style="left:${left}%;top:${top}%;opacity:${opacity}"></span>`;
  }).join('') || '';
  const selectedLoad = selected ? driverActiveLoad(selected.id) : null;
  return `
    <section class="map-layout">
      <div class="panel glass map-panel">
        <div class="panel-head"><h3>Live Driver Tracking</h3><p>Driver locations update once per minute after GPS permission is granted on mobile.</p></div>
        <div class="map-canvas ${hasRealMap ? 'uses-real-map' : 'uses-grid-map'}">
          <div id="realMap" class="real-map"></div>
          <div class="map-grid"></div>
          ${trail}
          ${markers || '<div class="map-empty">No live driver locations yet. Drivers will appear here after signing in and allowing location tracking.</div>'}
        </div>
      </div>
      <div class="stack">
        <div class="panel glass">
          <div class="panel-head"><h3>Tracked Drivers</h3><p>${tracked.length} active coordinates</p></div>
          <div class="list-grid compact-list">
            ${state.drivers.map(driver => `
              <button class="list-card map-driver-card ${selected?.id === driver.id ? 'selected' : ''}" data-driver-focus="${driver.id}">
                <div class="card-row"><strong>${esc(`${driver.firstName || ''} ${driver.lastName || ''}`.trim())}</strong>${statusTag(trackingLabel(driver))}</div>
                <div class="tiny">${esc(driver.email || driver.phone || 'No contact set')}</div>
                <div class="tiny">${hasUsableCoords(driver) && driver.lastSeenAt ? `Last seen ${fmt(driver.lastSeenAt)}` : 'Awaiting first GPS update'}</div><div class="tiny">${hasUsableCoords(driver) ? `${Number(driver.lastLat).toFixed(5)}, ${Number(driver.lastLng).toFixed(5)}` : 'No usable coordinates yet'}</div>
              </button>`).join('')}
          </div>
        </div>
        <div class="panel glass">
          <div class="panel-head"><h3>Selected Driver</h3><p>Location and assigned vehicle</p></div>
          ${selected ? `
            <div class="driver-location-card">
              <div class="card-row"><strong>${esc(`${selected.firstName || ''} ${selected.lastName || ''}`.trim())}</strong>${statusTag(trackingLabel(selected))}</div>
              <div class="tiny">Coordinates</div>
              <div class="coords">${Number(selected.lastLat).toFixed(5)}, ${Number(selected.lastLng).toFixed(5)}</div>
              <div class="tiny">${selected.lastSeenAt ? `Last update ${fmt(selected.lastSeenAt)}` : 'No update yet'}</div>
              <div class="tiny">Assigned vehicle: ${vehicleName((state.assignments.find(a => Number(a.driverId) === Number(selected.id) && a.active) || {}).vehicleId)}</div>
              <div class="tiny">Active load: ${selectedLoad ? `${esc(selectedLoad.loadNumber)} · ${esc(selectedLoad.status || 'assigned')}` : 'None assigned'}</div>
              <div class="tiny">Trail points: ${(selected.locationHistory || []).length}</div>
            </div>` : '<div class="map-empty small">Select a driver to inspect location details.</div>'}
        </div>
      </div>
    </section>`;
}

function renderDrivers() {
  const selected = byId(state.drivers, state.selectedDriverId) || state.drivers[0] || null;
  return `
    <div class="driver-console">
      <section class="panel glass driver-profile-panel">
        <div class="panel-head"><h3>Driver Profile</h3><p>Summary view for safety, compliance, assigned work, and activity.</p></div>
        ${selected ? renderDriverProfile(selected) : emptyState('No drivers yet', 'Create the first driver from the form on the right.')}
      </section>
      <aside class="stack">
        <section class="panel glass">
          <div class="panel-head"><h3>Drivers</h3><p>${state.drivers.length} driver records</p></div>
          ${listSearch('driverList', 'Search driver, email, phone, or license')}
          <div class="driver-roster" data-filter-list="driverList">
            ${state.drivers.map(driver => renderDriverRosterCard(driver, selected)).join('') || '<p class="tiny">No drivers yet.</p>'}
            <div data-filter-empty hidden>${emptyState('No matching drivers', 'Try another name, email, phone, license, or status.')}</div>
          </div>
        </section>
        <section class="panel glass">
          <div class="panel-head"><h3>Add Driver</h3><p>Create a driver record and optional driver login</p></div>
          <form id="driverForm" class="stack compact">
            <div class="split"><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label></div>
            <label>Email<input name="email" type="email" /></label>
            <label>Phone<input name="phone" /></label>
            <label>License number<input name="licenseNumber" /></label>
            <div class="split"><label>Class<input name="licenseClass" value="AZ" /></label><label>Expiry<input name="licenseExpiry" type="date" /></label></div>
            <label>Status<select name="status"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <label class="inline-check"><input type="checkbox" name="createLogin" value="true" /> Create driver login</label>
            <label>Driver password<input name="userPassword" type="password" autocomplete="new-password" /></label>
            <button class="btn primary" type="submit">Save Driver</button>
          </form>
        </section>
      </aside>
    </div>`;
}

function renderDriverProfile(driver) {
  const stats = driverStats(driver);
  const assignedVehicle = stats.assignment ? byId(state.vehicles, stats.assignment.vehicleId) : null;
  const trailer = stats.assignment ? byId(state.vehicles, stats.assignment.trailerId) : null;
  const tracked = hasUsableCoords(driver);
  return `
    <div class="driver-profile">
      <div class="driver-hero-card">
        <div class="driver-photo">${esc(driverInitials(driver))}</div>
        <div class="driver-identity-grid">
          <div><span>Driver ID</span><strong>${esc(driver.id)}</strong></div>
          <div><span>Home Terminal</span><strong>${esc(getCurrentCompany()?.name || 'Company terminal')}</strong></div>
          <div><span>License</span><strong>${esc([driver.licenseClass, driver.licenseNumber].filter(Boolean).join(' - ') || 'Not set')}</strong></div>
          <div><span>Tenure</span><strong>${driver.createdAt ? esc(fmt(driver.createdAt)) : 'Current roster'}</strong></div>
          <div><span>Groups</span><strong>${esc(roleLabel('driver'))}</strong></div>
          <div><span>Driver App</span><strong>${driver.email ? 'Login ready' : 'No email set'}</strong></div>
        </div>
        <div class="driver-profile-title">
          <strong>${esc(driverFullName(driver))}</strong>
          <span>${statusTag(driver.status)} ${statusTag(trackingLabel(driver))}</span>
        </div>
      </div>
      <div class="driver-tabs" aria-label="Driver views">
        <span>Live</span><span>History</span><span class="active">Summary</span>
      </div>
      <div class="driver-insight-grid">
        <article class="driver-insight-card">
          <div class="card-row"><strong>Hours of Service</strong><span>${stats.activeShift ? 'On duty' : 'Available'}</span></div>
          <div class="driver-rings">
            <span><b>${stats.activeShift ? 'ON' : 'OFF'}</b><small>Shift</small></span>
            <span><b>${stats.loads.length}</b><small>Loads</small></span>
            <span><b>${stats.delivered}</b><small>Delivered</small></span>
          </div>
          <p class="tiny">Assigned unit: ${assignedVehicle ? esc(assignedVehicle.unitNumber) : 'Unassigned'}${trailer ? ` · ${esc(trailer.unitNumber)}` : ''}</p>
        </article>
        <article class="driver-insight-card">
          <div class="card-row"><strong>Compliance</strong><span>Last 30 days</span></div>
          <div class="score-donut" style="--score:${stats.complianceScore}"><b>${stats.complianceScore}</b><small>%</small></div>
          <p class="tiny">${stats.inspections.length} inspections · ${stats.failedInspections} failed</p>
        </article>
        <article class="driver-insight-card">
          <div class="card-row"><strong>Safety Score</strong><span>${stats.openIssues ? 'Review' : 'Clear'}</span></div>
          <div class="score-line"><span style="width:${stats.safetyScore}%"></span></div>
          <strong>${stats.safetyScore}/100</strong>
          <p class="tiny">${stats.openIssues} open defect${stats.openIssues === 1 ? '' : 's'} impacting score</p>
        </article>
      </div>
      <div class="driver-summary-grid">
        <article class="driver-summary-card">
          <strong>Current Work</strong>
          ${stats.activeLoad ? `<p>${esc(stats.activeLoad.loadNumber)} · ${esc(loadStatusLabel(stats.activeLoad.status))}</p><span>${esc(stats.activeLoad.pickupName || stats.activeLoad.pickupAddress || 'Pickup')} to ${esc(stats.activeLoad.deliveryName || stats.activeLoad.deliveryAddress || 'Delivery')}</span>` : '<p>No active load assigned.</p><span>Create or assign a load from Dispatch / Loads.</span>'}
        </article>
        <article class="driver-summary-card">
          <strong>Location</strong>
          <p>${tracked ? `${Number(driver.lastLat).toFixed(5)}, ${Number(driver.lastLng).toFixed(5)}` : 'No GPS yet'}</p>
          <span>${driver.lastSeenAt ? `Last seen ${fmt(driver.lastSeenAt)}` : 'Driver must allow GPS from mobile.'}</span>
        </article>
        <article class="driver-summary-card span-wide">
          <strong>Recent Activity</strong>
          <div class="driver-activity-list">
            ${stats.latestActivity.map(item => `<div><span>${esc(item.label)}</span><strong>${esc(item.detail)}</strong><small>${fmt(item.at)}</small></div>`).join('') || '<p class="tiny">No activity recorded yet.</p>'}
          </div>
        </article>
      </div>
    </div>`;
}

function renderDriverRosterCard(driver, selected) {
  const stats = driverStats(driver);
  return `<button class="driver-roster-card ${Number(selected?.id) === Number(driver.id) ? 'selected' : ''}" data-driver-focus="${attr(driver.id)}" data-search="${searchableText(driver.firstName, driver.lastName, driver.email, driver.phone, driver.licenseClass, driver.licenseNumber, driver.status, trackingLabel(driver))}">
    <span class="driver-avatar">${esc(driverInitials(driver))}</span>
    <span><strong>${esc(driverFullName(driver))}</strong><small>${esc(driver.email || driver.phone || 'No contact set')}</small></span>
    <span class="driver-roster-meta">${statusTag(driver.status)}<small>${stats.activeLoad ? esc(stats.activeLoad.loadNumber) : 'No active load'}</small></span>
  </button>`;
}

function renderVehicles() {
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Vehicles</h3><p>Fleet master list for this company</p></div>
        ${listSearch('vehicleList', 'Search unit, plate, VIN, type, or status')}
        <div class="table-wrap"><table><thead><tr><th>Unit</th><th>Vehicle</th><th>Status</th></tr></thead><tbody data-filter-list="vehicleList">
          ${state.vehicles.map(v => `<tr data-search="${searchableText(v.unitNumber, v.plateNumber, v.vin, v.make, v.model, v.year, typeLabel(v.type), v.status)}"><td><div class="vehicle-unit-cell"><img class="vehicle-thumb" src="${attr(equipmentImageUrl(v.imageKey, v.type))}" alt="" /><span>${esc(v.unitNumber)}<small>${esc(v.plateNumber || 'No plate')}</small></span></div></td><td>${esc(typeLabel(v.type))}<div class="tiny">${esc(`${v.make || ''} ${v.model || ''}`.trim())} &middot; ${esc(v.year || '')}</div></td><td>${statusTag(v.status)}</td></tr>`).join('') || '<tr><td colspan="3">No vehicles yet</td></tr>'}
          <tr data-filter-empty hidden><td colspan="3">No matching vehicles.</td></tr>
        </tbody></table></div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Add Vehicle</h3><p>Create a new fleet unit</p></div>
        <form id="vehicleForm" class="stack compact">
          <label>Choose from image catalog<select name="catalogKey" data-equipment-catalog>${equipmentCatalogOptions()}</select></label>
          <div class="equipment-preview">
            <img data-equipment-preview src="${attr(equipmentImageUrl(equipmentCatalog[0].key, equipmentCatalog[0].type))}" alt="Selected equipment preview" />
            <div><strong data-equipment-preview-title>${esc(equipmentCatalog[0].label)}</strong><p class="tiny" data-equipment-preview-detail>${esc(`${equipmentCatalog[0].year} ${equipmentCatalog[0].make} ${equipmentCatalog[0].model}`)}</p></div>
          </div>
          <input type="hidden" name="imageKey" />
          <label>Unit number<input name="unitNumber" required /></label>
          <div class="split"><label>Plate<input name="plateNumber" /></label><label>VIN<input name="vin" /></label></div>
          <div class="split"><label>Make<input name="make" /></label><label>Model<input name="model" /></label></div>
          <div class="split"><label>Year<input name="year" type="number" /></label><label>Category<select name="category"><option value="power_unit">Power Unit</option><option value="trailer">Trailer / Equipment</option></select></label></div>
          <label>Equipment type<select name="type">${equipmentTypes.map(([value, label]) => `<option value="${attr(value)}">${esc(label)}</option>`).join('')}</select></label>
          <div class="split"><label>Length<input name="length" placeholder="53 ft" /></label><label>Max weight<input name="maxWeight" type="number" /></label></div>
          <div class="split"><label class="inline-check"><input type="checkbox" name="temperatureCapable" value="true" /> Temperature capable</label><label class="inline-check"><input type="checkbox" name="liftgate" value="true" /> Liftgate</label></div>
          <label class="inline-check"><input type="checkbox" name="hazmatCapable" value="true" /> Hazmat capable</label>
          <div class="split"><label>Odometer<input name="odometer" type="number" /></label><label>Status<select name="status"><option value="active">Active</option><option value="needs_review">Needs Review</option><option value="out_of_service">Out of Service</option></select></label></div>
          <button class="btn primary" type="submit">Save Vehicle</button>
        </form>
      </section>
    </div>`;
}

function bindVehicleCatalogPicker() {
  const form = document.getElementById('vehicleForm');
  const select = form?.querySelector('[data-equipment-catalog]');
  if (!form || !select) return;
  const preview = form.querySelector('[data-equipment-preview]');
  const title = form.querySelector('[data-equipment-preview-title]');
  const detail = form.querySelector('[data-equipment-preview-detail]');
  const applySelection = () => {
    const item = equipmentCatalogItem(select.value);
    form.elements.imageKey.value = item?.key || '';
    if (preview) preview.src = equipmentImageUrl(item?.key, item?.type || form.elements.type.value);
    if (title) title.textContent = item ? item.label : 'Manual equipment entry';
    if (detail) detail.textContent = item ? `${item.year} ${item.make} ${item.model}` : 'Enter year, make, model, and type directly.';
    if (!item) return;
    form.elements.make.value = item.make;
    form.elements.model.value = item.model;
    form.elements.year.value = item.year;
    form.elements.type.value = item.type;
    form.elements.category.value = item.category;
  };
  select.onchange = applySelection;
  form.elements.type.onchange = () => {
    if (!select.value && preview) preview.src = equipmentImageUrl('', form.elements.type.value);
  };
  applySelection();
}

function renderAssignments() {
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Active Assignments</h3><p>One active vehicle per driver</p></div>
        <div class="table-wrap"><table><thead><tr><th>Driver</th><th>Vehicle</th><th>Assigned</th></tr></thead><tbody>
          ${state.assignments.filter(a => a.active).map(a => `<tr><td>${driverName(a.driverId)}</td><td>${vehicleName(a.vehicleId)}</td><td>${fmt(a.assignedAt)}</td></tr>`).join('') || '<tr><td colspan="3">No assignments</td></tr>'}
        </tbody></table></div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Assign Vehicle</h3><p>Choose a driver and vehicle</p></div>
        <form id="assignmentForm" class="stack compact">
          <label>Driver<select name="driverId">${state.drivers.map(d => `<option value="${attr(d.id)}">${esc(`${d.firstName || ''} ${d.lastName || ''}`.trim())}</option>`).join('')}</select></label>
          <label>Vehicle<select name="vehicleId">${state.vehicles.map(v => `<option value="${attr(v.id)}">${esc(v.unitNumber)}</option>`).join('')}</select></label>
          <button class="btn primary" type="submit">Assign</button>
        </form>
      </section>
    </div>`;
}

function renderShifts() {
  return `
    <section class="panel glass">
      <div class="panel-head"><h3>Shift Timeline</h3><p>Recent driver activity</p></div>
      <div class="table-wrap"><table><thead><tr><th>Driver</th><th>Vehicle</th><th>Started</th><th>Ended</th><th>Status</th></tr></thead><tbody>
      ${state.shifts.map(s => `<tr><td>${driverName(s.driverId)}</td><td>${vehicleName(s.vehicleId)}</td><td>${fmt(s.startTime)}</td><td>${fmt(s.endTime)}</td><td>${statusTag(s.status)}</td></tr>`).join('') || '<tr><td colspan="5">No shifts yet</td></tr>'}
      </tbody></table></div>
    </section>`;
}

function renderLoadTypeFields() {
  return `
    <div class="load-type-panels">
      <div class="load-type-panel" data-load-type-panel="container">
        <div class="split"><label>Container #<input name="containerNumber" placeholder="MSCU1234567" /></label><label>Container size<select name="containerSize"><option value="">Select size</option><option>20 ft</option><option>40 ft</option><option>40 ft HC</option><option>45 ft</option></select></label></div>
        <div class="split"><label>Port / terminal<input name="portTerminal" placeholder="Terminal name" /></label><label>Return terminal<input name="returnTerminal" placeholder="Empty return location" /></label></div>
        <div class="split"><label>Seal #<input name="sealNumber" /></label><label>Last free day<input name="lastFreeDay" type="date" /></label></div>
        <label>Container notes<textarea name="containerNotes" placeholder="Pickup number, steamship line, customs hold, genset, overweight permit, empty return instructions"></textarea></label>
      </div>
      <div class="load-type-panel" data-load-type-panel="flatbed">
        <div class="split"><label>Freight dimensions<input name="freightDimensions" placeholder="L x W x H" /></label><label>Loading method<select name="loadingMethod"><option value="">Select</option><option>Forklift</option><option>Crane</option><option>Loader</option><option>Customer load/unload</option></select></label></div>
        <div class="split"><label>Tarp required<select name="tarpRequired"><option value="">Select</option><option>No</option><option>Yes</option><option>Partial tarp</option></select></label><label>Securement<input name="securement" placeholder="Straps, chains, edge protectors" /></label></div>
        <label>Flatbed notes<textarea name="flatbedNotes" placeholder="Oversize, permits, load value, dunnage, blocking/bracing, PPE, site access"></textarea></label>
      </div>
      <div class="load-type-panel" data-load-type-panel="dry_van">
        <div class="split"><label>Pallet count<input name="palletCount" type="number" /></label><label>Cartons<input name="cartonCount" type="number" /></label></div>
        <div class="split"><label>Seal required<select name="sealRequired"><option value="">Select</option><option>No</option><option>Yes</option></select></label><label>Temperature<input name="temperatureRequirement" placeholder="Ambient, protect from freeze" /></label></div>
        <label>Dry van notes<textarea name="dryVanNotes" placeholder="Floor loaded, clamp truck, food grade, appointment rules, lumper, driver assist"></textarea></label>
      </div>
      <div class="load-type-panel" data-load-type-panel="straight_truck">
        <div class="split"><label>Liftgate needed<select name="liftgateRequired"><option value="">Select</option><option>No</option><option>Yes</option></select></label><label>Pallet jack needed<select name="palletJackRequired"><option value="">Select</option><option>No</option><option>Yes</option></select></label></div>
        <div class="split"><label>Access limits<input name="accessLimits" placeholder="Low bridge, dock height, residential" /></label><label>Inside delivery<select name="insideDelivery"><option value="">Select</option><option>No</option><option>Yes</option></select></label></div>
        <label>Straight truck notes<textarea name="straightTruckNotes" placeholder="Tailgate area, stairs, elevator, call ahead, delivery room"></textarea></label>
      </div>
      <div class="load-type-panel" data-load-type-panel="sprinter_van">
        <div class="split"><label>Max piece dimensions<input name="maxPieceDimensions" placeholder="L x W x H" /></label><label>Floor loaded<select name="floorLoaded"><option value="">Select</option><option>No</option><option>Yes</option></select></label></div>
        <div class="split"><label>Piece count<input name="vanPieceCount" type="number" /></label><label>Expedite service<select name="expediteService"><option value="">Select</option><option>Standard</option><option>Direct drive</option><option>Hot shot</option></select></label></div>
        <label>Van notes<textarea name="sprinterNotes" placeholder="Dock restriction, hand unload, fragile freight, no trailer access"></textarea></label>
      </div>
    </div>`;
}

function renderLoads() {
  const powerOptions = powerUnits().map(v => `<option value="${attr(v.id)}" data-type="${attr(v.type)}" ${vehicleAvailableForLoad(v) ? '' : 'disabled'}>${esc(vehicleOptionLabel(v))}</option>`).join('');
  const trailerOptions = trailers().map(v => `<option value="${attr(v.id)}" data-type="${attr(v.type)}" ${vehicleAvailableForLoad(v) ? '' : 'disabled'}>${esc(vehicleOptionLabel(v))}</option>`).join('');
  const customers = uniqueCustomers();
  const pickupLocations = addressSuggestions('pickup');
  const deliveryLocations = addressSuggestions('delivery');
  const dockOptions = dockTypeOptions.map(([value, label]) => `<option value="${attr(value)}">${esc(label)}</option>`).join('');
  const loadTypeSelectOptions = loadTypeOptions.map(([value, label]) => `<option value="${attr(value)}">${esc(label)}</option>`).join('');
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Load Board</h3><p>${activeLoads().length} active loads</p></div>
        ${listSearch('loadBoard', 'Search load, customer, driver, address, or status')}
        <div class="load-board" data-filter-list="loadBoard">
          ${state.loads.map(load => renderLoadCard(load, true)).join('') || emptyState('No loads yet', 'Create the first load from the form on the right.')}
          <div data-filter-empty hidden>${emptyState('No matching loads', 'Try another load number, customer, address, or driver.')}</div>
        </div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Create Load</h3><p>Use saved customers, locations, and driver assignments to reduce typing.</p></div>
        <form id="loadForm" class="stack compact">
          <div class="form-step"><span>1</span><strong>Load Details</strong></div>
          <div class="split"><label>Tracking / Load #<input name="loadNumber" placeholder="Auto: ${attr(getCurrentCompany()?.code || 'COMPANY')}-${new Date().getFullYear()}-000001" /></label><label>Reference<input name="referenceNumber" /></label></div>
          <div class="split"><label>Customer<input name="customer" list="customerNames" placeholder="Start typing saved customer" /></label><label>Broker<input name="broker" /></label></div>
          <label>Load type<select name="loadType" id="loadTypeSelect">${loadTypeSelectOptions}</select></label>
          <div class="compatibility-note" id="loadTypeSummary">${esc(loadTypeRuleSummary('dry_van'))}</div>
          ${renderLoadTypeFields()}
          <div class="form-step"><span>2</span><strong>Stops</strong></div>
          <label>Saved pickup location<select data-location-select="pickup"><option value="">Choose saved pickup</option>${pickupLocations.map(item => `<option value="${attr(item.address)}">${esc(locationLabel(item))}</option>`).join('')}</select></label>
          <label>Pickup name<input name="pickupName" data-address-name="pickupAddress" /></label>
          <label>Pickup address<input name="pickupAddress" list="pickupAddresses" autocomplete="street-address" data-address-input="pickupName" data-address-type="pickup" /></label>
          <label>Pickup appointment<input name="pickupAppointment" type="datetime-local" /></label>
          <div class="split"><label>Pickup operations hours<input name="pickupHours" placeholder="Mon-Fri 7-3" /></label><label>Pickup dock / tailgate<select name="pickupDockType"><option value="">Select dock setup</option>${dockOptions}</select></label></div>
          <div class="split"><label>Pickup contact<input name="pickupContactName" /></label><label>Pickup phone<input name="pickupPhone" /></label></div>
          <label>Pickup site notes<textarea name="pickupSiteNotes" placeholder="Check-in process, gate code, door, buzzer, loading notes"></textarea></label>
          <label>Saved delivery location<select data-location-select="delivery"><option value="">Choose saved delivery</option>${deliveryLocations.map(item => `<option value="${attr(item.address)}">${esc(locationLabel(item))}</option>`).join('')}</select></label>
          <label>Delivery name<input name="deliveryName" data-address-name="deliveryAddress" /></label>
          <label>Delivery address<input name="deliveryAddress" list="deliveryAddresses" autocomplete="street-address" data-address-input="deliveryName" data-address-type="delivery" /></label>
          <label>Delivery appointment<input name="deliveryAppointment" type="datetime-local" /></label>
          <div class="split"><label>Delivery operations hours<input name="deliveryHours" placeholder="Mon-Fri 7-3" /></label><label>Delivery dock / tailgate<select name="deliveryDockType"><option value="">Select dock setup</option>${dockOptions}</select></label></div>
          <div class="split"><label>Delivery contact<input name="deliveryContactName" /></label><label>Delivery phone<input name="deliveryPhone" /></label></div>
          <label>Delivery site notes<textarea name="deliverySiteNotes" placeholder="Receiving process, gate code, door, buzzer, unloading notes"></textarea></label>
          <div class="form-step"><span>3</span><strong>Freight and Assignment</strong></div>
          <div class="split"><label>Commodity<input name="commodity" /></label><label>Weight<input name="weight" type="number" /></label></div>
          <div class="split"><label>Pieces / pallets<input name="pieces" /></label><label>Rate<input name="rate" /></label></div>
          <div class="split"><label class="inline-check"><input type="checkbox" name="hazmatRequired" value="true" /> Hazmat required</label><label class="inline-check"><input type="checkbox" name="temperatureControlled" value="true" /> Temperature controlled</label></div>
          <label class="inline-check"><input type="checkbox" name="generalLiftgateRequired" value="true" /> Liftgate required</label>
          <label>Driver<select name="driverId"><option value="">Unassigned</option>${state.drivers.map(d => `<option value="${attr(d.id)}" ${driverAvailableForLoad(d) ? '' : 'disabled'}>${esc(driverOptionLabel(d))}</option>`).join('')}</select></label>
          <label>Power unit<select name="vehicleId"><option value="">Unassigned</option>${powerOptions}</select></label>
          <label>Trailer / equipment<select name="trailerId"><option value="">None</option>${trailerOptions}</select></label>
          <div class="compatibility-note" id="equipmentCompatibilityHint">Choose a load type to see compatible equipment.</div>
          <label>Notes<textarea name="notes"></textarea></label>
          <button class="btn primary" type="submit">Create Load</button>
          <datalist id="customerNames">${customers.map(name => `<option value="${attr(name)}"></option>`).join('')}</datalist>
          ${renderAddressDatalist('pickupAddresses', 'pickup')}
          ${renderAddressDatalist('deliveryAddresses', 'delivery')}
        </form>
        <hr class="soft-rule" />
        <div class="panel-head"><h3>Quick Save Location</h3><p>Save frequent shippers and receivers while dispatching.</p></div>
        <form id="addressForm" class="stack compact">
          <label>Customer<input name="customer" list="customerNames" placeholder="Customer account" /></label>
          <div class="split"><label>Location name<input name="name" placeholder="Shipper, receiver, dock" /></label><label>Type<select name="type"><option value="both">Pickup & delivery</option><option value="pickup">Pickup only</option><option value="delivery">Delivery only</option></select></label></div>
          <label>Address<input name="address" required autocomplete="street-address" list="allAddresses" data-address-input="name" data-address-type="all" /></label>
          <div class="split"><label>Contact<input name="contactName" /></label><label>Phone<input name="phone" /></label></div>
          <div class="split"><label>Hours<input name="hours" placeholder="Mon-Fri 7-3" /></label><label>Dock notes<input name="dockNotes" placeholder="Door, buzzer, gate code" /></label></div>
          <label>Notes<textarea name="notes"></textarea></label>
          <button class="btn ghost" type="submit">Save Address</button>
          ${renderAddressDatalist('allAddresses', 'all')}
        </form>
        <div class="address-chip-row">${state.addresses.slice(0, 10).map(item => `<span class="address-chip">${esc(locationLabel(item))}<small>${esc(item.type || 'both')}</small></span>`).join('') || '<p class="tiny">No saved addresses yet.</p>'}</div>
      </section>
    </div>`;
}

function renderLoadCard(load, dispatcher = false) {
  const docs = load.documents || [];
  const pickupDetails = stopSiteDetails(load, 'pickup');
  const deliveryDetails = stopSiteDetails(load, 'delivery');
  const trackingUrl = publicTrackingUrl(load);
  const visibleTypes = publicVisibleDocTypes(load);
  const publicDocOptions = loadDocumentTypes
    .filter(([type]) => ['bol', 'signed_bol', 'pod', 'delivery_order', 'port_pickup_proof', 'container_photo', 'seal_photo', 'empty_return_proof', 'securement_photo', 'tarp_photo', 'receipt'].includes(type))
    .map(([type, label]) => `<label class="inline-check"><input type="checkbox" name="publicDocumentTypes" value="${attr(type)}" ${visibleTypes.has(type) ? 'checked' : ''} /> ${esc(label)}</label>`).join('');
  const shareText = trackingUrl ? encodeURIComponent(customerShareText(load)) : '';
  const mailHref = trackingUrl ? `mailto:${attr(load.loadDetails?.customerEmail || '')}?subject=${encodeURIComponent(`Tracking ${load.loadNumber}`)}&body=${shareText}` : '';
  const smsHref = trackingUrl ? `sms:${attr(load.loadDetails?.customerPhone || '')}?&body=${shareText}` : '';
  const detailText = load.loadDetails ? Object.entries(load.loadDetails).filter(([key, value]) => value && !['publicDocumentTypes', 'customerEmail', 'customerPhone'].includes(key) && !Array.isArray(value) && typeof value !== 'object').slice(0, 4).map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1')}: ${value}`).join(' · ') : '';
  return `<article class="load-card" data-search="${searchableText(load.loadNumber, load.loadType, detailText, load.customer, load.broker, load.pickupName, load.pickupAddress, pickupDetails, load.deliveryName, load.deliveryAddress, deliveryDetails, load.status, driverName(load.driverId), vehicleName(load.vehicleId), vehicleName(load.trailerId))}">
    <div class="card-row"><div><strong>${esc(load.loadNumber)}</strong><p class="tiny">${esc(load.customer || load.broker || 'No customer')} &middot; ${esc(loadTypeLabel(load.loadType || 'dry_van'))}</p></div>${loadStatusTag(load)}</div>
    <div class="load-stop"><span>PU</span><div><strong>${esc(load.pickupName || 'Pickup')}</strong><p>${esc(load.pickupAddress || '')}</p><p class="tiny">${fmt(load.pickupAppointment)}</p>${pickupDetails ? `<p class="site-detail">${esc(pickupDetails)}</p>` : ''}</div></div>
    <div class="load-stop"><span>DEL</span><div><strong>${esc(load.deliveryName || 'Delivery')}</strong><p>${esc(load.deliveryAddress || '')}</p><p class="tiny">${fmt(load.deliveryAppointment)}</p>${deliveryDetails ? `<p class="site-detail">${esc(deliveryDetails)}</p>` : ''}</div></div>
    <div class="tiny">Driver: ${driverName(load.driverId)} &middot; Truck: ${vehicleName(load.vehicleId)} &middot; Trailer: ${vehicleName(load.trailerId)}</div>
    <div class="tiny">${esc(load.commodity || 'Commodity not set')}${load.weight ? ` &middot; ${Number(load.weight).toLocaleString()} lb` : ''}${load.pieces ? ` &middot; ${esc(load.pieces)}` : ''}</div>
    ${detailText ? `<div class="site-detail">${esc(detailText)}</div>` : ''}
    ${renderLoadChecklist(load)}
    ${dispatcher ? `<div class="load-actions"><a class="btn ghost small-btn" href="/bol/${attr(load.id)}" target="_blank" rel="noopener">Print VICS BOL</a></div>` : ''}
    ${dispatcher && trackingUrl ? `<div class="customer-link-row"><input value="${attr(trackingUrl)}" readonly aria-label="Public customer tracking link" /><button class="btn ghost small-btn copy-tracking-link" type="button" data-url="${attr(trackingUrl)}">Copy Customer Link</button></div>
      <form class="customer-visibility-form stack compact" data-load-visibility="${attr(load.id)}">
        <div class="split"><label>Customer email<input name="customerEmail" value="${attr(load.loadDetails?.customerEmail || '')}" placeholder="customer@example.com" /></label><label>Customer phone<input name="customerPhone" value="${attr(load.loadDetails?.customerPhone || '')}" placeholder="+1 555 555 5555" /></label></div>
        <div class="compatibility-note">Public documents visible on tracking page</div>
        <div class="visibility-options">${publicDocOptions}</div>
        <div class="load-actions"><button class="btn ghost small-btn" type="submit">Save Public Visibility</button><a class="btn ghost small-btn" href="${mailHref}">Email Link</a><a class="btn ghost small-btn" href="${smsHref}">SMS Link</a></div>
      </form>` : ''}
    ${dispatcher ? `<div class="timeline">${(load.events || []).slice(-4).map(event => `<div><strong>${esc(event.status)}</strong><span>${fmt(event.at)}</span><p>${esc(event.note || '')}</p></div>`).join('')}</div>` : ''}
    ${docs.length ? `<div class="photo-row">${docs.map(doc => `<a class="doc-thumb" href="${attr(doc.url)}" target="_blank" rel="noopener"><img src="${attr(doc.url)}" alt="${attr(doc.type || 'document')}" /><span>${esc(doc.type || 'doc')}</span></a>`).join('')}</div>` : ''}
  </article>`;
}

function stopSiteDetails(load, prefix) {
  const contact = load[`${prefix}ContactName`] || '';
  const phone = load[`${prefix}Phone`] || '';
  const hours = load[`${prefix}Hours`] || '';
  const dock = load[`${prefix}DockType`] ? dockTypeLabel(load[`${prefix}DockType`]) : '';
  const notes = load[`${prefix}SiteNotes`] || '';
  return [
    hours ? `Hours: ${hours}` : '',
    contact || phone ? `Contact: ${[contact, phone].filter(Boolean).join(' ')}` : '',
    dock ? `Dock: ${dock}` : '',
    notes
  ].filter(Boolean).join(' | ');
}

function renderInspections() {
  return `
    <section class="panel glass">
      <div class="panel-head"><h3>Inspection Feed</h3><p>Submitted pre-trip inspections</p></div>
      ${listSearch('inspectionList', 'Search driver, vehicle, result, or notes')}
      <div class="inspection-grid" data-filter-list="inspectionList">${state.inspections.map(i => {
        const failed = failedItems(i);
        return `<article class="inspection-card" data-search="${searchableText(i.id, vehicleName(i.vehicleId), driverName(i.driverId), i.overallStatus, i.notes, failed.map(item => item.item).join(' '))}"><div class="panel-head"><strong>#${esc(i.id)} &middot; ${vehicleName(i.vehicleId)}</strong>${statusTag(i.overallStatus)}</div><p class="tiny">${driverName(i.driverId)} &middot; ${fmt(i.inspectionTime)}</p><p>${esc(i.notes || 'No notes.')}</p><div class="tiny">Checklist items: ${(i.itemResults || []).length}${failed.length ? ` &middot; Failed: ${failed.map(item => esc(item.item)).join(', ')}` : ''}</div><div class="photo-row">${(i.photos || []).map(p => `<img src="${attr(p.url)}" alt="inspection photo" />`).join('')}</div></article>`;
      }).join('') || emptyState('No inspections yet', 'Driver inspection submissions will appear here.')}<div data-filter-empty hidden>${emptyState('No matching inspections', 'Try searching by driver, vehicle, or result.')}</div></div>
    </section>`;
}

function renderIssues() {
  return `
    <section class="panel glass">
      <div class="panel-head"><h3>Issue Queue</h3><p>Open and closed defects</p></div>
      ${listSearch('issueList', 'Search vehicle, driver, severity, or description')}
      <div class="issue-list" data-filter-list="issueList">${state.issues.map(i => `<article class="issue-card" data-search="${searchableText(vehicleName(i.vehicleId), driverName(i.driverId), i.category, i.severity, i.status, i.description)}"><div class="panel-head"><div><strong>${vehicleName(i.vehicleId)}</strong><p class="tiny">${driverName(i.driverId)} &middot; ${fmt(i.createdAt)}</p></div><div class="stack-right">${statusTag(i.severity)}${statusTag(i.status)}</div></div><p>${esc(i.description)}</p>${i.photos?.length ? `<div class="photo-row">${i.photos.map(p => `<img src="${attr(p.url)}" alt="issue photo" />`).join('')}</div>` : ''}${i.status !== 'closed' && isStaffLike() ? `<button class="btn primary small-btn close-issue" data-id="${attr(i.id)}">Mark Closed</button>` : `<p class="tiny">${i.closedAt ? `Closed ${fmt(i.closedAt)}` : ''}</p>`}</article>`).join('') || emptyState('No issues reported', 'Vehicle defects and driver issue reports will appear here.')}<div data-filter-empty hidden>${emptyState('No matching issues', 'Try another vehicle, driver, severity, or keyword.')}</div></div>
    </section>`;
}

function renderMaintenance() {
  const defectVehicles = new Set(state.issues.filter(issue => issue.status !== 'closed' && issue.vehicleId).map(issue => Number(issue.vehicleId)));
  const needsService = state.vehicles.filter(vehicle => ['needs_review', 'out_of_service'].includes(vehicle.status) || defectVehicles.has(Number(vehicle.id)));
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Maintenance Queue</h3><p>Vehicles needing review, repair, or service follow-up.</p></div>
        ${listSearch('maintenanceList', 'Search unit, status, or repair note')}
        <div class="issue-list" data-filter-list="maintenanceList">
          ${needsService.map(vehicle => {
            const openDefects = state.issues.filter(issue => issue.status !== 'closed' && Number(issue.vehicleId) === Number(vehicle.id));
            return `<article class="issue-card" data-search="${searchableText(vehicle.unitNumber, vehicle.plateNumber, vehicle.status, typeLabel(vehicle.type), openDefects.map(issue => issue.description).join(' '))}">
              <div class="panel-head"><div><strong>${esc(vehicle.unitNumber)}</strong><p class="tiny">${esc(typeLabel(vehicle.type))} &middot; ${esc(vehicle.plateNumber || 'No plate')}</p></div>${statusTag(vehicle.status)}</div>
              <p>${openDefects.length ? `${openDefects.length} open defect${openDefects.length === 1 ? '' : 's'} to review.` : 'No open defect attached; status needs review.'}</p>
              <div class="tiny">Odometer: ${(vehicle.odometer || 0).toLocaleString()} km</div>
            </article>`;
          }).join('') || emptyState('No maintenance items', 'Vehicles marked needs review, out of service, or tied to open defects will appear here.')}
          <div data-filter-empty hidden>${emptyState('No matching maintenance items', 'Try another unit number, plate, or status.')}</div>
        </div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Service Planning</h3><p>Starter workflow for repairs and preventive maintenance.</p></div>
        <div class="list-grid">
          <article class="list-card"><strong>Next build step</strong><p class="tiny">Add work orders, service intervals, repair vendors, and completion notes.</p></article>
          <article class="list-card"><strong>Current source</strong><p class="tiny">This queue is driven by vehicle status and open defects.</p></article>
        </div>
      </section>
    </div>`;
}

function renderDocuments() {
  const loadDocs = state.loads.flatMap(load => (load.documents || []).map(doc => ({ ...doc, load })));
  const inspectionDocs = state.inspections.flatMap(inspection => (inspection.photos || []).map(photo => ({ ...photo, type: 'inspection', inspection })));
  const bugDocs = state.bugReports.flatMap(report => (report.photos || []).map(photo => ({ ...photo, type: 'bug', report })));
  const docs = [...loadDocs, ...inspectionDocs, ...bugDocs].sort((a, b) => String(b.uploadedAt || b.createdAt || '').localeCompare(String(a.uploadedAt || a.createdAt || '')));
  return `
    <section class="panel glass">
      <div class="panel-head"><h3>Documents</h3><p>BOL, POD, receipts, inspection photos, and issue screenshots.</p></div>
      ${listSearch('documentList', 'Search load, type, note, or source')}
      <div class="document-grid" data-filter-list="documentList">
        ${docs.map(doc => {
          const source = doc.load ? `Load ${doc.load.loadNumber}` : doc.inspection ? `Inspection #${doc.inspection.id}` : doc.report ? `Bug #${doc.report.id}` : 'Document';
          const url = doc.url || '';
          return `<a class="document-card" href="${attr(url)}" target="_blank" rel="noopener" data-search="${searchableText(source, doc.type, doc.note, doc.filename, doc.load?.pickupAddress, doc.load?.deliveryAddress)}">
            ${url ? `<img src="${attr(url)}" alt="${attr(doc.type || 'document')}" />` : ''}
            <div><strong>${esc(source)}</strong><p class="tiny">${esc(doc.type || 'document')}${doc.note ? ` &middot; ${esc(doc.note)}` : ''}</p></div>
          </a>`;
        }).join('') || emptyState('No documents yet', 'Driver uploads for BOL, POD, receipts, inspections, and bug reports will appear here.')}
        <div data-filter-empty hidden>${emptyState('No matching documents', 'Try another load number, document type, or note.')}</div>
      </div>
    </section>`;
}

function renderReports() {
  const delivered = state.loads.filter(load => load.status === 'delivered').length;
  const openDefects = state.issues.filter(issue => issue.status !== 'closed').length;
  const missingGps = state.drivers.filter(driver => !driver.lastSeenAt).length;
  const docCount = state.loads.reduce((count, load) => count + (load.documents || []).length, 0);
  return `
    <div class="dashboard-grid">
      <div class="metric-card glass"><span>Total Loads</span><strong>${state.loads.length}</strong></div>
      <div class="metric-card glass"><span>Delivered Loads</span><strong>${delivered}</strong></div>
      <div class="metric-card glass"><span>Open Defects</span><strong>${openDefects}</strong></div>
      <div class="metric-card glass"><span>Load Documents</span><strong>${docCount}</strong></div>
      <section class="panel glass span-2">
        <div class="panel-head"><h3>Operational Reports</h3><p>Quick summaries for dispatch and management.</p></div>
        <div class="list-grid">
          <article class="list-card"><strong>Driver Activity</strong><p class="tiny">${state.shifts.length} shifts recorded. ${missingGps} driver${missingGps === 1 ? '' : 's'} have no GPS update yet.</p></article>
          <article class="list-card"><strong>Inspection Compliance</strong><p class="tiny">${state.inspections.length} inspections submitted, ${state.inspections.filter(i => i.overallStatus === 'fail').length} failed.</p></article>
          <article class="list-card"><strong>Defect Aging</strong><p class="tiny">${openDefects} open defects need review or closure.</p></article>
        </div>
      </section>
      <section class="panel glass span-2">
        <div class="panel-head"><h3>Future Exports</h3><p>CSV/PDF exports can be added here next.</p></div>
        ${emptyState('Reports are summarized on-screen', 'Next step: add export buttons for inspections, loads, defects, and driver activity.')}
      </section>
    </div>`;
}

function renderLocations() {
  const customers = uniqueCustomers();
  const rows = state.addresses.map(item => `
    <tr data-search="${searchableText(item.customer, item.name, item.address, item.type, item.contactName, item.phone, item.hours, item.dockNotes, item.notes)}">
      <td><strong>${esc(locationLabel(item))}</strong><p class="tiny">${esc(item.address)}</p></td>
      <td>${statusTag(item.type || 'both')}</td>
      <td>${esc(item.contactName || '')}<p class="tiny">${esc(item.phone || item.email || '')}</p></td>
      <td>${esc(item.hours || '')}<p class="tiny">${esc(item.dockNotes || item.notes || '')}</p></td>
    </tr>`).join('');
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Customers / Locations</h3><p>${state.addresses.length} saved company locations</p></div>
        ${listSearch('locations', 'Search customer, address, contact, dock notes')}
        <div class="table-wrap"><table>
          <thead><tr><th>Location</th><th>Use</th><th>Contact</th><th>Receiving Details</th></tr></thead>
          <tbody data-filter-list="locations">
            ${rows || '<tr><td colspan="4">No saved locations yet</td></tr>'}
            <tr data-filter-empty hidden><td colspan="4">No matching locations</td></tr>
          </tbody>
        </table></div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Add Location</h3><p>Build the company address book used by dispatch.</p></div>
        <form id="locationForm" class="stack compact">
          <label>Customer<input name="customer" list="locationCustomerNames" placeholder="Customer account" /></label>
          <div class="split"><label>Location name<input name="name" placeholder="Shipper, receiver, yard, dock" /></label><label>Type<select name="type"><option value="both">Pickup & delivery</option><option value="pickup">Pickup only</option><option value="delivery">Delivery only</option></select></label></div>
          <label>Address<input name="address" required autocomplete="street-address" list="allAddresses" data-address-input="name" data-address-type="all" /></label>
          <div class="split"><label>Contact<input name="contactName" /></label><label>Phone<input name="phone" /></label></div>
          <label>Email<input name="email" type="email" /></label>
          <div class="split"><label>Hours<input name="hours" placeholder="Mon-Fri 7-3" /></label><label>Dock notes<input name="dockNotes" placeholder="Door, buzzer, gate code" /></label></div>
          <label>Notes<textarea name="notes" placeholder="Appointment process, check-in instructions, lumper notes"></textarea></label>
          <button class="btn primary" type="submit">Save Location</button>
          <datalist id="locationCustomerNames">${customers.map(name => `<option value="${attr(name)}"></option>`).join('')}</datalist>
          ${renderAddressDatalist('allAddresses', 'all')}
        </form>
        <div class="data-entry-hints">
          <article><strong>Faster load entry</strong><span>Saved stops appear as dropdowns on the dispatch form.</span></article>
          <article><strong>Cleaner handoffs</strong><span>Contacts, hours, and dock notes stay with the company record.</span></article>
          <article><strong>Less repeat typing</strong><span>New load addresses are remembered automatically after creation.</span></article>
        </div>
      </section>
    </div>`;
}

function renderCustomerTracking() {
  const records = customerTrackingRecords();
  const activeCustomers = records.filter(record => record.active.length).length;
  const openLoads = records.reduce((count, record) => count + record.active.length, 0);
  const customerDocs = records.reduce((count, record) => count + record.documents, 0);
  return `
    <div class="dashboard-grid customer-summary">
      <div class="metric-card glass"><span>Tracked Customers</span><strong>${records.length}</strong></div>
      <div class="metric-card glass"><span>Customers With Active Loads</span><strong>${activeCustomers}</strong></div>
      <div class="metric-card glass"><span>Open Customer Loads</span><strong>${openLoads}</strong></div>
      <div class="metric-card glass"><span>BOL / POD Files</span><strong>${customerDocs}</strong></div>
    </div>
    <section class="panel glass customer-tracking-panel">
      <div class="panel-head"><h3>Customer Tracking</h3><p>Monitor customer loads, driver updates, site contacts, and proof documents.</p></div>
      ${listSearch('customerTracking', 'Search customer, load, address, driver, or status')}
      <div class="customer-tracking-grid" data-filter-list="customerTracking">
        ${records.map(renderCustomerTrackingCard).join('') || emptyState('No customer activity yet', 'Create loads or save customer locations to begin tracking customer work.')}
        <div data-filter-empty hidden>${emptyState('No matching customers', 'Try another customer, load number, driver, address, or status.')}</div>
      </div>
    </section>`;
}

function renderCustomerTrackingCard(record) {
  const latest = record.latestLoad;
  const recentLoads = [...record.loads].sort((a, b) => String(loadLastActivity(b)).localeCompare(String(loadLastActivity(a)))).slice(0, 4);
  const search = searchableText(
    record.name,
    record.addresses.map(item => `${item.name} ${item.address} ${item.contactName} ${item.phone}`).join(' '),
    record.loads.map(load => `${load.loadNumber} ${load.status} ${load.pickupAddress} ${load.deliveryAddress}`).join(' '),
    record.drivers.join(' ')
  );
  return `<article class="customer-track-card" data-search="${search}">
    <div class="customer-track-head">
      <div>
        <strong>${esc(record.name)}</strong>
        <p class="tiny">${record.addresses.length} saved location${record.addresses.length === 1 ? '' : 's'} &middot; ${record.loads.length} load${record.loads.length === 1 ? '' : 's'}</p>
      </div>
      ${latest ? loadStatusTag(latest) : statusTag('no loads')}
    </div>
    <div class="customer-track-metrics">
      <span><b>${record.active.length}</b> active</span>
      <span><b>${record.delivered.length}</b> delivered</span>
      <span><b>${record.documents}</b> docs</span>
    </div>
    <div class="customer-track-detail">
      <div>
        <p class="tiny">Latest activity</p>
        <strong>${latest ? `${esc(latest.loadNumber)} - ${esc(loadStatusLabel(latest.status))}` : 'No loads yet'}</strong>
        <p class="tiny">${latest ? fmt(loadLastActivity(latest)) : 'Save customer locations or create a load to start tracking.'}</p>
      </div>
      <div>
        <p class="tiny">Assigned drivers</p>
        <strong>${esc(record.drivers.slice(0, 3).join(', ') || 'Unassigned')}</strong>
        <p class="tiny">${record.drivers.length > 3 ? `${record.drivers.length - 3} more driver(s)` : 'Current load driver coverage'}</p>
      </div>
    </div>
    <div class="customer-track-stops">
      ${recentLoads.map(load => `<div>
        <span>${esc(load.loadNumber)}</span>
        <strong>${esc(load.pickupName || load.pickupAddress || 'Pickup')}</strong>
        <p>${esc(load.deliveryName || load.deliveryAddress || 'Delivery')}</p>
        <small>${esc(loadStatusLabel(load.status))} &middot; ${driverName(load.driverId)}</small>
      </div>`).join('') || '<p class="tiny">No load history for this customer yet.</p>'}
    </div>
    <div class="customer-contact-strip">
      ${(record.contacts.length ? record.contacts.slice(0, 2) : record.addresses.slice(0, 2)).map(item => `<span>${esc(item.contactName || item.name || 'Site contact')} ${item.phone ? `&middot; ${esc(item.phone)}` : ''}${item.hours ? ` &middot; ${esc(item.hours)}` : ''}</span>`).join('') || '<span>No saved contacts yet</span>'}
    </div>
    <button class="btn ghost small-btn copy-customer-update" type="button" data-customer="${attr(record.name)}">Copy Customer Update</button>
  </article>`;
}

function renderSettings() {
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Company Settings</h3><p>Operational setup for this company workspace.</p></div>
        <div class="list-grid">
          <article class="list-card"><strong>Company</strong><p class="tiny">${esc(getCurrentCompany()?.name || 'No company selected')}</p></article>
          <article class="list-card"><strong>Company ID</strong><p class="tiny">${esc(getCurrentCompany()?.code || 'Assigned when company is created')}</p></article>
          <article class="list-card"><strong>Equipment Types</strong><p class="tiny">${equipmentTypes.length} power unit and trailer/equipment options available.</p></article>
          <article class="list-card"><strong>Inspection Checklist</strong><p class="tiny">${inspectionItems.length} inspection items active.</p></article>
          <article class="list-card"><strong>Address Autocomplete</strong><p class="tiny">Saved company addresses are active. Geoapify is enabled when GEOAPIFY_API_KEY is configured in Railway.</p></article>
        </div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Configuration Roadmap</h3><p>Items to make editable in the next pass.</p></div>
        <div class="list-grid">
          <article class="list-card"><strong>Custom checklists</strong><p class="tiny">Per-equipment inspection templates.</p></article>
          <article class="list-card"><strong>Notification rules</strong><p class="tiny">Late check-ins, failed inspections, and delivery exceptions.</p></article>
          <article class="list-card"><strong>Address book management</strong><p class="tiny">Edit, merge, and archive saved locations.</p></article>
        </div>
      </section>
    </div>`;
}

function renderBugReports() {
  const canReview = state.user?.role !== 'driver';
  return `
    <div class="two-col">
      ${canReview ? `<section class="panel glass">
        <div class="panel-head"><h3>Reported Bugs</h3><p>Open app issues from drivers and staff.</p></div>
        ${listSearch('bugList', 'Search title, reporter, page, priority, or status')}
        <div class="issue-list" data-filter-list="bugList">${state.bugReports.map(report => `
          <article class="issue-card" data-search="${searchableText(report.title, report.reporterName, report.reporterRole, report.page, report.category, report.priority, report.status, report.description)}">
            <div class="panel-head"><div><strong>${esc(report.title)}</strong><p class="tiny">${esc(report.reporterName || 'Unknown')} &middot; ${fmt(report.createdAt)} &middot; ${esc(report.page || 'No page')}</p></div><div class="stack-right">${statusTag(report.priority)}${statusTag(report.status)}</div></div>
            <p>${esc(report.description || '')}</p>
            ${report.photos?.length ? `<div class="photo-row">${report.photos.map(p => `<a class="doc-thumb" href="${attr(p.url)}" target="_blank" rel="noopener"><img src="${attr(p.url)}" alt="bug screenshot" /><span>shot</span></a>`).join('')}</div>` : ''}
            ${report.status !== 'closed' ? `<button class="btn primary small-btn close-bug" data-id="${attr(report.id)}">Mark Fixed</button>` : `<p class="tiny">Closed ${fmt(report.closedAt)}</p>`}
          </article>`).join('') || emptyState('No bug reports yet', 'Reports from drivers and staff will appear here.')}<div data-filter-empty hidden>${emptyState('No matching bug reports', 'Try another title, page, reporter, or status.')}</div></div>
      </section>` : ''}
      <section class="panel glass ${canReview ? '' : 'mobile-card'}">
        <div class="panel-head"><h3>Report a Bug</h3><p>Send the page, what happened, and an optional screenshot.</p></div>
        <form id="bugReportForm" class="stack compact" enctype="multipart/form-data">
          <input type="hidden" name="page" value="${attr(getViewTitle(state.activeView || ''))}" />
          <label>Title<input name="title" required placeholder="Example: Cannot upload BOL" /></label>
          <div class="split"><label>Type<select name="category"><option value="bug">Bug</option><option value="data_issue">Data Issue</option><option value="feature_request">Feature Request</option><option value="training">Training / Confusing</option></select></label><label>Priority<select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div>
          <label>Description<textarea name="description" required placeholder="What did you expect, and what happened?"></textarea></label>
          <label>Screenshot / photo<input class="photo-input" data-preview="bugPreview" type="file" name="photos" multiple accept="image/*" /></label>
          <div class="photo-row" id="bugPreview"></div>
          <button class="btn primary" type="submit">Submit Bug Report</button>
        </form>
      </section>
    </div>`;
}

function renderNotifications() {
  const unread = state.notifications.filter(item => !item.readAt);
  const recent = [...state.notifications].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return `<div class="two-col">
    <section class="panel glass">
      <div class="panel-head"><h3>Notifications</h3><p>${unread.length} unread alert${unread.length === 1 ? '' : 's'}</p></div>
      <div class="metric-grid">
        <div class="metric-card glass"><span>Unread</span><strong>${unread.length}</strong></div>
        <div class="metric-card glass"><span>Total</span><strong>${state.notifications.length}</strong></div>
      </div>
      <div class="issue-list">
        ${recent.map(item => `
          <article class="list-card ${item.readAt ? '' : 'highlight'}">
            <div class="card-row">
              <div><strong>${esc(item.title)}</strong><p class="tiny">${esc(item.message || '')}</p></div>
              ${statusTag(item.severity || item.type || 'info')}
            </div>
            <p class="tiny">${fmt(item.createdAt)}${item.readAt ? ` &middot; Read ${fmt(item.readAt)}` : ''}</p>
            <div class="action-row">
              ${item.link ? `<button class="btn ghost small-btn notification-link" data-link="${attr(item.link)}">${appIcon('link')}Open</button>` : ''}
              ${!item.readAt ? `<button class="btn primary small-btn mark-notification-read" data-id="${attr(item.id)}">Mark Read</button>` : ''}
            </div>
          </article>`).join('') || emptyState('No notifications yet', 'Load updates, new signups, documents, and bug reports will appear here.')}
      </div>
    </section>
    <section class="panel glass">
      <div class="panel-head"><h3>Alert Rules</h3><p>Operational events captured automatically</p></div>
      <div class="list-grid">
        <article class="list-card"><strong>Company Signups</strong><p class="tiny">Super admins are alerted when a company needs approval.</p></article>
        <article class="list-card"><strong>Load Assignments</strong><p class="tiny">Drivers and dispatch see new assigned work.</p></article>
        <article class="list-card"><strong>Status Updates</strong><p class="tiny">Pickup, delivery, POD, and close events create alerts.</p></article>
        <article class="list-card"><strong>Documents & Bugs</strong><p class="tiny">Uploaded POD/BOL files and bug reports notify staff.</p></article>
      </div>
    </section>
  </div>`;
}

function renderDriverWorkspace() {
  const driverId = state.user.role === 'driver'
    ? state.user.linkedDriverId
    : (state.selectedDriverId || state.drivers[0]?.id || null);
  const driver = byId(state.drivers, driverId) || {};
  const assignment = state.assignments.find(a => a.driverId === driverId && a.active);
  const vehicle = assignment ? byId(state.vehicles, assignment.vehicleId) : null;
  const activeShift = state.shifts.find(s => s.driverId === driverId && s.status === 'started');

  return `
    <section class="mobile-stage">
      ${state.user.role !== 'driver' ? `
      <div class="driver-picker glass">
        <label>Preview Driver Mobile<select id="driverPicker">${state.drivers.map(d => `<option value="${attr(d.id)}" ${d.id === driverId ? 'selected' : ''}>${esc(`${d.firstName || ''} ${d.lastName || ''}`.trim())}</option>`).join('')}</select></label>
      </div>` : ''}
      <div class="phone-frame">
        <div class="phone-notch"></div>
        <div class="phone-screen">
          <div class="mobile-header">
            <div>
              <p class="eyebrow">Driver workspace</p>
              <h2>${esc(`${driver.firstName || ''} ${driver.lastName || ''}`.trim())}</h2>
            </div>
            ${activeShift ? statusTag('started') : statusTag('ready')}
          </div>
          <div class="mobile-card primary-card">
            <div><p class="tiny">Assigned vehicle</p><strong>${vehicle ? esc(vehicle.unitNumber) : 'Not assigned'}</strong></div>
            <div><p class="tiny">Vehicle status</p>${vehicle ? statusTag(vehicle.status) : '—'}</div>
          </div>
          <div class="mobile-actions">
            <div class="quick-action-grid">
              <div class="mobile-mini-card gps-status-card" id="gpsStatusCard" data-status="${driver.lastSeenAt ? 'tracking' : 'idle'}"><span>GPS Status</span><strong id="gpsStatusTitle">${driver.lastSeenAt ? 'Tracking active' : 'Not tracking'}</strong><small id="gpsStatusMessage">${driver.lastSeenAt ? 'Driver location is updating.' : 'Tap Allow GPS to start location tracking.'}</small><small id="gpsStatusMeta">${driver.lastSeenAt ? fmt(driver.lastSeenAt) : ''}</small><div class="mini-actions"><button class="btn primary small-btn" type="button" id="allowGpsBtn">Allow GPS</button><button class="btn ghost small-btn" type="button" id="syncGpsBtn">Sync Now</button></div></div>
              <div class="mobile-mini-card"><span>Open issues</span><strong>${state.issues.filter(i => Number(i.driverId) === Number(driver.id) && i.status !== 'closed').length}</strong><small>Need attention</small></div>
            </div>
            ${vehicle && !activeShift ? `<form id="startShiftForm" class="stack compact"><input type="hidden" name="vehicleId" value="${attr(vehicle.id)}" /><label>Start odometer<input type="number" name="startOdometer" required /></label><button class="btn primary" type="submit" id="startShiftBtn">Start Shift</button></form>` : ''}
            ${activeShift ? `<form id="endShiftForm" class="stack compact"><input type="hidden" name="shiftId" value="${attr(activeShift.id)}" /><label>End odometer<input type="number" name="endOdometer" required /></label><button class="btn ghost" type="submit" id="endShiftBtn">End Shift</button></form>` : ''}
          </div>
          ${vehicle ? `
            <form id="inspectionForm" class="mobile-card stack compact" enctype="multipart/form-data">
              <h3>Pre-trip Inspection</h3>
              <input type="hidden" name="vehicleId" value="${attr(vehicle.id)}" />
              <input type="hidden" name="shiftId" value="${attr(activeShift?.id || '')}" />
              <label>Current odometer<input type="number" name="odometer" required /></label>
              <label>Overall result<select name="overallStatus"><option value="pass">Pass</option><option value="pass_with_defects">Pass With Defects</option><option value="fail">Fail</option></select></label>
              <div class="checklist">${inspectionItems.map(item => `<div class="check-row"><span>${esc(item)}</span><div><label><input type="radio" name="${attr(item)}" value="pass" checked />P</label><label><input type="radio" name="${attr(item)}" value="fail" />F</label><label><input type="radio" name="${attr(item)}" value="na" />N/A</label></div><input name="note_${attr(item)}" placeholder="Notes" /></div>`).join('')}</div>
              <label>General notes<textarea name="notes"></textarea></label>
              <label class="inline-check"><input type="checkbox" name="issueFlag" value="true" /> Create issue from inspection</label>
              <div class="split"><label>Category<select name="category"><option value="mechanical">Mechanical</option><option value="lights">Lights</option><option value="tires">Tires</option><option value="body_damage">Body Damage</option><option value="safety">Safety</option><option value="other">Other</option></select></label><label>Severity<select name="severity"><option value="low">Low</option><option value="medium">Medium</option><option value="critical">Critical</option></select></label></div>
              <label>Issue description<textarea name="issueDescription"></textarea></label>
              <label>Photos<input class="photo-input" data-preview="inspectionPreview" type="file" name="photos" multiple accept="image/*" capture="environment" /></label>
              <div class="photo-row" id="inspectionPreview"></div>
              <button class="btn primary" type="submit" id="inspectionSubmitBtn">Submit Inspection</button>
            </form>
            <form id="quickIssueForm" class="mobile-card stack compact" enctype="multipart/form-data">
              <h3>Quick Issue Report</h3>
              <input type="hidden" name="vehicleId" value="${attr(vehicle.id)}" />
              <input type="hidden" name="shiftId" value="${attr(activeShift?.id || '')}" />
              <div class="split"><label>Category<select name="category"><option value="mechanical">Mechanical</option><option value="lights">Lights</option><option value="tires">Tires</option><option value="body_damage">Body Damage</option><option value="safety">Safety</option><option value="other">Other</option></select></label><label>Severity<select name="severity"><option value="low">Low</option><option value="medium">Medium</option><option value="critical">Critical</option></select></label></div>
              <label>Description<textarea name="description" required></textarea></label>
              <label>Photos<input class="photo-input" data-preview="issuePreview" type="file" name="photos" multiple accept="image/*" capture="environment" /></label>
              <div class="photo-row" id="issuePreview"></div>
              <button class="btn ghost" type="submit" id="issueSubmitBtn">Report Issue</button>
            </form>` : `<div class="mobile-card"><p>No vehicle assigned yet.</p></div>`}
        </div>
      </div>
    </section>`;
}

function renderDriverWorkPage() {
  const driverId = state.user.role === 'driver'
    ? state.user.linkedDriverId
    : (state.selectedDriverId || state.drivers[0]?.id || null);
  const driver = byId(state.drivers, driverId) || {};
  const driverLoads = state.loads.filter(load => Number(load.driverId) === Number(driverId) && !['closed', 'cancelled'].includes(load.status));
  const deliveredLoads = state.loads.filter(load => Number(load.driverId) === Number(driverId) && ['delivered', 'pod_uploaded', 'closed'].includes(load.status)).slice(0, 5);
  return `
    <section class="mobile-stage">
      <div class="mobile-card primary-card">
        <div><p class="tiny">Driver</p><strong>${esc(`${driver.firstName || ''} ${driver.lastName || ''}`.trim()) || 'Driver'}</strong></div>
        <div><p class="tiny">Active work</p><strong>${driverLoads.length}</strong></div>
      </div>
      <div class="mobile-card stack compact">
        <div class="panel-head"><h3>Assigned Loads</h3><p>Pickup, delivery, BOL, POD, and check-ins.</p></div>
        ${driverLoads.map(renderDriverLoadCard).join('') || '<p class="tiny">No active loads assigned.</p>'}
      </div>
      <div class="mobile-card stack compact">
        <div class="panel-head"><h3>Recent Delivered</h3><p>Latest completed loads</p></div>
        ${deliveredLoads.map(load => renderLoadCard(load, false)).join('') || '<p class="tiny">No delivered loads yet.</p>'}
      </div>
    </section>`;
}

function renderDriverLoadCard(load) {
  const nextStatus = nextLoadStatus(load);
  const missing = loadMissingDocs(load);
  return `<article class="load-card driver-load-card">
    <div class="card-row"><div><strong>${esc(load.loadNumber)}</strong><p class="tiny">${esc(loadTypeLabel(load.loadType || 'dry_van'))}</p></div>${loadStatusTag(load)}</div>
    <div class="load-stop"><span>PU</span><div><strong>${esc(load.pickupName || 'Pickup')}</strong><p>${esc(load.pickupAddress || '')}</p><p class="tiny">${fmt(load.pickupAppointment)}</p></div></div>
    <div class="load-stop"><span>DEL</span><div><strong>${esc(load.deliveryName || 'Delivery')}</strong><p>${esc(load.deliveryAddress || '')}</p><p class="tiny">${fmt(load.deliveryAppointment)}</p></div></div>
    ${renderLoadChecklist(load)}
    ${missing.length ? `<p class="tiny">Upload required proof before delivery close: ${missing.map(docTypeLabel).join(', ')}</p>` : ''}
    <div class="load-actions">
      ${loadStatusFlow.map(([status, label]) => `<button class="btn ${status === nextStatus ? 'primary' : 'ghost'} small-btn load-status-btn" data-load-id="${attr(load.id)}" data-status="${attr(status)}">${esc(label)}</button>`).join('')}
      <button class="btn ghost small-btn load-status-btn" data-load-id="${attr(load.id)}" data-status="exception">Exception</button>
    </div>
    <form class="load-doc-form stack compact" data-load-doc="${attr(load.id)}" enctype="multipart/form-data">
      <div class="split"><label>Document type<select name="type">${renderLoadDocumentTypeOptions(load)}</select></label><label>Photo<input class="photo-input" data-preview="loadPreview${attr(load.id)}" type="file" name="photos" multiple accept="image/*" capture="environment" /></label></div>
      <label>Note<input name="note" placeholder="Optional document note" /></label>
      <div class="photo-row" id="loadPreview${attr(load.id)}"></div>
      <button class="btn primary small-btn" type="submit">Upload BOL / POD</button>
    </form>
    <details class="signature-panel">
      <summary>Capture BOL Signature</summary>
      <form class="load-signature-form stack compact" data-load-signature="${attr(load.id)}">
        <label>Signer name<input name="signerName" placeholder="Receiver or carrier name" required /></label>
        <canvas class="signature-pad" width="420" height="160" data-signature-pad="${attr(load.id)}"></canvas>
        <div class="load-actions"><button class="btn ghost small-btn clear-signature" type="button" data-clear-signature="${attr(load.id)}">Clear</button><button class="btn primary small-btn" type="submit">Save Signature</button><a class="btn ghost small-btn" href="/bol/${attr(load.id)}" target="_blank" rel="noopener">Print BOL</a></div>
      </form>
    </details>
  </article>`;
}

function bindView(view) {
  bindListFilters();
  if (view === 'companies') {
    const form = document.getElementById('companyForm');
    if (form) form.onsubmit = submitJsonForm('/api/companies');
    document.querySelectorAll('.approve-company').forEach(btn => btn.onclick = async () => {
      try {
        await api(`/api/companies/${btn.dataset.companyId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' })
        });
        await loadEverything();
        render();
        setToast('Company approved', 'success');
      } catch (error) {
        setToast(error.message, 'error');
      }
    });
  }
  if (view === 'users') {
    const form = document.getElementById('userForm');
    if (form) form.onsubmit = submitJsonForm('/api/users');
  }
  if (view === 'drivers') {
    const form = document.getElementById('driverForm');
    if (form) form.onsubmit = submitJsonForm('/api/drivers');
    document.querySelectorAll('[data-driver-focus]').forEach(btn => btn.onclick = () => {
      state.selectedDriverId = Number(btn.dataset.driverFocus);
      render();
    });
  }
  if (view === 'vehicles') {
    const form = document.getElementById('vehicleForm');
    if (form) form.onsubmit = submitJsonForm('/api/vehicles');
    bindVehicleCatalogPicker();
  }
  if (view === 'assignments') {
    const form = document.getElementById('assignmentForm');
    if (form) form.onsubmit = submitJsonForm('/api/assignments');
  }
  if (view === 'loads') {
    const form = document.getElementById('loadForm');
    if (form) form.onsubmit = submitJsonForm('/api/loads');
    const addressForm = document.getElementById('addressForm');
    if (addressForm) addressForm.onsubmit = submitJsonForm('/api/addresses');
    bindAddressInputs();
    bindLoadEntryHelpers();
    bindTrackingLinks();
  }
  if (view === 'locations') {
    const form = document.getElementById('locationForm');
    if (form) form.onsubmit = submitJsonForm('/api/addresses');
    bindAddressInputs();
  }
  if (view === 'customerTracking') {
    bindCustomerTracking();
  }
  if (view === 'map') {
    startMapRefresh();
    setTimeout(initActualMap, 0);
    document.querySelectorAll('[data-driver-focus],[data-driver-marker]').forEach(btn => btn.onclick = () => {
      state.selectedDriverId = Number(btn.dataset.driverFocus || btn.dataset.driverMarker);
      render();
    });
  } else {
    stopMapRefresh();
  }
  if (view === 'issues') {
    document.querySelectorAll('.close-issue').forEach(btn => btn.onclick = async () => {
      try {
        await api(`/api/issues/${btn.dataset.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed', resolutionNotes: 'Closed from issue queue' })
        });
        await loadEverything();
        render();
        setToast('Issue closed', 'success');
      } catch (error) {
        setToast(error.message, 'error');
      }
    });
  }
  if (view === 'bugReports') {
    bindPhotoPreviews();
    const form = document.getElementById('bugReportForm');
    if (form) form.onsubmit = async e => {
      e.preventDefault();
      const btn = e.submitter || form.querySelector('button[type="submit"]');
      await guardedSubmit('bugReport', btn, 'Submitting...', async () => {
        const fd = new FormData(form);
        await api('/api/bug-reports', { method: 'POST', body: fd });
        form.reset();
        await loadEverything();
        render();
        setToast('Bug report submitted', 'success');
      });
    };
    document.querySelectorAll('.close-bug').forEach(btn => btn.onclick = async () => {
      try {
        await api(`/api/bug-reports/${btn.dataset.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed', resolutionNotes: 'Marked fixed from bug reports' })
        });
        await loadEverything();
        render();
        setToast('Bug report closed', 'success');
      } catch (error) {
        setToast(error.message, 'error');
      }
    });
  }
  if (view === 'notifications') {
    document.querySelectorAll('.mark-notification-read').forEach(btn => btn.onclick = async () => {
      try {
        await api(`/api/notifications/${btn.dataset.id}/read`, { method: 'PATCH' });
        await loadEverything();
        render();
        setToast('Notification marked read', 'success');
      } catch (error) {
        setToast(error.message, 'error');
      }
    });
    document.querySelectorAll('.notification-link').forEach(btn => btn.onclick = () => {
      const viewName = String(btn.dataset.link || '').replace('#', '');
      if (viewName && canAccessView(viewName)) {
        state.activeView = viewName;
        render();
      }
    });
  }
  if (view === 'driver') bindDriverWorkspace();
  if (view === 'driverWork') bindDriverWorkPage();
}

function bindListFilters() {
  document.querySelectorAll('[data-filter-target]').forEach(input => {
    input.oninput = () => {
      const target = document.querySelector(`[data-filter-list="${CSS.escape(input.dataset.filterTarget)}"]`);
      if (!target) return;
      const query = input.value.trim().toLowerCase();
      let visible = 0;
      target.querySelectorAll('[data-search]').forEach(item => {
        const match = !query || item.dataset.search.includes(query);
        item.hidden = !match;
        if (match) visible += 1;
      });
      const empty = target.querySelector('[data-filter-empty]');
      if (empty) empty.hidden = visible > 0;
    };
  });
}

function bindCustomerTracking() {
  const records = customerTrackingRecords();
  document.querySelectorAll('.copy-customer-update').forEach(btn => {
    btn.onclick = async () => {
      const record = records.find(item => item.name === btn.dataset.customer);
      if (!record) return;
      const text = customerUpdateText(record);
      try {
        await navigator.clipboard.writeText(text);
        setToast('Customer update copied', 'success');
      } catch {
        setToast(text, 'success');
      }
    };
  });
}

function bindTrackingLinks() {
  document.querySelectorAll('.copy-tracking-link').forEach(btn => {
    btn.onclick = async () => {
      const text = btn.dataset.url || '';
      try {
        await navigator.clipboard.writeText(text);
        setToast('Customer tracking link copied', 'success');
      } catch {
        setToast(text, 'success');
      }
    };
  });
  document.querySelectorAll('.customer-visibility-form').forEach(form => {
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = e.submitter || form.querySelector('button[type="submit"]');
      await guardedSubmit(`visibility${form.dataset.loadVisibility}`, btn, 'Saving...', async () => {
        const fd = new FormData(form);
        await api(`/api/loads/${form.dataset.loadVisibility}/customer-visibility`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerEmail: fd.get('customerEmail') || '',
            customerPhone: fd.get('customerPhone') || '',
            publicDocumentTypes: fd.getAll('publicDocumentTypes')
          })
        });
        await loadEverything();
        render();
        setToast('Customer visibility updated', 'success');
      });
    };
  });
}

function bindDriverWorkPage() {
  bindPhotoPreviews();
  bindSignaturePads();
  document.querySelectorAll('.load-status-btn').forEach(btn => btn.onclick = async () => {
    try {
      await api(`/api/loads/${btn.dataset.loadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: btn.dataset.status, note: 'Driver update' })
      });
      await loadEverything();
      render();
      setToast('Load updated', 'success');
    } catch (error) {
      setToast(error.message, 'error');
    }
  });

  document.querySelectorAll('.load-doc-form').forEach(form => form.onsubmit = async e => {
    e.preventDefault();
    const btn = e.submitter || form.querySelector('button[type="submit"]');
    await guardedSubmit(`loadDoc${form.dataset.loadDoc}`, btn, 'Uploading...', async () => {
      const fd = new FormData(form);
      await api(`/api/loads/${form.dataset.loadDoc}/documents`, { method: 'POST', body: fd });
      await loadEverything();
      render();
      setToast('Document uploaded', 'success');
    });
  });
}

function bindSignaturePads() {
  document.querySelectorAll('.signature-pad').forEach(canvas => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#f4f7fb';
    let drawing = false;
    let signed = false;
    const point = event => {
      const rect = canvas.getBoundingClientRect();
      const touch = event.touches?.[0] || event.changedTouches?.[0];
      const source = touch || event;
      return {
        x: (source.clientX - rect.left) * (canvas.width / rect.width),
        y: (source.clientY - rect.top) * (canvas.height / rect.height)
      };
    };
    const start = event => {
      event.preventDefault();
      drawing = true;
      signed = true;
      const p = point(event);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };
    const move = event => {
      if (!drawing) return;
      event.preventDefault();
      const p = point(event);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const end = event => {
      if (!drawing) return;
      event.preventDefault();
      drawing = false;
    };
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
    const clearBtn = document.querySelector(`[data-clear-signature="${CSS.escape(canvas.dataset.signaturePad)}"]`);
    if (clearBtn) clearBtn.onclick = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); signed = false; };
    const form = canvas.closest('.load-signature-form');
    if (form) form.onsubmit = async event => {
      event.preventDefault();
      if (!signed) return setToast('Please draw a signature first', 'error');
      const btn = event.submitter || form.querySelector('button[type="submit"]');
      await guardedSubmit(`signature${form.dataset.loadSignature}`, btn, 'Saving...', async () => {
        const body = Object.fromEntries(new FormData(form));
        body.signatureDataUrl = canvas.toDataURL('image/png');
        await api(`/api/loads/${form.dataset.loadSignature}/signature`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        await loadEverything();
        render();
        setToast('Signature saved', 'success');
      });
    };
  });
}

function bindDriverWorkspace() {
  const picker = document.getElementById('driverPicker');
  if (picker) picker.onchange = () => { state.selectedDriverId = Number(picker.value); render(); };

  const gpsBtn = document.getElementById('allowGpsBtn');
  if (gpsBtn) {
    if (state.user?.role === 'driver') {
      gpsBtn.onclick = async () => {
        await requestDriverTracking(true);
      };
    } else {
      gpsBtn.disabled = true;
      gpsBtn.textContent = 'Driver only';
    }
  }
  const syncGpsBtn = document.getElementById('syncGpsBtn');
  if (syncGpsBtn) {
    if (state.user?.role === 'driver') {
      syncGpsBtn.onclick = async () => {
        await requestDriverTracking(true);
      };
    } else {
      syncGpsBtn.disabled = true;
    }
  }
  if (state.user?.role === 'driver') {
    if (state.gpsStatus === 'tracking') {
      setGpsState('tracking', 'Driver location is updating.', { lastUpdate: state.gpsLastUpdate || Date.now(), accuracy: state.gpsAccuracy });
    } else if (state.gpsStatus === 'blocked') {
      setGpsState('blocked', 'Location access is blocked. Enable it in browser settings and try again.');
    } else {
      setGpsState('idle', 'GPS will start automatically once permission is available.');
      requestDriverTracking(false);
    }
  }

  const startShiftForm = document.getElementById('startShiftForm');
  if (startShiftForm) startShiftForm.onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById('startShiftBtn') || e.submitter;
    await guardedSubmit('startShift', btn, 'Starting...', async () => {
      const body = Object.fromEntries(new FormData(e.target));
      await api('/api/shifts/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await requestDriverTracking(false);
      await loadEverything();
      render();
      setToast('Shift started', 'success');
    });
  };

  const endShiftForm = document.getElementById('endShiftForm');
  if (endShiftForm) endShiftForm.onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById('endShiftBtn') || e.submitter;
    await guardedSubmit('endShift', btn, 'Ending...', async () => {
      const body = Object.fromEntries(new FormData(e.target));
      await api('/api/shifts/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await loadEverything();
      render();
      setToast('Shift ended', 'success');
    });
  };

  bindPhotoPreviews();
  const inspectionForm = document.getElementById('inspectionForm');
  if (inspectionForm) inspectionForm.onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById('inspectionSubmitBtn') || e.submitter;
    await guardedSubmit('inspection', btn, 'Submitting...', async () => {
      const fd = new FormData(e.target);
      const items = inspectionItems.map(item => ({ item, result: fd.get(item), notes: fd.get(`note_${item}`) || '' }));
      fd.append('itemResults', JSON.stringify(items));
      await api('/api/inspections', { method: 'POST', body: fd });
      await loadEverything();
      render();
      setToast('Inspection submitted', 'success');
    });
  };

  const quickIssueForm = document.getElementById('quickIssueForm');
  if (quickIssueForm) quickIssueForm.onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById('issueSubmitBtn') || e.submitter;
    await guardedSubmit('issue', btn, 'Submitting...', async () => {
      const fd = new FormData(e.target);
      await api('/api/issues', { method: 'POST', body: fd });
      await loadEverything();
      render();
      setToast('Issue reported', 'success');
    });
  };

}


function stopDriverTracking() {
  if (state.trackingWatch) navigator.geolocation?.clearWatch?.(state.trackingWatch);
  if (state.trackingTimer) clearInterval(state.trackingTimer);
  state.trackingWatch = null;
  state.trackingTimer = null;
}

function stopMapRefresh() {
  if (state.mapRefreshTimer) clearInterval(state.mapRefreshTimer);
  state.mapRefreshTimer = null;
  if (state.leafletMap) {
    state.leafletMap.remove();
    state.leafletMap = null;
  }
}

function startMapRefresh() {
  stopMapRefresh();
  if (state.activeView !== 'map' || !isStaffLike()) return;
  state.mapRefreshTimer = setInterval(async () => {
    try {
      await loadEverything();
      if (state.activeView === 'map') render();
    } catch (error) {
      console.warn('Map refresh failed', error.message);
    }
  }, 15000);
}

function initActualMap() {
  const mapEl = document.getElementById('realMap');
  if (!mapEl || typeof L === 'undefined') return;
  if (state.leafletMap) {
    state.leafletMap.remove();
    state.leafletMap = null;
  }
  const tracked = state.drivers.filter(hasUsableCoords);
  const center = tracked[0] ? [Number(tracked[0].lastLat), Number(tracked[0].lastLng)] : [43.6532, -79.3832];
  const map = L.map(mapEl, { scrollWheelZoom: true, zoomControl: true }).setView(center, tracked.length > 1 ? 10 : 12);
  state.leafletMap = map;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const bounds = [];
  for (const driver of tracked) {
    const latLng = [Number(driver.lastLat), Number(driver.lastLng)];
    bounds.push(latLng);
    const marker = L.marker(latLng, {
      icon: L.divIcon({
        className: `leaflet-driver-pin ${trackingState(driver)}`,
        html: `<span>${esc(driverInitials(driver))}</span><small>${esc(driver.firstName || 'Driver')}</small>`,
        iconSize: [54, 66],
        iconAnchor: [27, 27]
      })
    }).addTo(map);
    marker.bindPopup(`<strong>${esc(`${driver.firstName || ''} ${driver.lastName || ''}`.trim())}</strong><br>${esc(trackingLabel(driver))}<br>${Number(driver.lastLat).toFixed(5)}, ${Number(driver.lastLng).toFixed(5)}`);
    marker.on('click', () => {
      state.selectedDriverId = Number(driver.id);
      render();
    });
  }

  const selected = tracked.find(d => Number(d.id) === Number(state.selectedDriverId)) || tracked[0] || null;
  const trail = (selected?.locationHistory || []).filter(point => hasUsableCoords({ lastLat: point.lat, lastLng: point.lng })).slice(-50).map(point => [Number(point.lat), Number(point.lng)]);
  if (trail.length > 1) {
    L.polyline(trail, { color: '#43a6ff', weight: 4, opacity: .72 }).addTo(map);
    bounds.push(...trail);
  }
  if (bounds.length > 1) map.fitBounds(bounds, { padding: [42, 42] });
  setTimeout(() => map.invalidateSize(), 80);
}


async function pushDriverLocation(lat, lng, accuracy = null, options = {}) {
  const point = bufferLocationPoint(lat, lng, accuracy);
  state.gpsLastUpdate = Date.now();
  state.gpsAccuracy = accuracy;
  const force = !!options.force;
  await flushBufferedLocations(force);
  if (state.user?.linkedDriverId) {
    try {
      await loadEverything();
      if (state.activeView === 'map' || state.activeView === 'driver') render();
    } catch (error) {
      console.warn('Refresh after location update failed', error.message);
    }
  }
  return point;
}



async function requestDriverTracking(forcePrompt = false) {
  if (state.user?.role !== 'driver') return;
  if (state.gpsStatus === 'tracking' && state.trackingWatch && !forcePrompt) return;
  stopDriverTracking();
  loadLocationBuffer();
  state.lastServerSyncAt = getLastServerSyncAt();
  if (!navigator.geolocation) {
    setGpsState('error', 'This browser does not support GPS.');
    return;
  }

  const onSuccess = async position => {
    await pushDriverLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy, { force: true });
    setGpsState('tracking', 'Driver location is updating once per minute and stored locally between syncs.', { lastUpdate: Date.now(), accuracy: position.coords.accuracy });
  };
  const onError = error => {
    if (error?.code === 1) setGpsState('blocked', 'Location access is blocked. Please enable it in browser settings.');
    else if (error?.code === 3) setGpsState('pending', 'Still waiting for a GPS signal...');
    else setGpsState('error', error?.message || 'GPS unavailable.');
  };

  setGpsState(forcePrompt ? 'requesting' : 'pending', forcePrompt ? 'Requesting GPS permission...' : 'Waiting for GPS permission');
  navigator.geolocation.getCurrentPosition(async position => {
    await onSuccess(position);
    state.trackingWatch = navigator.geolocation.watchPosition(async pos => {
      bufferLocationPoint(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      setGpsState('tracking', 'Driver location is updating once per minute and stored locally between syncs.', { lastUpdate: Date.now(), accuracy: pos.coords.accuracy });
    }, onError, { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 });
    state.trackingTimer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, { enableHighAccuracy: true, maximumAge: 60000, timeout: 20000 });
    }, 60000);
  }, onError, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
}

function startDriverTracking() {
  if (state.user?.role !== 'driver') return;
  if (state.gpsStatus === 'tracking') return;
  if (state.user?.linkedDriverId && !state.trackingWatch) {
    requestDriverTracking(false);
  }
}


function submitJsonForm(url) {
  return async e => {
    e.preventDefault();
    const btn = e.submitter || e.target.querySelector('button[type="submit"]');
    await guardedSubmit(url, btn, 'Saving...', async () => {
      const body = Object.fromEntries(new FormData(e.target));
      if (!body.createLogin) delete body.userPassword;
      await api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      e.target.reset();
      await loadEverything();
      render();
      setToast('Saved successfully', 'success');
    });
  };
}

function bindAddressInputs() {
  document.querySelectorAll('[data-address-input]').forEach(input => {
    input.oninput = () => {
      const type = input.dataset.addressType || 'both';
      clearTimeout(state.addressLookupTimers[input.name]);
      state.addressLookupTimers[input.name] = setTimeout(() => lookupExternalAddresses(input, type), 350);
    };
    input.onchange = () => {
      const match = findAddressByValue(input.value);
      if (!match) return;
      const nameInput = input.form?.elements[input.dataset.addressInput];
      if (nameInput && !nameInput.value) nameInput.value = match.name || match.customer || '';
      const customerInput = input.form?.elements.customer;
      if (customerInput && !customerInput.value && match.customer) customerInput.value = match.customer;
    };
  });
}

function applyLocationToLoadForm(form, item, type) {
  if (!form || !item) return;
  const prefix = type === 'delivery' ? 'delivery' : 'pickup';
  const nameInput = form.elements[`${prefix}Name`];
  const addressInput = form.elements[`${prefix}Address`];
  if (nameInput) nameInput.value = item.name || item.customer || '';
  if (addressInput) addressInput.value = item.address || '';
  if (form.elements.customer && !form.elements.customer.value && item.customer) form.elements.customer.value = item.customer;
  const contactInput = form.elements[`${prefix}ContactName`];
  const phoneInput = form.elements[`${prefix}Phone`];
  const hoursInput = form.elements[`${prefix}Hours`];
  const dockInput = form.elements[`${prefix}DockType`];
  const siteNotesInput = form.elements[`${prefix}SiteNotes`];
  if (contactInput && !contactInput.value) contactInput.value = item.contactName || '';
  if (phoneInput && !phoneInput.value) phoneInput.value = item.phone || '';
  if (hoursInput && !hoursInput.value) hoursInput.value = item.hours || '';
  if (dockInput && !dockInput.value) dockInput.value = inferDockType(item.dockNotes || '');
  if (siteNotesInput && !siteNotesInput.value) siteNotesInput.value = item.dockNotes || item.notes || '';
}

function refreshLoadTypeControls(form) {
  if (!form) return;
  const loadType = form.elements.loadType?.value || 'dry_van';
  const rule = loadCompatibilityRules[loadType] || loadCompatibilityRules.dry_van;
  document.querySelectorAll('[data-load-type-panel]').forEach(panel => {
    panel.hidden = panel.dataset.loadTypePanel !== loadType;
  });
  const summary = document.getElementById('loadTypeSummary');
  if (summary) summary.textContent = loadTypeRuleSummary(loadType);
  const selectedPower = byId(state.vehicles, form.elements.vehicleId?.value);
  const selectedTrailer = byId(state.vehicles, form.elements.trailerId?.value);
  const powerSelect = form.elements.vehicleId;
  const trailerSelect = form.elements.trailerId;
  if (powerSelect) {
    [...powerSelect.options].forEach(option => {
      if (!option.value) return;
      const vehicle = byId(state.vehicles, option.value);
      option.disabled = vehicle ? (!vehicleCompatibleWithLoad(vehicle, loadType, 'power') || !vehicleAvailableForLoad(vehicle)) : false;
    });
    if (selectedPower && (!vehicleCompatibleWithLoad(selectedPower, loadType, 'power') || !vehicleAvailableForLoad(selectedPower))) powerSelect.value = '';
  }
  if (trailerSelect) {
    [...trailerSelect.options].forEach(option => {
      if (!option.value) return;
      const vehicle = byId(state.vehicles, option.value);
      option.disabled = vehicle ? (!vehicleCompatibleWithLoad(vehicle, loadType, 'trailer') || !vehicleAvailableForLoad(vehicle)) : false;
    });
    if (!rule.trailer.length || (selectedTrailer && (!vehicleCompatibleWithLoad(selectedTrailer, loadType, 'trailer') || !vehicleAvailableForLoad(selectedTrailer)))) trailerSelect.value = '';
  }
  const hint = document.getElementById('equipmentCompatibilityHint');
  if (hint) {
    const powerLabels = rule.power.map(typeLabel).join(', ');
    const trailerLabels = rule.trailer.length ? rule.trailer.map(typeLabel).join(', ') : 'No trailer should be assigned';
    hint.textContent = `Compatible power: ${powerLabels}. Trailer/equipment: ${trailerLabels}.`;
  }
}

function bindLoadEntryHelpers() {
  const form = document.getElementById('loadForm');
  if (!form) return;
  document.querySelectorAll('[data-location-select]').forEach(select => {
    select.onchange = () => {
      const item = findAddressByValue(select.value);
      applyLocationToLoadForm(form, item, select.dataset.locationSelect);
    };
  });
  const driverSelect = form.elements.driverId;
  if (driverSelect) {
    driverSelect.onchange = () => {
      const assignment = activeAssignmentForDriver(driverSelect.value);
      if (assignment && form.elements.vehicleId && !form.elements.vehicleId.value) form.elements.vehicleId.value = assignment.vehicleId || '';
      refreshLoadTypeControls(form);
    };
  }
  form.elements.loadType?.addEventListener('change', () => refreshLoadTypeControls(form));
  form.elements.vehicleId?.addEventListener('change', () => refreshLoadTypeControls(form));
  form.elements.trailerId?.addEventListener('change', () => refreshLoadTypeControls(form));
  refreshLoadTypeControls(form);
}

async function lookupExternalAddresses(input, type) {
  const query = String(input.value || '').trim();
  if (query.length < 3) return;
  const localMatches = addressSuggestions(type).filter(item => String(item.address || '').toLowerCase().includes(query.toLowerCase()));
  if (localMatches.length >= 6) return;
  try {
    const result = await api(`/api/address-suggestions?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`);
    for (const suggestion of result.suggestions || []) {
      state.addressLookups[String(suggestion.address || '').toLowerCase()] = { ...suggestion, type };
    }
    const datalist = document.getElementById(input.getAttribute('list'));
    if (datalist) datalist.innerHTML = combinedAddressSuggestions(type).map(item => renderAddressOption(item)).join('');
  } catch (error) {
    console.warn('Address lookup failed', error.message);
  }
}

async function loadEverything() {
  if (!state.user) return;

  state.companies = await api('/api/companies');
  if (!state.selectedCompanyId) {
    state.selectedCompanyId = state.user.companyId || state.companies[0]?.id || null;
  }
  if (!state.selectedCompanyId && state.user.role !== 'driver') {
    state.users = [];
    state.dashboard = null;
    state.drivers = [];
    state.vehicles = [];
    state.assignments = [];
    state.shifts = [];
    state.inspections = [];
    state.issues = [];
    state.loads = [];
    state.addresses = [];
    state.bugReports = [];
    state.notifications = [];
    return;
  }

  const requests = [
    isAdminLike() ? api('/api/users') : Promise.resolve([]),
    isStaffLike() ? api('/api/dashboard') : Promise.resolve(null),
    api('/api/drivers'),
    api('/api/vehicles'),
    api('/api/assignments'),
    api('/api/shifts'),
    api('/api/inspections'),
    api('/api/issues'),
    api('/api/loads'),
    isStaffLike() ? api('/api/addresses') : Promise.resolve([]),
    isStaffLike() ? api('/api/bug-reports') : Promise.resolve([]),
    api('/api/notifications')
  ];

  const [users, dashboard, drivers, vehicles, assignments, shifts, inspections, issues, loads, addresses, bugReports, notifications] = await Promise.all(requests);
  state.users = users;
  state.dashboard = dashboard;
  state.drivers = drivers;
  state.vehicles = vehicles;
  state.assignments = assignments;
  state.shifts = shifts;
  state.inspections = inspections;
  state.issues = issues;
  state.loads = loads;
  state.addresses = addresses;
  state.bugReports = bugReports;
  state.notifications = notifications;
  if (!state.selectedDriverId && state.drivers[0]) state.selectedDriverId = state.drivers[0].id;
}

function bindPhotoPreviews() {
  document.querySelectorAll('.photo-input').forEach(input => {
    input.onchange = () => {
      const target = document.getElementById(input.dataset.preview);
      if (!target) return;
      target.innerHTML = '';
      [...(input.files || [])].forEach(file => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.onload = () => URL.revokeObjectURL(img.src);
        target.appendChild(img);
      });
    };
  });
}

window.addEventListener('beforeunload', () => { if (state.user?.role === 'driver') flushBufferedLocations(true); });

(async function init() {
  try {
    const session = await api('/api/session');
    state.user = session.user;
    state.activeView = getDefaultView();
    await loadEverything();
  } catch {
    state.user = null;
  }
  render();
})();
