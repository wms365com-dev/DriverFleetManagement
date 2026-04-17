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
  submitLocks: {}
};

const inspectionItems = [
  'Lights', 'Brakes', 'Horn', 'Mirrors', 'Tires', 'Windshield', 'Wipers', 'Fluid Leaks', 'Coupling Equipment', 'Load Securement', 'Documents', 'Safety Equipment'
];

function setToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.className = `toast show ${type}`;
  toast.textContent = message;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.className = 'toast', 2600);
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
  return String(role || '').replaceAll('_', ' ');
}
function statusTag(value) {
  return `<span class="tag ${String(value).toLowerCase().replace(/\s+/g, '_')}">${String(value).replaceAll('_', ' ')}</span>`;
}
function byId(list, id) { return list.find(item => Number(item.id) === Number(id)); }
function driverName(id) { const d = byId(state.drivers, id); return d ? `${d.firstName} ${d.lastName}` : '—'; }
function vehicleName(id) { const v = byId(state.vehicles, id); return v ? v.unitNumber : '—'; }
function fmt(ts) { return ts ? new Date(ts).toLocaleString() : '—'; }
function getCurrentCompany() { return byId(state.companies, state.selectedCompanyId) || null; }
function isSuper() { return state.user?.role === 'super_user'; }
function isAdminLike() { return ['super_user', 'admin'].includes(state.user?.role); }
function isStaffLike() { return ['super_user', 'admin', 'support_staff'].includes(state.user?.role); }

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
  if (meta) meta.textContent = status === 'tracking' ? `Last update ${new Date(state.gpsLastUpdate || Date.now()).toLocaleTimeString()}${state.gpsAccuracy ? ` · ±${Math.round(state.gpsAccuracy)}m` : ''}` : '';
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
    ${state.user ? renderShell() : renderLogin()}
  `;
  if (state.user) bindShell(); else bindLogin();
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

function getNavItems() {
  const items = [];
  if (isSuper()) items.push(['companies', 'Companies']);
  if (isAdminLike()) items.push(['users', 'Users']);
  if (isStaffLike()) {
    items.push(['dashboard', 'Dashboard']);
    items.push(['map', 'Live Map']);
    items.push(['drivers', 'Drivers']);
    items.push(['vehicles', 'Vehicles']);
    items.push(['assignments', 'Assignments']);
    items.push(['shifts', 'Shifts']);
    items.push(['inspections', 'Inspections']);
    items.push(['issues', 'Issues']);
  }
  items.push(['driver', state.user?.role === 'driver' ? 'My Mobile Workspace' : 'Driver Mobile']);
  return items;
}

function getDefaultView() {
  if (state.user?.role === 'driver') return 'driver';
  if (isSuper()) return 'companies';
  if (isAdminLike()) return 'users';
  return 'dashboard';
}

function renderShell() {
  const navItems = getNavItems();
  const company = getCurrentCompany();
  const activeView = state.activeView || getDefaultView();
  return `
  <div class="shell">
    <aside class="sidebar glass">
      <div>
        <div class="brand-row">
          <div class="brand-mark small">DF</div>
          <div>
            <h2>Fleet Portal</h2>
            <p>${state.user.firstName || state.user.email}</p>
          </div>
        </div>
        <div class="status-panel stack compact">
          <div>${statusTag(roleLabel(state.user.role))}</div>
          ${state.selectedCompanyId ? `<div class="company-chip">${company?.name || 'Selected company'}</div>` : ''}
        </div>
        ${isSuper() ? `
          <div class="scope-picker">
            <label>Working company
              <select id="companyScopeSelect">
                ${state.companies.map(c => `<option value="${c.id}" ${Number(c.id) === Number(state.selectedCompanyId) ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </label>
          </div>` : ''}
      </div>
      <nav>
        ${navItems.map(([view, label]) => `<button class="nav-btn ${activeView === view ? 'active' : ''}" data-view="${view}">${label}</button>`).join('')}
      </nav>
      <div class="stack compact">
        <div class="tiny">Version 6 · Multi-company roles</div>
        <button id="logoutBtn" class="btn ghost">Log Out</button>
      </div>
    </aside>
    <main class="main">
      <header class="topbar glass">
        <div>
          <p class="eyebrow">Operations workspace</p>
          <h1>${getViewTitle(activeView)}</h1>
          <p class="subtle">${company?.name || (state.user.role === 'super_user' ? 'Platform administration' : 'Company workspace')}</p>
        </div>
        <div class="topbar-actions">
          ${state.companies.length > 1 ? `<label class="topbar-switch">Company<select id="topbarCompanyScopeSelect">${state.companies.map(c => `<option value="${c.id}" ${Number(c.id) === Number(state.selectedCompanyId) ? 'selected' : ''}>${c.name}</option>`).join('')}</select></label>` : ''}
          <div class="right-chip">${new Date().toLocaleDateString()}</div>
        </div>
      </header>
      <section id="viewContainer"></section>
    </main>
  </div>`;
}

function getViewTitle(view) {
  const titles = {
    companies: 'Company Setup',
    users: 'Users & Access',
    dashboard: 'Operations Dashboard',
    map: 'Live Driver Map',
    drivers: 'Driver Records',
    vehicles: 'Fleet Vehicles',
    assignments: 'Driver Assignments',
    shifts: 'Shift Timeline',
    inspections: 'Inspection Feed',
    issues: 'Issue Queue',
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
  return renderDriverWorkspace();
}

function bindShell() {
  document.getElementById('viewContainer').innerHTML = renderView(state.activeView || getDefaultView());
  bindView(state.activeView || getDefaultView());

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
      state.activeView = btn.dataset.view;
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

function renderCompanies() {
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Companies</h3><p>The super user controls company setup and ownership</p></div>
        <div class="table-wrap"><table><thead><tr><th>Company</th><th>Code</th><th>Status</th></tr></thead><tbody>
          ${state.companies.map(c => `<tr><td>${c.name}</td><td>${c.code || '—'}</td><td>${statusTag(c.status)}</td></tr>`).join('') || '<tr><td colspan="3">No companies yet</td></tr>'}
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
        <div class="panel-head"><h3>Company Users</h3><p>Admin and support staff accounts for this company</p></div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>
          ${state.users.map(u => `<tr><td>${u.firstName || ''} ${u.lastName || ''}</td><td>${u.email}</td><td>${statusTag(u.role)}</td></tr>`).join('') || '<tr><td colspan="3">No users yet</td></tr>'}
        </tbody></table></div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Add User</h3><p>Create an admin or support staff login</p></div>
        <form id="userForm" class="stack compact">
          <div class="split"><label>First name<input name="firstName" required /></label><label>Last name<input name="lastName" required /></label></div>
          <label>Email<input name="email" type="email" required /></label>
          <label>Password<input name="password" type="password" autocomplete="new-password" required /></label>
          <label>Role<select name="role">
            <option value="support_staff">Support Staff</option>
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
        return `<article class="list-card"><div><strong>${driver.firstName} ${driver.lastName}</strong><p>${vehicle ? vehicle.unitNumber : 'Unassigned'}</p></div><div>${activeShift ? statusTag('started') : statusTag(driver.status)}</div></article>`;
      }).join('') || '<p class="tiny">No drivers yet.</p>'}</div>
    </div>
    <div class="panel glass span-2">
      <div class="panel-head"><h3>Vehicle Condition</h3><p>Live status by unit</p></div>
      <div class="list-grid">${state.vehicles.map(vehicle => `<article class="list-card"><div><strong>${vehicle.unitNumber}</strong><p>${vehicle.make} ${vehicle.model} · ${(vehicle.odometer || 0).toLocaleString()} km</p></div><div>${statusTag(vehicle.status)}</div></article>`).join('') || '<p class="tiny">No vehicles yet.</p>'}</div>
    </div>
  </div>`;
}


function renderMapView() {
  const tracked = state.drivers.filter(d => Number.isFinite(Number(d.lastLat)) && Number.isFinite(Number(d.lastLng)));
  const bounds = tracked.length ? {
    minLat: Math.min(...tracked.map(d => Number(d.lastLat))),
    maxLat: Math.max(...tracked.map(d => Number(d.lastLat))),
    minLng: Math.min(...tracked.map(d => Number(d.lastLng))),
    maxLng: Math.max(...tracked.map(d => Number(d.lastLng)))
  } : { minLat: 43.60, maxLat: 43.80, minLng: -79.60, maxLng: -79.20 };
  const latRange = Math.max(0.02, bounds.maxLat - bounds.minLat);
  const lngRange = Math.max(0.02, bounds.maxLng - bounds.minLng);
  const markers = tracked.map(driver => {
    const left = ((Number(driver.lastLng) - bounds.minLng) / lngRange) * 100;
    const top = (1 - ((Number(driver.lastLat) - bounds.minLat) / latRange)) * 100;
    return `<button class="map-marker ${state.selectedDriverId === driver.id ? 'active' : ''}" data-driver-marker="${driver.id}" style="left:${left}%;top:${top}%"><span>${driver.firstName[0] || 'D'}${driver.lastName[0] || ''}</span></button>`;
  }).join('');
  const selected = tracked.find(d => Number(d.id) === Number(state.selectedDriverId)) || tracked[0] || null;
  return `
    <section class="map-layout">
      <div class="panel glass map-panel">
        <div class="panel-head"><h3>Live Driver Tracking</h3><p>Browser GPS updates when drivers allow location access on mobile</p></div>
        <div class="map-canvas">
          <div class="map-grid"></div>
          ${markers || '<div class="map-empty">No live driver locations yet. Drivers will appear here after signing in and allowing location tracking.</div>'}
        </div>
      </div>
      <div class="stack">
        <div class="panel glass">
          <div class="panel-head"><h3>Tracked Drivers</h3><p>${tracked.length} active coordinates</p></div>
          <div class="list-grid compact-list">
            ${state.drivers.map(driver => `
              <button class="list-card map-driver-card ${selected?.id === driver.id ? 'selected' : ''}" data-driver-focus="${driver.id}">
                <div class="card-row"><strong>${driver.firstName} ${driver.lastName}</strong>${statusTag(driver.status)}</div>
                <div class="tiny">${driver.email || driver.phone || 'No contact set'}</div>
                <div class="tiny">${driver.lastSeenAt ? `Last seen ${fmt(driver.lastSeenAt)}` : 'Awaiting first location update'}</div>
              </button>`).join('')}
          </div>
        </div>
        <div class="panel glass">
          <div class="panel-head"><h3>Selected Driver</h3><p>Location and assigned vehicle</p></div>
          ${selected ? `
            <div class="driver-location-card">
              <div class="card-row"><strong>${selected.firstName} ${selected.lastName}</strong>${statusTag(selected.trackingEnabled ? 'tracked' : 'ready')}</div>
              <div class="tiny">Coordinates</div>
              <div class="coords">${Number(selected.lastLat).toFixed(5)}, ${Number(selected.lastLng).toFixed(5)}</div>
              <div class="tiny">${selected.lastSeenAt ? `Last update ${fmt(selected.lastSeenAt)}` : 'No update yet'}</div>
              <div class="tiny">Assigned vehicle: ${vehicleName((state.assignments.find(a => Number(a.driverId) === Number(selected.id) && a.active) || {}).vehicleId)}</div>
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
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>License</th><th>Status</th></tr></thead><tbody>
          ${state.drivers.map(d => `<tr><td>${d.firstName} ${d.lastName}<div class="tiny">${d.email || ''}</div></td><td>${d.licenseClass || '—'} · ${d.licenseNumber || '—'}</td><td>${statusTag(d.status)}</td></tr>`).join('') || '<tr><td colspan="3">No drivers yet</td></tr>'}
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
        <div class="table-wrap"><table><thead><tr><th>Unit</th><th>Vehicle</th><th>Status</th></tr></thead><tbody>
          ${state.vehicles.map(v => `<tr><td>${v.unitNumber}<div class="tiny">${v.plateNumber || ''}</div></td><td>${v.make || ''} ${v.model || ''} · ${v.year || ''}</td><td>${statusTag(v.status)}</td></tr>`).join('') || '<tr><td colspan="3">No vehicles yet</td></tr>'}
        </tbody></table></div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Add Vehicle</h3><p>Create a new fleet unit</p></div>
        <form id="vehicleForm" class="stack compact">
          <label>Unit number<input name="unitNumber" required /></label>
          <div class="split"><label>Plate<input name="plateNumber" /></label><label>VIN<input name="vin" /></label></div>
          <div class="split"><label>Make<input name="make" /></label><label>Model<input name="model" /></label></div>
          <div class="split"><label>Year<input name="year" type="number" /></label><label>Type<select name="type"><option value="tractor">Tractor</option><option value="straight_truck">Straight Truck</option><option value="trailer">Trailer</option><option value="van">Van</option></select></label></div>
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
          <label>Driver<select name="driverId">${state.drivers.map(d => `<option value="${d.id}">${d.firstName} ${d.lastName}</option>`).join('')}</select></label>
          <label>Vehicle<select name="vehicleId">${state.vehicles.map(v => `<option value="${v.id}">${v.unitNumber}</option>`).join('')}</select></label>
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

function renderInspections() {
  return `
    <section class="panel glass">
      <div class="panel-head"><h3>Inspection Feed</h3><p>Submitted pre-trip inspections</p></div>
      <div class="inspection-grid">${state.inspections.map(i => `<article class="inspection-card"><div class="panel-head"><strong>#${i.id} · ${vehicleName(i.vehicleId)}</strong>${statusTag(i.overallStatus)}</div><p class="tiny">${driverName(i.driverId)} · ${fmt(i.inspectionTime)}</p><p>${i.notes || 'No notes.'}</p><div class="tiny">Checklist items: ${(i.itemResults || []).length}</div><div class="photo-row">${(i.photos || []).map(p => `<img src="${p.url}" alt="inspection photo" />`).join('')}</div></article>`).join('') || '<p>No inspections yet.</p>'}</div>
    </section>`;
}

function renderIssues() {
  return `
    <section class="panel glass">
      <div class="panel-head"><h3>Issue Queue</h3><p>Open and closed defects</p></div>
      <div class="issue-list">${state.issues.map(i => `<article class="issue-card"><div class="panel-head"><div><strong>${vehicleName(i.vehicleId)}</strong><p class="tiny">${driverName(i.driverId)} · ${fmt(i.createdAt)}</p></div><div class="stack-right">${statusTag(i.severity)}${statusTag(i.status)}</div></div><p>${i.description}</p>${i.photos?.length ? `<div class="photo-row">${i.photos.map(p => `<img src="${p.url}" alt="issue photo" />`).join('')}</div>` : ''}${i.status !== 'closed' && isStaffLike() ? `<button class="btn primary small-btn close-issue" data-id="${i.id}">Mark Closed</button>` : `<p class="tiny">${i.closedAt ? `Closed ${fmt(i.closedAt)}` : ''}</p>`}</article>`).join('') || '<p>No issues reported.</p>'}</div>
    </section>`;
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
        <label>Preview Driver Mobile<select id="driverPicker">${state.drivers.map(d => `<option value="${d.id}" ${d.id === driverId ? 'selected' : ''}>${d.firstName} ${d.lastName}</option>`).join('')}</select></label>
      </div>` : ''}
      <div class="phone-frame">
        <div class="phone-notch"></div>
        <div class="phone-screen">
          <div class="mobile-header">
            <div>
              <p class="eyebrow">Driver workspace</p>
              <h2>${driver.firstName || ''} ${driver.lastName || ''}</h2>
            </div>
            ${activeShift ? statusTag('started') : statusTag('ready')}
          </div>
          <div class="mobile-card primary-card">
            <div><p class="tiny">Assigned vehicle</p><strong>${vehicle ? vehicle.unitNumber : 'Not assigned'}</strong></div>
            <div><p class="tiny">Vehicle status</p>${vehicle ? statusTag(vehicle.status) : '—'}</div>
          </div>
          <div class="mobile-actions">
            <div class="quick-action-grid">
              <div class="mobile-mini-card gps-status-card" id="gpsStatusCard" data-status="${driver.lastSeenAt ? 'tracking' : 'idle'}"><span>GPS Status</span><strong id="gpsStatusTitle">${driver.lastSeenAt ? 'Tracking active' : 'Not tracking'}</strong><small id="gpsStatusMessage">${driver.lastSeenAt ? 'Driver location is updating.' : 'Tap Allow GPS to start location tracking.'}</small><small id="gpsStatusMeta">${driver.lastSeenAt ? fmt(driver.lastSeenAt) : ''}</small><button class="btn primary small-btn" type="button" id="allowGpsBtn">Allow GPS</button></div>
              <div class="mobile-mini-card"><span>Open issues</span><strong>${state.issues.filter(i => Number(i.driverId) === Number(driver.id) && i.status !== 'closed').length}</strong><small>Need attention</small></div>
            </div>
            ${vehicle && !activeShift ? `<form id="startShiftForm" class="stack compact"><input type="hidden" name="vehicleId" value="${vehicle.id}" /><label>Start odometer<input type="number" name="startOdometer" required /></label><button class="btn primary" type="submit" id="startShiftBtn">Start Shift</button></form>` : ''}
            ${activeShift ? `<form id="endShiftForm" class="stack compact"><input type="hidden" name="shiftId" value="${activeShift.id}" /><label>End odometer<input type="number" name="endOdometer" required /></label><button class="btn ghost" type="submit" id="endShiftBtn">End Shift</button></form>` : ''}
          </div>
          ${vehicle ? `
            <form id="inspectionForm" class="mobile-card stack compact" enctype="multipart/form-data">
              <h3>Pre-trip Inspection</h3>
              <input type="hidden" name="vehicleId" value="${vehicle.id}" />
              <input type="hidden" name="shiftId" value="${activeShift?.id || ''}" />
              <label>Current odometer<input type="number" name="odometer" required /></label>
              <label>Overall result<select name="overallStatus"><option value="pass">Pass</option><option value="pass_with_defects">Pass With Defects</option><option value="fail">Fail</option></select></label>
              <div class="checklist">${inspectionItems.map(item => `<div class="check-row"><span>${item}</span><div><label><input type="radio" name="${item}" value="pass" checked />P</label><label><input type="radio" name="${item}" value="fail" />F</label><label><input type="radio" name="${item}" value="na" />N/A</label></div><input name="note_${item}" placeholder="Notes" /></div>`).join('')}</div>
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
              <input type="hidden" name="vehicleId" value="${vehicle.id}" />
              <input type="hidden" name="shiftId" value="${activeShift?.id || ''}" />
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

function bindView(view) {
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
  if (view === 'driver') bindDriverWorkspace();
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

async function pushDriverLocation(lat, lng, accuracy = null) {
  try {
    await api('/api/location', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lng, accuracy }) });
    state.gpsLastUpdate = Date.now();
    state.gpsAccuracy = accuracy;
    if (state.user?.linkedDriverId) {
      await loadEverything();
      if (state.activeView === 'map' || state.activeView === 'driver') render();
    }
  } catch (error) {
    console.warn('Location update failed', error.message);
    setGpsState('error', 'Connection issue while sending location.');
  }
}

async function requestDriverTracking(forcePrompt = false) {
  if (state.user?.role !== 'driver') return;
  if (state.gpsStatus === 'tracking' && state.trackingWatch && !forcePrompt) return;
  stopDriverTracking();
  if (!navigator.geolocation) {
    setGpsState('error', 'This browser does not support GPS.');
    return;
  }

  const onSuccess = async position => {
    await pushDriverLocation(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
    setGpsState('tracking', 'Driver location is updating.', { lastUpdate: Date.now(), accuracy: position.coords.accuracy });
  };
  const onError = error => {
    if (error?.code === 1) setGpsState('blocked', 'Location access is blocked. Please enable it in browser settings.');
    else if (error?.code === 3) setGpsState('pending', 'Still waiting for a GPS signal...');
    else setGpsState('error', error?.message || 'GPS unavailable.');
  };

  setGpsState(forcePrompt ? 'requesting' : 'pending', forcePrompt ? 'Requesting GPS permission...' : 'Waiting for GPS permission');
  navigator.geolocation.getCurrentPosition(async position => {
    await onSuccess(position);
    state.trackingWatch = navigator.geolocation.watchPosition(onSuccess, onError, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
    state.trackingTimer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
    }, 15000);
  }, onError, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
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
    return;
  }

  const requests = [
    isAdminLike() ? api('/api/users') : Promise.resolve([]),
    api('/api/dashboard'),
    api('/api/drivers'),
    api('/api/vehicles'),
    api('/api/assignments'),
    api('/api/shifts'),
    api('/api/inspections'),
    api('/api/issues')
  ];

  const [users, dashboard, drivers, vehicles, assignments, shifts, inspections, issues] = await Promise.all(requests);
  state.users = users;
  state.dashboard = dashboard;
  state.drivers = drivers;
  state.vehicles = vehicles;
  state.assignments = assignments;
  state.shifts = shifts;
  state.inspections = inspections;
  state.issues = issues;
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
