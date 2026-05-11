const { chromium } = require('@playwright/test');

const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:3120';
const adminEmail = process.env.QA_ADMIN_EMAIL || process.env.SUPER_EMAIL || process.env.ADMIN_EMAIL || 'owner@example.com';
const adminPassword = process.env.QA_ADMIN_PASSWORD || process.env.SUPER_PASSWORD || process.env.ADMIN_PASSWORD || 'TempStrongPass123!';

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(body.error || `${res.status()} ${res.statusText()}`);
  return body;
}
async function browserJson(page, method, path, data) {
  return page.evaluate(async ({ method, path, data }) => {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
      body: data ? JSON.stringify(data) : undefined
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`);
    return body;
  }, { method, path, data });
}

async function runStep(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail || '');
  } catch (error) {
    record(name, false, error.message);
  }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const suffix = Date.now().toString(36).slice(-6);
  let companyId;
  let adminUser;
  let driverUser;
  let vehicle;
  let load;
  let blockedBillingUser;

  await runStep('Marketing home page', async () => {
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /sign up/i }).first().waitFor({ timeout: 10000 });
    expect(await page.getByText('Dispatch Software').first().isVisible(), 'Marketing value prop missing');
    expect(await page.getByRole('link', { name: /shipment tracking/i }).first().isVisible(), 'Tracking link missing');
    expect(await page.getByRole('heading', { name: /Start with a company workspace/i }).isVisible(), 'Pricing section missing');
    expect(await page.getByLabel(/Pricing and fees menu/i).isVisible(), 'Pricing fees menu missing');
    expect(await page.getByText(/What customers pay for/i).isVisible(), 'Pricing fees menu heading missing');
  });

  await runStep('Public Stripe billing config', async () => {
    const config = await json(await page.request.get(`${baseURL}/api/public/billing-config`));
    expect(Object.prototype.hasOwnProperty.call(config, 'stripeConfigured'), 'Stripe billing config missing configured flag');
    expect(config.plans?.operations?.name === 'Operations', 'Operations billing plan missing');
    const checkout = await page.request.post(`${baseURL}/api/public/create-checkout-session`, {
      data: { plan: 'operations', driverQuantity: 3, email: `billing.${suffix}@example.test`, companyName: `Billing QA ${suffix}` }
    });
    if (!config.stripeConfigured) {
      expect(checkout.status() === 503, 'Unconfigured Stripe checkout should return 503');
    } else {
      const body = await json(checkout);
      expect(/^https:\/\/checkout\.stripe\.com\//.test(body.url || ''), 'Stripe checkout URL missing');
    }
  });

  await runStep('Public signup submission', async () => {
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    await page.getByLabel('Company name').fill(`QA Signup ${suffix}`);
    await page.getByLabel('Fleet size').selectOption('1-5');
    await page.getByLabel('First name').fill('QA');
    await page.getByLabel('Last name').fill('Signup');
    await page.getByLabel('Email').fill(`qa.signup.${suffix}@example.test`);
    await page.getByLabel('Phone').fill('5555555555');
    await page.getByLabel('Password', { exact: true }).fill('StrongPass123!');
    await page.getByLabel('Confirm password').fill('StrongPass123!');
    await page.getByRole('button', { name: /create company workspace/i }).click();
    await page.getByText(/workspace request has been submitted/i).waitFor({ timeout: 10000 });
  });

  await runStep('Public demo tracking page', async () => {
    await page.goto(`${baseURL}/track/DEMO0001-2026-000777`, { waitUntil: 'networkidle' });
    expect(await page.getByText('35 Orlando Drive', { exact: true }).isVisible(), 'Demo delivery address not visible');
    expect(await page.getByText(/Delivered/i).first().isVisible(), 'Delivered status not visible');
  });

  await runStep('Portal login as super admin', async () => {
    await page.goto(`${baseURL}/portal`, { waitUntil: 'networkidle' });
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill(adminPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByRole('button', { name: /log out/i }).waitFor({ timeout: 10000 });
  });

  await runStep('Payment issue blocks company portal access', async () => {
    const company = await browserJson(page, 'POST', '/api/companies', { name: `QA Billing Block ${suffix}`, code: `BILL${suffix}`.slice(0, 8), status: 'active', adminEmail: `qa.billing.${suffix}@example.test`, adminPassword: 'StrongPass123!', adminFirstName: 'Billing', adminLastName: 'Blocked' });
    blockedBillingUser = { email: `qa.billing.${suffix}@example.test`, password: 'StrongPass123!', companyId: company.id };
    await browserJson(page, 'PATCH', `/api/companies/${company.id}/billing`, { billingStatus: 'past_due', billingPlan: 'operations' });
    await browserJson(page, 'POST', '/api/auth/logout').catch(() => null);
    await page.goto(`${baseURL}/portal`, { waitUntil: 'networkidle' });
    await page.getByLabel('Email').fill(blockedBillingUser.email);
    await page.getByLabel('Password').fill(blockedBillingUser.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByText(/subscription needs payment attention/i).waitFor({ timeout: 10000 });
    await page.goto(`${baseURL}/portal`, { waitUntil: 'networkidle' });
    await page.getByLabel('Email').fill(adminEmail);
    await page.getByLabel('Password').fill(adminPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByRole('button', { name: /log out/i }).waitFor({ timeout: 10000 });
  });

  await runStep('Create company admin, driver, equipment, assignment, and load through API', async () => {
    const companies = await browserJson(page, 'GET', '/api/companies');
    companyId = companies.find(c => c.status === 'active')?.id || companies[0]?.id;
    expect(companyId, 'No company available for QA setup');

    adminUser = await browserJson(page, 'POST', `/api/users?companyId=${companyId}`, { firstName: 'QA', lastName: 'Admin', email: `qa.admin.${suffix}@example.test`, password: 'StrongPass123!', role: 'admin' });
    const driver = await browserJson(page, 'POST', `/api/drivers?companyId=${companyId}`, { firstName: 'QA', lastName: 'Driver', phone: '5555555555', email: `qa.driver.${suffix}@example.test`, licenseClass: 'G', status: 'active', createLogin: true, userPassword: 'StrongPass123!' });
    driverUser = { email: `qa.driver.${suffix}@example.test`, password: 'StrongPass123!', id: driver.id };
    vehicle = await browserJson(page, 'POST', `/api/vehicles?companyId=${companyId}`, { unitNumber: `QA-VAN-${suffix}`, type: 'cargo_van', category: 'power_unit', plateNumber: 'QA', make: 'Ford', model: 'Transit', year: 2025, status: 'active' });
    await browserJson(page, 'POST', `/api/assignments?companyId=${companyId}`, { driverId: driver.id, vehicleId: vehicle.id });
    load = await browserJson(page, 'POST', `/api/loads?companyId=${companyId}`, {
        loadType: 'sprinter_van',
        customer: `QA Customer ${suffix}`,
        pickupName: 'QA Pickup',
        pickupAddress: '100 Pickup Road',
        deliveryName: 'QA Delivery 1',
        deliveryAddress: '200 Delivery Road',
        commodity: 'QA freight',
        weight: 100,
        pieces: '2 cartons',
        extraStops: JSON.stringify([{ type: 'delivery', name: 'QA Delivery 2', address: '300 Extra Stop Road', appointment: '2026-05-11T14:00', notes: 'Second delivery' }])
    });
    const assigned = await browserJson(page, 'PATCH', `/api/loads/${load.id}/assignment?companyId=${companyId}`, { driverId: driver.id, vehicleId: vehicle.id, trailerId: '' });
    expect(assigned.driverId === driver.id, 'Load assignment did not persist');
    return `company ${companyId}, load ${load.loadNumber}`;
  });

  await runStep('Admin portal screens and dispatch board', async () => {
    await browserJson(page, 'POST', '/api/auth/logout').catch(() => null);
    await page.goto(`${baseURL}/portal`, { waitUntil: 'networkidle' });
    await page.getByLabel('Email').fill(adminUser.email);
    await page.getByLabel('Password').fill('StrongPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByRole('button', { name: /log out/i }).waitFor({ timeout: 10000 });
    await page.getByText(/Admin Home/i).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Dispatch / Loads', exact: true }).click();
    await page.getByRole('heading', { name: 'Dispatch Board' }).waitFor({ timeout: 10000 });
    expect((await page.locator('body').innerText()).includes(load.loadNumber), 'QA load missing from dispatch board');
    expect(await page.getByText(/Unassigned Loads Queue/i).isVisible(), 'Unassigned loads queue missing from dispatch board');
    expect(await page.getByText(/extra stop/i).first().isVisible(), 'Extra stop summary missing');
    await page.getByRole('button', { name: /Notifications/i }).click();
    await page.getByText(/Notifications/i).first().waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /Bug Reports/i }).click();
    await page.getByText(/Report a Bug/i).waitFor({ timeout: 10000 });
  });

  await runStep('Public tracking for created multi-stop load', async () => {
    await page.goto(`${baseURL}/track/${encodeURIComponent(load.publicTrackingToken)}`, { waitUntil: 'networkidle' });
    await page.getByText(load.loadNumber).waitFor({ timeout: 10000 });
    expect(await page.getByText(/QA Delivery 2/i).isVisible(), 'Public tracking extra stop missing');
  });

  await runStep('Driver mobile inspection gate', async () => {
    await mobile.goto(`${baseURL}/portal`, { waitUntil: 'networkidle' });
    await mobile.getByLabel('Email').fill(driverUser.email);
    await mobile.getByLabel('Password').fill(driverUser.password);
    await mobile.getByRole('button', { name: /sign in/i }).click();
    await mobile.getByText(/inspection required/i).first().waitFor({ timeout: 10000 });
    expect(await mobile.getByText(/Ready for work locked/i).isVisible(), 'Driver ready lock missing');
    await mobile.getByRole('button', { name: /Assigned Work/i }).click();
    await mobile.getByText(/Pre-trip inspection required/i).waitFor({ timeout: 10000 });
    const lockedAccept = mobile.getByRole('button', { name: /^Accept$/ }).first();
    expect(await lockedAccept.isDisabled(), 'Driver can accept work before inspection');
  });

  await runStep('Driver mobile inspection, check-in, and assigned work flow', async () => {
    await mobile.getByRole('button', { name: /Check-In/i }).click();
    await mobile.locator('#inspectionForm').waitFor({ timeout: 10000 });
    await mobile.locator('#inspectionForm input[name="odometer"]').fill('123456');
    await mobile.locator('#inspectionSubmitBtn').click();

    await mobile.locator('#startShiftForm').waitFor({ timeout: 10000 });
    await mobile.locator('#startShiftForm input[name="startOdometer"]').fill('123456');
    await mobile.locator('#startShiftBtn').click();
    await mobile.getByText(/Shift started/i).waitFor({ timeout: 10000 });

    await mobile.getByRole('button', { name: /Assigned Work/i }).click();
    await mobile.getByText(load.loadNumber).waitFor({ timeout: 10000 });
    expect(await mobile.getByText(/Pre-trip inspection required before updating this load/i).count() === 0, 'Inspection warning remained after passing inspection');
    const accept = mobile.getByRole('button', { name: /^Accept$/ }).first();
    expect(!(await accept.isDisabled()), 'Driver accept button remains disabled after inspection');
    await accept.click();
    await mobile.getByText(/Load updated/i).waitFor({ timeout: 10000 });
    await mobile.getByText(/accepted/i).first().waitFor({ timeout: 10000 });
  });

  await runStep('Inspection report, customer visibility, notification settings, and repair closure', async () => {
    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })).catch(() => null);
    await page.goto(`${baseURL}/portal`, { waitUntil: 'networkidle' });
    await page.getByLabel('Email').fill(adminUser.email);
    await page.getByLabel('Password').fill('StrongPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByRole('button', { name: /log out/i }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /Inspections/i }).click();
    await page.getByText(vehicle.unitNumber).first().waitFor({ timeout: 10000 });
    const inspectionLink = page.getByRole('link', { name: /Print Inspection/i }).first();
    const href = await inspectionLink.getAttribute('href');
    expect(Boolean(href), 'Printable inspection link missing');
    const report = await page.request.get(`${baseURL}${href}`);
    expect(report.ok(), 'Printable inspection report failed');
    expect((await report.text()).includes('Driver Vehicle Inspection Report'), 'Inspection report title missing');

    await page.getByRole('button', { name: 'Dispatch / Loads', exact: true }).click();
    await page.locator('body').waitFor({ timeout: 10000 });
    expect((await page.locator('body').innerText()).includes(load.loadNumber), 'Load missing from dispatch loads page');
    await browserJson(page, 'PATCH', `/api/loads/${load.id}/customer-visibility?companyId=${companyId}`, { customerEmail: `customer.${suffix}@example.test`, customerPhone: '5555550000', publicDocumentTypes: ['bol', 'pod'] });
    await page.getByRole('button', { name: /Settings/i }).click();
    await page.getByText(/Notification delivery/i).waitFor({ timeout: 10000 });
    await page.getByText(/Backup and restore/i).waitFor({ timeout: 10000 });

    const issue = await browserJson(page, 'POST', `/api/issues?companyId=${companyId}`, { vehicleId: vehicle.id, category: 'safety', severity: 'medium', description: `QA repair closure ${suffix}` });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /log out/i }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /Defects \/ Repairs/i }).click();
    await page.getByText(`QA repair closure ${suffix}`).waitFor({ timeout: 10000 });
    await page.locator(`.close-issue-form[data-id="${issue.id}"] textarea[name="resolutionNotes"]`).fill('QA repaired and verified safe');
    await page.locator(`.close-issue-form[data-id="${issue.id}"] button[type="submit"]`).click();
    await page.getByText(/Defect closed and maintenance updated/i).waitFor({ timeout: 10000 });
  });

  await page.screenshot({ path: 'backups/qa-desktop.png', fullPage: true });
  await mobile.screenshot({ path: 'backups/qa-mobile.png', fullPage: true });
  await browser.close();

  const failed = results.filter(item => !item.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, failed, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
