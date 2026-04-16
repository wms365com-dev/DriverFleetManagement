const inspectionItems = ['Lights','Brakes','Horn','Mirrors','Tires','Windshield','Wipers','Fluid Leaks','Coupling Equipment','Safety Equipment'];

const state = {
  drivers: [], vehicles: [], assignments: [], inspections: [], issues: [], dashboard: null
};

async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let msg = 'Request failed';
    try { const data = await res.json(); msg = data.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function statusTag(value = '') {
  return `<span class="tag ${String(value).replace(/\s+/g, '_')}">${value}</span>`;
}

function renderNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.view).classList.add('active');
    };
  });
}

async function loadAll() {
  const [dashboard, drivers, vehicles, assignments, inspections, issues] = await Promise.all([
    api('/api/dashboard'), api('/api/drivers'), api('/api/vehicles'), api('/api/assignments'), api('/api/inspections'), api('/api/issues')
  ]);
  state.dashboard = dashboard;
  state.drivers = drivers;
  state.vehicles = vehicles;
  state.assignments = assignments;
  state.inspections = inspections;
  state.issues = issues;
  renderAll();
}

function assignedVehicleName(driverId) {
  const assignment = state.assignments.find(a => a.driverId === driverId && a.active);
  if (!assignment) return 'Unassigned';
  const vehicle = state.vehicles.find(v => v.id === assignment.vehicleId);
  return vehicle ? vehicle.unitNumber : 'Unknown';
}

function renderDashboard() {
  const el = document.getElementById('dashboard');
  el.innerHTML = `
    <div class="grid cards">
      <div class="card"><h3>Drivers</h3><div>${state.dashboard.drivers}</div></div>
      <div class="card"><h3>Vehicles</h3><div>${state.dashboard.vehicles}</div></div>
      <div class="card"><h3>Drivers on Shift</h3><div>${state.dashboard.activeShifts}</div></div>
      <div class="card"><h3>Inspections Today</h3><div>${state.dashboard.inspectionsToday}</div></div>
      <div class="card"><h3>Open Issues</h3><div>${state.dashboard.openIssues}</div></div>
      <div class="card"><h3>Out of Service</h3><div>${state.dashboard.outOfService}</div></div>
    </div>
    <div class="two-col" style="margin-top:16px;">
      <div class="card">
        <h2>Recent Open Issues</h2>
        ${state.issues.length ? state.issues.slice(-5).reverse().map(i => `<p><strong>#${i.id}</strong> ${i.description}<br><span class="small">Vehicle ${vehicleName(i.vehicleId)} • ${i.severity}</span></p>`).join('') : '<p>No issues yet.</p>'}
      </div>
      <div class="card">
        <h2>Vehicle Status</h2>
        ${state.vehicles.map(v => `<p><strong>${v.unitNumber}</strong> ${statusTag(v.status)}</p>`).join('')}
      </div>
    </div>`;
}

function renderDrivers() {
  const el = document.getElementById('drivers');
  el.innerHTML = `
    <div class="two-col">
      <div class="card table-wrap">
        <h2>Drivers</h2>
        <table>
          <thead><tr><th>Name</th><th>License</th><th>Status</th><th>Assigned Vehicle</th></tr></thead>
          <tbody>
            ${state.drivers.map(d => `<tr><td>${d.firstName} ${d.lastName}</td><td>${d.licenseClass} / ${d.licenseNumber}</td><td>${statusTag(d.status)}</td><td>${assignedVehicleName(d.id)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="card">
        <h2>Add Driver</h2>
        <form id="driverForm">
          <input name="firstName" placeholder="First name" required />
          <input name="lastName" placeholder="Last name" required />
          <input name="phone" placeholder="Phone" />
          <input name="email" placeholder="Email" />
          <input name="licenseNumber" placeholder="License number" />
          <input name="licenseClass" placeholder="License class" />
          <input name="licenseExpiry" type="date" />
          <button class="primary" type="submit">Save Driver</button>
        </form>
      </div>
    </div>`;
  document.getElementById('driverForm').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/api/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fd)) });
    e.target.reset();
    loadAll();
  };
}

function renderVehicles() {
  const el = document.getElementById('vehicles');
  el.innerHTML = `
    <div class="two-col">
      <div class="card table-wrap">
        <h2>Vehicles</h2>
        <table>
          <thead><tr><th>Unit</th><th>Details</th><th>Odometer</th><th>Status</th></tr></thead>
          <tbody>
            ${state.vehicles.map(v => `<tr><td>${v.unitNumber}</td><td>${v.year} ${v.make} ${v.model}<br><span class="small">${v.plateNumber}</span></td><td>${v.odometer}</td><td>${statusTag(v.status)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="card">
        <h2>Add Vehicle</h2>
        <form id="vehicleForm">
          <input name="unitNumber" placeholder="Unit number" required />
          <input name="plateNumber" placeholder="Plate number" />
          <input name="vin" placeholder="VIN" />
          <input name="make" placeholder="Make" />
          <input name="model" placeholder="Model" />
          <input name="year" placeholder="Year" type="number" />
          <select name="type"><option value="tractor">Tractor</option><option value="straight_truck">Straight Truck</option><option value="van">Van</option><option value="trailer">Trailer</option></select>
          <input name="odometer" placeholder="Odometer" type="number" />
          <button class="primary" type="submit">Save Vehicle</button>
        </form>
      </div>
    </div>`;
  document.getElementById('vehicleForm').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/api/vehicles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fd)) });
    e.target.reset();
    loadAll();
  };
}

function renderAssignments() {
  const el = document.getElementById('assignments');
  el.innerHTML = `
    <div class="two-col">
      <div class="card table-wrap">
        <h2>Assignments</h2>
        <table>
          <thead><tr><th>Driver</th><th>Vehicle</th><th>Status</th><th>Assigned</th></tr></thead>
          <tbody>
            ${state.assignments.slice().reverse().map(a => `<tr><td>${driverName(a.driverId)}</td><td>${vehicleName(a.vehicleId)}</td><td>${statusTag(a.active ? 'active' : 'inactive')}</td><td>${new Date(a.assignedAt).toLocaleString()}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="card">
        <h2>Assign Driver to Vehicle</h2>
        <form id="assignmentForm">
          <select name="driverId" required>${state.drivers.map(d => `<option value="${d.id}">${d.firstName} ${d.lastName}</option>`).join('')}</select>
          <select name="vehicleId" required>${state.vehicles.map(v => `<option value="${v.id}">${v.unitNumber}</option>`).join('')}</select>
          <button class="primary" type="submit">Assign</button>
        </form>
      </div>
    </div>`;
  document.getElementById('assignmentForm').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/api/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fd)) });
    loadAll();
  };
}

function renderInspections() {
  const el = document.getElementById('inspections');
  el.innerHTML = `
    <div class="card table-wrap">
      <h2>Inspection History</h2>
      <table>
        <thead><tr><th>ID</th><th>Driver</th><th>Vehicle</th><th>Status</th><th>Time</th><th>Photos</th></tr></thead>
        <tbody>
          ${state.inspections.slice().reverse().map(i => `<tr><td>#${i.id}</td><td>${driverName(i.driverId)}</td><td>${vehicleName(i.vehicleId)}</td><td>${statusTag(i.overallStatus)}</td><td>${new Date(i.inspectionTime).toLocaleString()}</td><td>${i.photos?.length || 0}</td></tr>`).join('') || '<tr><td colspan="6">No inspections yet.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function renderIssues() {
  const el = document.getElementById('issues');
  el.innerHTML = `
    <div class="card table-wrap">
      <h2>Issues</h2>
      <table>
        <thead><tr><th>ID</th><th>Vehicle</th><th>Description</th><th>Severity</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          ${state.issues.slice().reverse().map(i => `<tr><td>#${i.id}</td><td>${vehicleName(i.vehicleId)}</td><td>${i.description}</td><td>${statusTag(i.severity)}</td><td>${statusTag(i.status)}</td><td>${i.status !== 'closed' ? `<button class="pill-btn" onclick="closeIssue(${i.id})">Mark Closed</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">No issues reported.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

function renderDriverPortal() {
  const el = document.getElementById('driverPortal');
  el.innerHTML = `
    <div class="driver-layout">
      <div class="card">
        <h2>Driver Portal</h2>
        <p class="small">Choose a driver to simulate the mobile flow.</p>
        <select id="driverSelect">${state.drivers.map(d => `<option value="${d.id}">${d.firstName} ${d.lastName}</option>`).join('')}</select>
      </div>
      <div id="driverPortalContent"></div>
    </div>`;
  document.getElementById('driverSelect').onchange = loadDriverPortal;
  loadDriverPortal();
}

async function loadDriverPortal() {
  const driverId = document.getElementById('driverSelect')?.value;
  if (!driverId) return;
  const data = await api(`/api/driver-view/${driverId}`);
  const content = document.getElementById('driverPortalContent');
  if (!data.driver) {
    content.innerHTML = '<div class="card">Driver not found.</div>';
    return;
  }

  const checklist = inspectionItems.map(item => `
    <div class="check-item">
      <strong>${item}</strong>
      <div class="inline">
        <label><input type="radio" name="${item}" value="pass" checked /> Pass</label>
        <label><input type="radio" name="${item}" value="fail" /> Fail</label>
        <label><input type="radio" name="${item}" value="na" /> N/A</label>
      </div>
      <input type="text" name="note_${item}" placeholder="Notes for ${item}" />
    </div>`).join('');

  content.innerHTML = `
    <div class="card">
      <h3>${data.driver.firstName} ${data.driver.lastName}</h3>
      <p><strong>Assigned Vehicle:</strong> ${data.vehicle ? data.vehicle.unitNumber : 'None assigned'}</p>
      <p><strong>Shift Status:</strong> ${data.activeShift ? statusTag('started') : 'Not started'}</p>
      ${data.vehicle ? `
        ${data.activeShift ? `
          <form id="endShiftForm">
            <input type="hidden" name="shiftId" value="${data.activeShift.id}" />
            <input type="number" name="endOdometer" placeholder="End odometer" required />
            <button class="secondary" type="submit">End Shift</button>
          </form>
        ` : `
          <form id="startShiftForm">
            <input type="hidden" name="driverId" value="${data.driver.id}" />
            <input type="hidden" name="vehicleId" value="${data.vehicle.id}" />
            <input type="number" name="startOdometer" placeholder="Start odometer" required />
            <button class="primary" type="submit">Start Shift</button>
          </form>
        `}
      ` : '<p class="small">Assign a vehicle before starting shift.</p>'}
    </div>
    ${data.vehicle ? `
      <div class="card">
        <h3>Pre-Trip Inspection</h3>
        <p class="small">Complete after shift start. Failed items can create an issue automatically.</p>
        <form id="inspectionForm" enctype="multipart/form-data">
          <input type="hidden" name="driverId" value="${data.driver.id}" />
          <input type="hidden" name="vehicleId" value="${data.vehicle.id}" />
          <input type="hidden" name="shiftId" value="${data.activeShift ? data.activeShift.id : ''}" />
          <input type="number" name="odometer" placeholder="Current odometer" required />
          <select name="overallStatus"><option value="pass">Pass</option><option value="pass_with_defects">Pass with defects</option><option value="fail">Fail</option></select>
          <div class="checklist">${checklist}</div>
          <textarea name="notes" placeholder="General notes"></textarea>
          <label><input type="checkbox" name="issueFlag" value="true" /> Create issue/defect record</label>
          <select name="category"><option value="mechanical">Mechanical</option><option value="tires">Tires</option><option value="lights">Lights</option><option value="body_damage">Body Damage</option><option value="safety">Safety</option><option value="other">Other</option></select>
          <select name="severity"><option value="low">Low</option><option value="medium">Medium</option><option value="critical">Critical</option></select>
          <textarea name="issueDescription" placeholder="Issue description"></textarea>
          <input type="file" name="photos" accept="image/*" multiple />
          <button class="primary" type="submit">Submit Inspection</button>
        </form>
      </div>
      <div class="card">
        <h3>Quick Issue Report</h3>
        <form id="quickIssueForm" enctype="multipart/form-data">
          <input type="hidden" name="driverId" value="${data.driver.id}" />
          <input type="hidden" name="vehicleId" value="${data.vehicle.id}" />
          <input type="hidden" name="shiftId" value="${data.activeShift ? data.activeShift.id : ''}" />
          <select name="category"><option value="mechanical">Mechanical</option><option value="tires">Tires</option><option value="lights">Lights</option><option value="body_damage">Body Damage</option><option value="safety">Safety</option><option value="other">Other</option></select>
          <select name="severity"><option value="low">Low</option><option value="medium">Medium</option><option value="critical">Critical</option></select>
          <textarea name="description" placeholder="Describe the issue" required></textarea>
          <input type="file" name="photos" accept="image/*" multiple />
          <button class="secondary" type="submit">Report Issue</button>
        </form>
      </div>
    ` : ''}`;

  const startForm = document.getElementById('startShiftForm');
  if (startForm) startForm.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/api/shifts/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fd)) });
    await loadAll();
    renderDriverPortal();
  };

  const endForm = document.getElementById('endShiftForm');
  if (endForm) endForm.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api('/api/shifts/end', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fd)) });
    await loadAll();
    renderDriverPortal();
  };

  const inspectionForm = document.getElementById('inspectionForm');
  if (inspectionForm) inspectionForm.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const itemResults = inspectionItems.map(item => ({
      item,
      result: fd.get(item),
      notes: fd.get(`note_${item}`) || ''
    }));
    fd.set('itemResults', JSON.stringify(itemResults));
    if (!fd.get('shiftId')) {
      alert('Start the shift first.');
      return;
    }
    await fetch('/api/inspections', { method: 'POST', body: fd }).then(async res => {
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to submit inspection');
      return res.json();
    });
    alert('Inspection submitted');
    await loadAll();
    renderDriverPortal();
  };

  const quickIssueForm = document.getElementById('quickIssueForm');
  if (quickIssueForm) quickIssueForm.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await fetch('/api/issues', { method: 'POST', body: fd }).then(async res => {
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to report issue');
      return res.json();
    });
    alert('Issue reported');
    await loadAll();
    renderDriverPortal();
  };
}

async function closeIssue(id) {
  await api(`/api/issues/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'closed', resolutionNotes: 'Closed from dashboard' }) });
  loadAll();
}
window.closeIssue = closeIssue;

function driverName(id) {
  const d = state.drivers.find(x => x.id === id);
  return d ? `${d.firstName} ${d.lastName}` : 'Unknown';
}
function vehicleName(id) {
  const v = state.vehicles.find(x => x.id === id);
  return v ? v.unitNumber : 'Unknown';
}

function renderAll() {
  renderDashboard();
  renderDrivers();
  renderVehicles();
  renderAssignments();
  renderInspections();
  renderIssues();
  renderDriverPortal();
}

renderNav();
loadAll().catch(err => {
  document.body.innerHTML = `<div style="padding:20px;font-family:Arial"><h2>Prototype error</h2><p>${err.message}</p></div>`;
});
