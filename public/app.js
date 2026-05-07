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
  selectedCompanyId: null,
  selectedDriverId: null,
  activeView: null,
  toastTimer: null,
  trackingWatch: null,
  trackingTimer: null,
  mapRefreshTimer: null,
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
const loadStatusFlow = [
  ['accepted', 'Accept'],
  ['en_route_pickup', 'En Route Pickup'],
  ['at_pickup', 'At Pickup'],
  ['picked_up', 'Confirm Pickup'],
  ['in_transit', 'In Transit'],
  ['at_delivery', 'At Delivery'],
  ['delivered', 'Confirm Delivery']
];
const staffOperationsNav = [
  ['dispatchHome', 'Dashboard'],
  ['loads', 'Dispatch / Loads'],
  ['map', 'Live Map'],
  ['drivers', 'Drivers'],
  ['vehicles', 'Equipment'],
  ['inspections', 'Inspections'],
  ['issues', 'Defects / Repairs'],
  ['maintenance', 'Maintenance'],
  ['documents', 'Documents'],
  ['reports', 'Reports'],
  ['settings', 'Settings'],
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
function statusTag(value) {
  const slug = String(value || '').toLowerCase().replace(/[^a-z0-9_ -]/g, '').replace(/\s+/g, '_');
  return `<span class="tag ${attr(slug)}">${esc(String(value || '').replaceAll('_', ' '))}</span>`;
}
function byId(list, id) { return list.find(item => Number(item.id) === Number(id)); }
function driverName(id) { const d = byId(state.drivers, id); return d ? esc(`${d.firstName || ''} ${d.lastName || ''}`.trim()) : '&mdash;'; }
function vehicleName(id) { const v = byId(state.vehicles, id); return v ? esc(v.unitNumber) : '&mdash;'; }
function fmt(ts) { return ts ? esc(new Date(ts).toLocaleString()) : '&mdash;'; }
function failedItems(inspection) {
  return (inspection.itemResults || []).filter(item => item.result === 'fail');
}
function typeLabel(type) {
  return equipmentTypes.find(([value]) => value === type)?.[1] || String(type || '').replaceAll('_', ' ');
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
  return state.loads.filter(load => !['delivered', 'cancelled'].includes(load.status));
}
function nextLoadStatus(load) {
  const currentIndex = loadStatusFlow.findIndex(([status]) => status === load.status);
  if (currentIndex < 0) return 'accepted';
  return loadStatusFlow[currentIndex + 1]?.[0] || '';
}
function driverActiveLoad(driverId) {
  return activeLoads().find(load => Number(load.driverId) === Number(driverId)) || null;
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
function powerUnits() {
  return state.vehicles.filter(v => (v.category || 'power_unit') === 'power_unit');
}
function trailers() {
  return state.vehicles.filter(v => (v.category || 'power_unit') !== 'power_unit');
}
function addressSuggestions(type = 'both') {
  return state.addresses.filter(item => ['both', type].includes(item.type || 'both'));
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
  return `<option value="${attr(item.address)}" label="${attr([item.name, item.source === 'geoapify' ? 'Geoapify' : item.type].filter(Boolean).join(' - '))}"></option>`;
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
      <div class="brand-mark">DF</div>
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
        ${getNavItems().map(([view, label]) => `<button class="nav-btn ${activeView === view ? 'active' : ''}" data-view="${view}">${esc(label)}</button>`).join('')}
      </nav>
    </div>`;
}

function getNavItems() {
  if (state.user?.role === 'driver') {
    return [['driver', 'Check-In'], ['driverWork', 'Assigned Work'], ['bugReports', 'Report Bug']];
  }
  if (state.user?.role === 'support_staff') {
    return staffOperationsNav.filter(([view]) => !['settings'].includes(view));
  }
  if (state.user?.role === 'admin') {
    return [
      ['adminHome', 'Dashboard'],
      ['loads', 'Dispatch / Loads'],
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
      ['bugReports', 'Bug Reports']
    ];
  }
  return [
    ['platformHome', 'Dashboard'],
    ['companies', 'Companies'],
    ['users', 'Company Users'],
    ['reports', 'Reports'],
    ['settings', 'Settings'],
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
          <div class="brand-mark small">DF</div>
          <div>
            <h2>${workspaceName()}</h2>
            <p>${esc(state.user.firstName || state.user.email)}</p>
          </div>
        </div>
        <div class="status-panel stack compact">
          <div>${statusTag(roleLabel(state.user.role))}</div>
          ${state.selectedCompanyId ? `<div class="company-chip">${esc(company?.name || 'Selected company')}</div>` : ''}
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
        ${navItems.map(([view, label]) => `<button class="nav-btn ${activeView === view ? 'active' : ''}" data-view="${view}">${label}</button>`).join('')}
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
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Companies</h3><p>The super user controls company setup and ownership</p></div>
        ${listSearch('companyList', 'Search company or code')}
        <div class="table-wrap"><table><thead><tr><th>Company</th><th>Code</th><th>Status</th></tr></thead><tbody data-filter-list="companyList">
          ${state.companies.map(c => `<tr data-search="${searchableText(c.name, c.code, c.status)}"><td>${esc(c.name)}</td><td>${esc(c.code || '') || '&mdash;'}</td><td>${statusTag(c.status)}</td></tr>`).join('') || '<tr><td colspan="3">No companies yet</td></tr>'}
          <tr data-filter-empty hidden><td colspan="3">No matching companies.</td></tr>
        </tbody></table></div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Create Company</h3><p>Set up a company and its first admin user</p></div>
        <form id="companyForm" class="stack compact">
          <label>Company name<input name="name" required /></label>
          <label>Company code<input name="code" placeholder="Optional short code" /></label>
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
  const markers = tracked.map(driver => {
    const rawLeft = ((Number(driver.lastLng) - bounds.minLng) / lngRange) * 100;
    const rawTop = (1 - ((Number(driver.lastLat) - bounds.minLat) / latRange)) * 100;
    const left = Math.max(8, Math.min(92, rawLeft));
    const top = Math.max(8, Math.min(92, rawTop));
    return `<button class="map-marker ${state.selectedDriverId === driver.id ? 'active' : ''} ${attr(trackingState(driver))}" title="${attr(`${driver.firstName || ''} ${driver.lastName || ''}`.trim())}" data-driver-marker="${attr(driver.id)}" style="left:${left}%;top:${top}%"><span>${esc(driver.firstName?.[0] || 'D')}${esc(driver.lastName?.[0] || '')}</span><small>${esc(driver.firstName || '')}</small></button>`;
  }).join('');
  const trail = selected?.locationHistory?.slice(-20).map((point, index, points) => {
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
        <div class="map-canvas">
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
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Drivers</h3><p>Drivers can log in, start shifts, inspect vehicles, and report issues</p></div>
        ${listSearch('driverList', 'Search driver, email, phone, or license')}
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>License</th><th>Status</th></tr></thead><tbody data-filter-list="driverList">
          ${state.drivers.map(d => `<tr data-search="${searchableText(d.firstName, d.lastName, d.email, d.phone, d.licenseClass, d.licenseNumber, d.status)}"><td>${esc(`${d.firstName || ''} ${d.lastName || ''}`.trim())}<div class="tiny">${esc(d.email || d.phone || '')}</div></td><td>${esc(d.licenseClass || '') || '&mdash;'} &middot; ${esc(d.licenseNumber || '') || '&mdash;'}</td><td>${statusTag(d.status)}</td></tr>`).join('') || '<tr><td colspan="3">No drivers yet</td></tr>'}
          <tr data-filter-empty hidden><td colspan="3">No matching drivers.</td></tr>
        </tbody></table></div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Add Driver</h3><p>Create a driver record and optional driver login</p></div>
        <form id="driverForm" class="stack compact">
          <label>First name<input name="firstName" required /></label>
          <label>Last name<input name="lastName" required /></label>
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
    </div>`;
}

function renderVehicles() {
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Vehicles</h3><p>Fleet master list for this company</p></div>
        ${listSearch('vehicleList', 'Search unit, plate, VIN, type, or status')}
        <div class="table-wrap"><table><thead><tr><th>Unit</th><th>Vehicle</th><th>Status</th></tr></thead><tbody data-filter-list="vehicleList">
          ${state.vehicles.map(v => `<tr data-search="${searchableText(v.unitNumber, v.plateNumber, v.vin, v.make, v.model, v.year, typeLabel(v.type), v.status)}"><td>${esc(v.unitNumber)}<div class="tiny">${esc(v.plateNumber || '')}</div></td><td>${esc(typeLabel(v.type))}<div class="tiny">${esc(`${v.make || ''} ${v.model || ''}`.trim())} &middot; ${esc(v.year || '')}</div></td><td>${statusTag(v.status)}</td></tr>`).join('') || '<tr><td colspan="3">No vehicles yet</td></tr>'}
          <tr data-filter-empty hidden><td colspan="3">No matching vehicles.</td></tr>
        </tbody></table></div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Add Vehicle</h3><p>Create a new fleet unit</p></div>
        <form id="vehicleForm" class="stack compact">
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

function renderLoads() {
  const powerOptions = powerUnits().map(v => `<option value="${attr(v.id)}">${esc(v.unitNumber)} - ${esc(typeLabel(v.type))}</option>`).join('');
  const trailerOptions = trailers().map(v => `<option value="${attr(v.id)}">${esc(v.unitNumber)} - ${esc(typeLabel(v.type))}</option>`).join('');
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
        <div class="panel-head"><h3>Create Load</h3><p>Assign pickup, delivery, driver, truck, and trailer.</p></div>
        <form id="loadForm" class="stack compact">
          <div class="split"><label>Load #<input name="loadNumber" required /></label><label>Reference<input name="referenceNumber" /></label></div>
          <div class="split"><label>Customer<input name="customer" /></label><label>Broker<input name="broker" /></label></div>
          <label>Pickup name<input name="pickupName" data-address-name="pickupAddress" /></label>
          <label>Pickup address<input name="pickupAddress" list="pickupAddresses" autocomplete="street-address" data-address-input="pickupName" data-address-type="pickup" /></label>
          <label>Pickup appointment<input name="pickupAppointment" type="datetime-local" /></label>
          <label>Delivery name<input name="deliveryName" data-address-name="deliveryAddress" /></label>
          <label>Delivery address<input name="deliveryAddress" list="deliveryAddresses" autocomplete="street-address" data-address-input="deliveryName" data-address-type="delivery" /></label>
          <label>Delivery appointment<input name="deliveryAppointment" type="datetime-local" /></label>
          <div class="split"><label>Commodity<input name="commodity" /></label><label>Weight<input name="weight" type="number" /></label></div>
          <div class="split"><label>Pieces / pallets<input name="pieces" /></label><label>Rate<input name="rate" /></label></div>
          <label>Driver<select name="driverId"><option value="">Unassigned</option>${state.drivers.map(d => `<option value="${attr(d.id)}">${esc(`${d.firstName || ''} ${d.lastName || ''}`.trim())}</option>`).join('')}</select></label>
          <label>Power unit<select name="vehicleId"><option value="">Unassigned</option>${powerOptions}</select></label>
          <label>Trailer / equipment<select name="trailerId"><option value="">None</option>${trailerOptions}</select></label>
          <label>Notes<textarea name="notes"></textarea></label>
          <button class="btn primary" type="submit">Create Load</button>
          ${renderAddressDatalist('pickupAddresses', 'pickup')}
          ${renderAddressDatalist('deliveryAddresses', 'delivery')}
        </form>
        <hr class="soft-rule" />
        <div class="panel-head"><h3>Preload Address</h3><p>Save frequent pickup and delivery locations for type-to-select.</p></div>
        <form id="addressForm" class="stack compact">
          <div class="split"><label>Location name<input name="name" placeholder="Customer, shipper, receiver" /></label><label>Type<select name="type"><option value="both">Pickup & delivery</option><option value="pickup">Pickup only</option><option value="delivery">Delivery only</option></select></label></div>
          <label>Address<input name="address" required autocomplete="street-address" /></label>
          <label>Notes<textarea name="notes"></textarea></label>
          <button class="btn ghost" type="submit">Save Address</button>
        </form>
        <div class="address-chip-row">${state.addresses.slice(0, 10).map(item => `<span class="address-chip">${esc(item.name || item.address)}<small>${esc(item.type || 'both')}</small></span>`).join('') || '<p class="tiny">No saved addresses yet.</p>'}</div>
      </section>
    </div>`;
}

function renderLoadCard(load, dispatcher = false) {
  const docs = load.documents || [];
  return `<article class="load-card" data-search="${searchableText(load.loadNumber, load.customer, load.broker, load.pickupName, load.pickupAddress, load.deliveryName, load.deliveryAddress, load.status, driverName(load.driverId), vehicleName(load.vehicleId), vehicleName(load.trailerId))}">
    <div class="card-row"><div><strong>${esc(load.loadNumber)}</strong><p class="tiny">${esc(load.customer || load.broker || 'No customer')}</p></div>${loadStatusTag(load)}</div>
    <div class="load-stop"><span>PU</span><div><strong>${esc(load.pickupName || 'Pickup')}</strong><p>${esc(load.pickupAddress || '')}</p><p class="tiny">${fmt(load.pickupAppointment)}</p></div></div>
    <div class="load-stop"><span>DEL</span><div><strong>${esc(load.deliveryName || 'Delivery')}</strong><p>${esc(load.deliveryAddress || '')}</p><p class="tiny">${fmt(load.deliveryAppointment)}</p></div></div>
    <div class="tiny">Driver: ${driverName(load.driverId)} &middot; Truck: ${vehicleName(load.vehicleId)} &middot; Trailer: ${vehicleName(load.trailerId)}</div>
    <div class="tiny">${esc(load.commodity || 'Commodity not set')}${load.weight ? ` &middot; ${Number(load.weight).toLocaleString()} lb` : ''}${load.pieces ? ` &middot; ${esc(load.pieces)}` : ''}</div>
    ${dispatcher ? `<div class="timeline">${(load.events || []).slice(-4).map(event => `<div><strong>${esc(event.status)}</strong><span>${fmt(event.at)}</span><p>${esc(event.note || '')}</p></div>`).join('')}</div>` : ''}
    ${docs.length ? `<div class="photo-row">${docs.map(doc => `<a class="doc-thumb" href="${attr(doc.url)}" target="_blank" rel="noopener"><img src="${attr(doc.url)}" alt="${attr(doc.type || 'document')}" /><span>${esc(doc.type || 'doc')}</span></a>`).join('')}</div>` : ''}
  </article>`;
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

function renderSettings() {
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Company Settings</h3><p>Operational setup for this company workspace.</p></div>
        <div class="list-grid">
          <article class="list-card"><strong>Company</strong><p class="tiny">${esc(getCurrentCompany()?.name || 'No company selected')}</p></article>
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
  const driverLoads = state.loads.filter(load => Number(load.driverId) === Number(driverId) && !['delivered', 'cancelled'].includes(load.status));
  const deliveredLoads = state.loads.filter(load => Number(load.driverId) === Number(driverId) && load.status === 'delivered').slice(0, 5);
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
  return `<article class="load-card driver-load-card">
    <div class="card-row"><strong>${esc(load.loadNumber)}</strong>${loadStatusTag(load)}</div>
    <div class="load-stop"><span>PU</span><div><strong>${esc(load.pickupName || 'Pickup')}</strong><p>${esc(load.pickupAddress || '')}</p><p class="tiny">${fmt(load.pickupAppointment)}</p></div></div>
    <div class="load-stop"><span>DEL</span><div><strong>${esc(load.deliveryName || 'Delivery')}</strong><p>${esc(load.deliveryAddress || '')}</p><p class="tiny">${fmt(load.deliveryAppointment)}</p></div></div>
    <div class="load-actions">
      ${loadStatusFlow.map(([status, label]) => `<button class="btn ${status === nextStatus ? 'primary' : 'ghost'} small-btn load-status-btn" data-load-id="${attr(load.id)}" data-status="${attr(status)}">${esc(label)}</button>`).join('')}
      <button class="btn ghost small-btn load-status-btn" data-load-id="${attr(load.id)}" data-status="exception">Exception</button>
    </div>
    <form class="load-doc-form stack compact" data-load-doc="${attr(load.id)}" enctype="multipart/form-data">
      <div class="split"><label>Document type<select name="type"><option value="bol">BOL</option><option value="pod">POD</option><option value="receipt">Receipt</option><option value="other">Other</option></select></label><label>Photo<input class="photo-input" data-preview="loadPreview${attr(load.id)}" type="file" name="photos" multiple accept="image/*" capture="environment" /></label></div>
      <label>Note<input name="note" placeholder="Optional document note" /></label>
      <div class="photo-row" id="loadPreview${attr(load.id)}"></div>
      <button class="btn primary small-btn" type="submit">Upload BOL / POD</button>
    </form>
  </article>`;
}

function bindView(view) {
  bindListFilters();
  if (view === 'companies') {
    const form = document.getElementById('companyForm');
    if (form) form.onsubmit = submitJsonForm('/api/companies');
  }
  if (view === 'users') {
    const form = document.getElementById('userForm');
    if (form) form.onsubmit = submitJsonForm('/api/users');
  }
  if (view === 'drivers') {
    const form = document.getElementById('driverForm');
    if (form) form.onsubmit = submitJsonForm('/api/drivers');
  }
  if (view === 'vehicles') {
    const form = document.getElementById('vehicleForm');
    if (form) form.onsubmit = submitJsonForm('/api/vehicles');
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
  }
  if (view === 'map') {
    startMapRefresh();
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

function bindDriverWorkPage() {
  bindPhotoPreviews();
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
      if (!match?.name) return;
      const nameInput = input.form?.elements[input.dataset.addressInput];
      if (nameInput && !nameInput.value) nameInput.value = match.name;
    };
  });
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
    isStaffLike() ? api('/api/bug-reports') : Promise.resolve([])
  ];

  const [users, dashboard, drivers, vehicles, assignments, shifts, inspections, issues, loads, addresses, bugReports] = await Promise.all(requests);
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
