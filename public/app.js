const state = {
  user: null,
  dashboard: null,
  drivers: [],
  vehicles: [],
  assignments: [],
  shifts: [],
  inspections: [],
  issues: [],
  selectedDriverId: null,
  toastTimer: null
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
  state.toastTimer = setTimeout(() => toast.className = 'toast', 2500);
}

async function api(url, options = {}) {
  const opts = { ...options, credentials: 'include', headers: { ...(options.headers || {}) } };
  const res = await fetch(url, opts);
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) throw new Error(body?.error || 'Request failed');
  return body;
}

function saveSession(user) {
  state.user = user;
}

function clearSession() {
  state.user = null;
}

function statusTag(value) {
  return `<span class="tag ${String(value).toLowerCase().replace(/\s+/g, '_')}">${String(value).replaceAll('_', ' ')}</span>`;
}
function byId(list, id) { return list.find(item => Number(item.id) === Number(id)); }
function driverName(id) { const d = byId(state.drivers, id); return d ? `${d.firstName} ${d.lastName}` : '—'; }
function vehicleName(id) { const v = byId(state.vehicles, id); return v ? v.unitNumber : '—'; }
function fmt(ts) { return ts ? new Date(ts).toLocaleString() : '—'; }

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
        <p class="eyebrow">Railway + PostgreSQL Ready</p>
        <h1>Driver Fleet Management</h1>
        <p class="subtle">Motive / Samsara-inspired dispatch board with mobile driver inspections.</p>
      </div>
      <form id="loginForm" class="stack">
        <label>Email<input type="email" name="email" autocomplete="username" required /></label>
        <label>Password<input type="password" name="password" autocomplete="current-password" required /></label>
        <button class="btn primary" type="submit">Sign In</button>
      </form>
      <div class="demo-grid">
        <div>
          <strong>Admin setup</strong>
          <p>Use Railway variables <code>ADMIN_EMAIL</code> and <code>ADMIN_PASSWORD</code>.</p>
        </div>
        <div>
          <strong>Driver logins</strong>
          <p>Create driver accounts from the admin panel.</p>
        </div>
      </div>
    </div>
  </div>`;
}

function renderShell() {
  return `
  <div class="shell">
    <aside class="sidebar glass">
      <div>
        <div class="brand-row"><div class="brand-mark small">DF</div><div><h2>Fleet Ops</h2><p>${state.user.firstName || state.user.email}</p></div></div>
        <div class="status-panel">${statusTag(state.user.role)}</div>
      </div>
      <nav>
        ${state.user.role === 'admin' ? `
          <button class="nav-btn active" data-view="dashboard">Dashboard</button>
          <button class="nav-btn" data-view="drivers">Drivers</button>
          <button class="nav-btn" data-view="vehicles">Vehicles</button>
          <button class="nav-btn" data-view="assignments">Assignments</button>
          <button class="nav-btn" data-view="shifts">Shifts</button>
          <button class="nav-btn" data-view="inspections">Inspections</button>
          <button class="nav-btn" data-view="issues">Issues</button>
        ` : ''}
        <button class="nav-btn ${state.user.role === 'driver' ? 'active' : ''}" data-view="driver">Driver Mobile</button>
      </nav>
      <button id="logoutBtn" class="btn ghost">Log Out</button>
    </aside>
    <main class="main">
      <header class="topbar glass">
        <div>
          <p class="eyebrow">Live operations</p>
          <h1>${state.user.role === 'admin' ? 'Dispatch Command Center' : 'Driver Shift Workspace'}</h1>
        </div>
        <div class="right-chip">${new Date().toLocaleDateString()}</div>
      </header>
      <section id="viewContainer"></section>
    </main>
  </div>`;
}

function bindLogin() {
  document.getElementById('loginForm').onsubmit = async e => {
    e.preventDefault();
    try {
      const form = new FormData(e.target);
      const body = Object.fromEntries(form);
      const data = await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      saveSession(data.user);
      await loadEverything();
      render();
      setToast('Logged in successfully', 'success');
    } catch (error) {
      setToast(error.message, 'error');
    }
  };
}

function bindShell() {
  const navButtons = [...document.querySelectorAll('.nav-btn')];
  const defaultView = state.user.role === 'admin' ? 'dashboard' : 'driver';
  let activeView = navButtons.find(btn => btn.classList.contains('active'))?.dataset.view || defaultView;
  const switchView = (view) => {
    activeView = view;
    navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    document.getElementById('viewContainer').innerHTML = renderView(view);
    bindView(view);
  };
  navButtons.forEach(btn => btn.onclick = () => switchView(btn.dataset.view));
  document.getElementById('logoutBtn').onclick = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    clearSession();
    render();
  };
  switchView(activeView);
}

function renderView(view) {
  if (view === 'dashboard') return renderDashboard();
  if (view === 'drivers') return renderDrivers();
  if (view === 'vehicles') return renderVehicles();
  if (view === 'assignments') return renderAssignments();
  if (view === 'shifts') return renderShifts();
  if (view === 'inspections') return renderInspections();
  if (view === 'issues') return renderIssues();
  return renderDriverWorkspace();
}

function renderDashboard() {
  const d = state.dashboard || { activeShifts: 0, inspectionsToday: 0, openIssues: 0, outOfService: 0, drivers: 0, vehicles: 0 };
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
      }).join('')}</div>
    </div>
    <div class="panel glass span-2">
      <div class="panel-head"><h3>Vehicle Condition</h3><p>Live status by unit</p></div>
      <div class="list-grid">${state.vehicles.map(vehicle => `<article class="list-card"><div><strong>${vehicle.unitNumber}</strong><p>${vehicle.make} ${vehicle.model} · ${vehicle.odometer.toLocaleString()} km</p></div><div>${statusTag(vehicle.status)}</div></article>`).join('')}</div>
    </div>
  </div>`;
}

function renderDrivers() {
  return `
    <div class="two-col">
      <section class="panel glass">
        <div class="panel-head"><h3>Drivers</h3><p>Create and manage drivers</p></div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>License</th><th>Status</th></tr></thead><tbody>
          ${state.drivers.map(d => `<tr><td>${d.firstName} ${d.lastName}<div class="tiny">${d.email || ''}</div></td><td>${d.licenseClass} · ${d.licenseNumber}</td><td>${statusTag(d.status)}</td></tr>`).join('')}
        </tbody></table></div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Add Driver</h3><p>Dispatcher setup</p></div>
        <form id="driverForm" class="stack compact">
          <label>First name<input name="firstName" required /></label>
          <label>Last name<input name="lastName" required /></label>
          <label>Email<input name="email" type="email" /></label>
          <label>Phone<input name="phone" /></label>
          <label>License number<input name="licenseNumber" /></label>
          <div class="split"><label>Class<input name="licenseClass" value="AZ" /></label><label>Expiry<input name="licenseExpiry" type="date" /></label></div>
          <select name="status"><option value="active">Active</option><option value="inactive">Inactive</option></select>
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
        <div class="panel-head"><h3>Vehicles</h3><p>Fleet master list</p></div>
        <div class="table-wrap"><table><thead><tr><th>Unit</th><th>Vehicle</th><th>Status</th></tr></thead><tbody>
          ${state.vehicles.map(v => `<tr><td>${v.unitNumber}<div class="tiny">${v.plateNumber || ''}</div></td><td>${v.make} ${v.model} · ${v.year || ''}</td><td>${statusTag(v.status)}</td></tr>`).join('')}
        </tbody></table></div>
      </section>
      <section class="panel glass">
        <div class="panel-head"><h3>Add Vehicle</h3><p>Create unit and assign later</p></div>
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
        <div class="panel-head"><h3>Assign Vehicle</h3><p>Dispatch planning</p></div>
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
      <div class="panel-head"><h3>Inspection Feed</h3><p>Pre-trip and defect submissions</p></div>
      <div class="inspection-grid">${state.inspections.map(i => `<article class="inspection-card"><div class="panel-head"><strong>#${i.id} · ${vehicleName(i.vehicleId)}</strong>${statusTag(i.overallStatus)}</div><p class="tiny">${driverName(i.driverId)} · ${fmt(i.inspectionTime)}</p><p>${i.notes || 'No notes.'}</p><div class="tiny">Checklist items: ${(i.itemResults || []).length}</div><div class="photo-row">${(i.photos || []).map(p => `<img src="${p.url}" alt="inspection photo" />`).join('')}</div></article>`).join('') || '<p>No inspections yet.</p>'}</div>
    </section>`;
}

function renderIssues() {
  return `
    <section class="panel glass">
      <div class="panel-head"><h3>Issue Queue</h3><p>Repair and safety follow-up</p></div>
      <div class="issue-list">${state.issues.map(i => `<article class="issue-card"><div class="panel-head"><div><strong>${vehicleName(i.vehicleId)}</strong><p class="tiny">${driverName(i.driverId)} · ${fmt(i.createdAt)}</p></div><div class="stack-right">${statusTag(i.severity)}${statusTag(i.status)}</div></div><p>${i.description}</p>${i.photos?.length ? `<div class="photo-row">${i.photos.map(p => `<img src="${p.url}" alt="issue photo" />`).join('')}</div>` : ''}${i.status !== 'closed' ? `<button class="btn primary small-btn close-issue" data-id="${i.id}">Mark Closed</button>` : `<p class="tiny">Closed ${fmt(i.closedAt)}</p>`}</article>`).join('') || '<p>No issues reported.</p>'}</div>
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
      ${state.user.role === 'admin' ? `
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
            ${vehicle && !activeShift ? `<form id="startShiftForm" class="stack compact"><input type="hidden" name="vehicleId" value="${vehicle.id}" /><label>Start odometer<input type="number" name="startOdometer" required /></label><button class="btn primary" type="submit">Start Shift</button></form>` : ''}
            ${activeShift ? `<form id="endShiftForm" class="stack compact"><input type="hidden" name="shiftId" value="${activeShift.id}" /><label>End odometer<input type="number" name="endOdometer" required /></label><button class="btn ghost" type="submit">End Shift</button></form>` : ''}
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
              <button class="btn primary" type="submit">Submit Inspection</button>
            </form>
            <form id="quickIssueForm" class="mobile-card stack compact" enctype="multipart/form-data">
              <h3>Quick Issue Report</h3>
              <input type="hidden" name="vehicleId" value="${vehicle.id}" />
              <input type="hidden" name="shiftId" value="${activeShift?.id || ''}" />
              <div class="split"><label>Category<select name="category"><option value="mechanical">Mechanical</option><option value="lights">Lights</option><option value="tires">Tires</option><option value="body_damage">Body Damage</option><option value="safety">Safety</option><option value="other">Other</option></select></label><label>Severity<select name="severity"><option value="low">Low</option><option value="medium">Medium</option><option value="critical">Critical</option></select></label></div>
              <label>Description<textarea name="description" required></textarea></label>
              <label>Photos<input class="photo-input" data-preview="issuePreview" type="file" name="photos" multiple accept="image/*" capture="environment" /></label>
              <div class="photo-row" id="issuePreview"></div>
              <button class="btn ghost" type="submit">Report Issue</button>
            </form>` : `<div class="mobile-card"><p>No vehicle assigned yet.</p></div>`}
        </div>
      </div>
    </section>`;
}

function bindView(view) {
  if (view === 'drivers') {
    document.getElementById('driverForm').onsubmit = submitJsonForm('/api/drivers');
  }
  if (view === 'vehicles') {
    document.getElementById('vehicleForm').onsubmit = submitJsonForm('/api/vehicles');
  }
  if (view === 'assignments') {
    document.getElementById('assignmentForm').onsubmit = submitJsonForm('/api/assignments');
  }
  if (view === 'issues') {
    document.querySelectorAll('.close-issue').forEach(btn => btn.onclick = async () => {
      try {
        await api(`/api/issues/${btn.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'closed', resolutionNotes: 'Closed from dispatch board' }) });
        await loadEverything();
        bindShell();
        setToast('Issue closed', 'success');
      } catch (error) { setToast(error.message, 'error'); }
    });
  }
  if (view === 'driver') {
    const picker = document.getElementById('driverPicker');
    if (picker) picker.onchange = () => { state.selectedDriverId = Number(picker.value); bindShell(); };
    const startShiftForm = document.getElementById('startShiftForm');
    if (startShiftForm) startShiftForm.onsubmit = async e => {
      e.preventDefault();
      try {
        const body = Object.fromEntries(new FormData(e.target));
        await api('/api/shifts/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        await loadEverything();
        bindShell();
        setToast('Shift started', 'success');
      } catch (error) { setToast(error.message, 'error'); }
    };
    const endShiftForm = document.getElementById('endShiftForm');
    if (endShiftForm) endShiftForm.onsubmit = async e => {
      e.preventDefault();
      try {
        const body = Object.fromEntries(new FormData(e.target));
        await api('/api/shifts/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        await loadEverything();
        bindShell();
        setToast('Shift ended', 'success');
      } catch (error) { setToast(error.message, 'error'); }
    };
    bindPhotoPreviews();
    const inspectionForm = document.getElementById('inspectionForm');
    if (inspectionForm) inspectionForm.onsubmit = async e => {
      e.preventDefault();
      try {
        const fd = new FormData(e.target);
        const items = inspectionItems.map(item => ({ item, result: fd.get(item), notes: fd.get(`note_${item}`) || '' }));
        fd.append('itemResults', JSON.stringify(items));
        await api('/api/inspections', { method: 'POST', body: fd });
        await loadEverything();
        bindShell();
        setToast('Inspection submitted', 'success');
      } catch (error) { setToast(error.message, 'error'); }
    };
    const quickIssueForm = document.getElementById('quickIssueForm');
    if (quickIssueForm) quickIssueForm.onsubmit = async e => {
      e.preventDefault();
      try {
        const fd = new FormData(e.target);
        await api('/api/issues', { method: 'POST', body: fd });
        await loadEverything();
        bindShell();
        setToast('Issue reported', 'success');
      } catch (error) { setToast(error.message, 'error'); }
    };
  }
}

function submitJsonForm(url) {
  return async e => {
    e.preventDefault();
    try {
      const body = Object.fromEntries(new FormData(e.target));
      if (!body.createLogin) delete body.userPassword;
      await api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      e.target.reset();
      await loadEverything();
      bindShell();
      setToast('Saved', 'success');
    } catch (error) {
      setToast(error.message, 'error');
    }
  };
}

async function loadEverything() {
  if (!state.user) return;
  const [dashboard, drivers, vehicles, assignments, shifts, inspections, issues] = await Promise.all([
    api('/api/dashboard'), api('/api/drivers'), api('/api/vehicles'), api('/api/assignments'), api('/api/shifts'), api('/api/inspections'), api('/api/issues')
  ]);
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
    await loadEverything();
  } catch {
    clearSession();
  }
  render();
})();
