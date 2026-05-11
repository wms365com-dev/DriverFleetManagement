const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const baseURL = process.env.GUIDE_BASE_URL || process.env.QA_BASE_URL || 'http://127.0.0.1:3120';
const adminEmail = process.env.QA_ADMIN_EMAIL || process.env.SUPER_EMAIL || process.env.ADMIN_EMAIL || 'owner@example.com';
const adminPassword = process.env.QA_ADMIN_PASSWORD || process.env.SUPER_PASSWORD || process.env.ADMIN_PASSWORD || 'TempStrongPass123!';
const outDir = path.resolve(__dirname, '..', 'public', 'guides');
const shotDir = path.join(outDir, 'screenshots');

function ensureDirs() {
  fs.mkdirSync(shotDir, { recursive: true });
}

async function browserJson(page, method, apiPath, data) {
  return page.evaluate(async ({ method, apiPath, data }) => {
    const res = await fetch(apiPath, {
      method,
      credentials: 'same-origin',
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
      body: data ? JSON.stringify(data) : undefined
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `${res.status} ${res.statusText}`);
    return body;
  }, { method, apiPath, data });
}

async function screenshot(page, filename) {
  await page.screenshot({ path: path.join(shotDir, filename), fullPage: false, quality: 82 });
}

async function login(page, email, password) {
  await page.goto(`${baseURL}/portal`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('button', { name: /log out/i }).waitFor({ timeout: 15000 });
}

async function setupGuideData(page) {
  const suffix = Date.now().toString(36).slice(-6);
  const companies = await browserJson(page, 'GET', '/api/companies');
  const companyId = companies.find(c => c.status === 'active' && c.billingStatus === 'active')?.id || companies.find(c => c.status === 'active')?.id || companies[0]?.id;
  const admin = await browserJson(page, 'POST', `/api/users?companyId=${companyId}`, {
    firstName: 'Guide',
    lastName: 'Dispatcher',
    email: `guide.dispatcher.${suffix}@example.test`,
    password: 'StrongPass123!',
    role: 'admin'
  });
  const driver = await browserJson(page, 'POST', `/api/drivers?companyId=${companyId}`, {
    firstName: 'Guide',
    lastName: 'Driver',
    phone: '5555551212',
    email: `guide.driver.${suffix}@example.test`,
    licenseClass: 'G',
    status: 'active',
    createLogin: true,
    userPassword: 'StrongPass123!'
  });
  const vehicle = await browserJson(page, 'POST', `/api/vehicles?companyId=${companyId}`, {
    unitNumber: `GUIDE-VAN-${suffix}`,
    type: 'cargo_van',
    category: 'power_unit',
    plateNumber: 'GUIDE',
    make: 'Ford',
    model: 'Transit',
    year: 2025,
    status: 'active'
  });
  await browserJson(page, 'POST', `/api/assignments?companyId=${companyId}`, { driverId: driver.id, vehicleId: vehicle.id });
  const load = await browserJson(page, 'POST', `/api/loads?companyId=${companyId}`, {
    loadType: 'sprinter_van',
    customer: `Guide Customer ${suffix}`,
    pickupName: 'Guide Pickup Dock',
    pickupAddress: '100 Guide Pickup Road',
    deliveryName: 'Guide Delivery Door',
    deliveryAddress: '200 Guide Delivery Road',
    commodity: 'General freight',
    weight: 1200,
    pieces: '2 pallets',
    driverId: driver.id,
    vehicleId: vehicle.id
  });
  return {
    companyId,
    admin,
    driverUser: { email: `guide.driver.${suffix}@example.test`, password: 'StrongPass123!' },
    load
  };
}

function guideCss() {
  return `<style>
    :root{--ink:#0d1722;--muted:#5b6b7d;--line:#dce4ee;--brand:#1685e5;--paper:#f7f9fc}
    *{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:var(--ink);background:var(--paper);line-height:1.55}
    header{padding:42px 6vw;background:#07111c;color:#fff}header h1{margin:10px 0 0;font-size:clamp(34px,5vw,58px);line-height:1.05}header p{max-width:920px;color:#c8d4e3;font-size:18px}
    nav{position:sticky;top:0;z-index:2;display:flex;gap:10px;flex-wrap:wrap;padding:14px 6vw;background:#fff;border-bottom:1px solid var(--line)}nav a{color:var(--brand);font-weight:700;text-decoration:none}
    main{padding:30px 6vw 70px}.section{margin:0 0 28px;padding:24px;border:1px solid var(--line);border-radius:18px;background:#fff;box-shadow:0 14px 35px rgba(8,16,24,.06)}
    h2{margin:0 0 8px;font-size:30px}.meta{color:var(--muted);margin-top:0}.steps{display:grid;gap:8px;margin:16px 0}.steps li{padding-left:4px}.shot{margin-top:18px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#eef3f8}.shot img{display:block;width:100%;height:auto;max-height:760px;object-fit:contain;background:#07111c}.note{padding:14px;border-left:4px solid var(--brand);background:#eef6ff;border-radius:10px;color:#243242}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.toc{display:grid;gap:8px;margin-top:18px}.toc a{color:#fff;text-decoration:none}
    footer{padding:24px 6vw;color:var(--muted)}@media(max-width:800px){.grid{grid-template-columns:1fr}nav{position:static}}
  </style>`;
}

const sectionsEn = [
  ['home', 'Marketing Page And Pricing', 'Use the public home page to explain Dispatcher365, show the 14-day card-required trial, and send customers to signup or shipment tracking.', ['Open the home page.', 'Review pricing and the fees menu.', 'Select Start 14-Day Trial when the customer is ready to set up billing.'], '01-home.jpg'],
  ['signup', 'Company Signup', 'A company signs up first. The workspace stays pending until super admin approval and billing are active.', ['Enter company name and fleet size.', 'Choose plan and active driver count.', 'Create the first admin user.', 'Use Stripe trial setup to add the card.'], '02-signup.jpg'],
  ['tracking', 'Public Shipment Tracking', 'Customers can track loads without logging into the dispatcher portal.', ['Open Shipment Tracking.', 'Enter the load or tracking ID.', 'Review status history, stops, and approved documents.'], '03-tracking.jpg'],
  ['admin', 'Admin Home', 'Admins manage company setup, users, drivers, equipment, assignments, billing status, and reports.', ['Log in as admin or super admin.', 'Use the dashboard cards to open setup areas.', 'Watch company approval and billing status before users log in.'], '04-admin-home.jpg'],
  ['companies', 'Company Approval And Billing', 'Super admin approves companies and can see whether billing is active or blocking access.', ['Open Company Setup.', 'Approve pending companies.', 'Use Mark Paid only when billing has been verified.'], '05-companies.jpg'],
  ['dispatch', 'Dispatch Board And Create Load', 'Dispatchers create loads, add stops, assign drivers and compatible equipment, and monitor unassigned loads.', ['Open Dispatch / Loads.', 'Use saved customer/location fields to reduce typing.', 'Assign driver and vehicle.', 'Use the board to monitor today, upcoming, unassigned, and in-transit work.'], '06-dispatch-loads.jpg'],
  ['driver-checkin', 'Driver Check-In And Inspection', 'Drivers must complete a vehicle inspection before becoming ready for work or updating assigned loads.', ['Driver logs in on mobile.', 'Open Check-In.', 'Submit pre-trip inspection.', 'Start shift after the inspection unlocks readiness.'], '07-driver-checkin.jpg'],
  ['driver-work', 'Driver Assigned Work', 'Drivers update pickup, transit, delivery, BOL/POD, exceptions, and signatures from the mobile assigned work page.', ['Open Assigned Work.', 'Use one-tap load status buttons.', 'Upload required proof documents.', 'Capture signature when needed.'], '08-driver-work.jpg'],
  ['customer', 'Customer Tracking And Visibility', 'Dispatch can copy public tracking links and control which proof documents customers can see.', ['Open Customer Tracking.', 'Search customer or load.', 'Copy update text or tracking links.', 'Choose public BOL/POD visibility on the load card.'], '09-customer-tracking.jpg'],
  ['reports', 'Reports, Settings, And Support', 'Reports summarize load activity, inspections, defects, documents, and driver activity. Settings show company configuration, notifications, and backup guidance.', ['Open Reports for operational summaries.', 'Open Settings to confirm setup status.', 'Use Bug Reports when staff or drivers need to report an app issue.'], '10-reports-settings.jpg']
];

const sectionsPa = [
  ['home', 'ਮਾਰਕੀਟਿੰਗ ਪੇਜ ਅਤੇ ਕੀਮਤਾਂ', 'ਪਬਲਿਕ ਹੋਮ ਪੇਜ Dispatcher365 ਦੀ ਜਾਣਕਾਰੀ, 14 ਦਿਨ ਦੀ ਕਾਰਡ-ਲਾਜ਼ਮੀ ਟਰਾਇਲ, ਅਤੇ ਸਾਈਨਅਪ/ਟਰੈਕਿੰਗ ਲਿੰਕ ਦਿਖਾਉਂਦਾ ਹੈ।', ['ਹੋਮ ਪੇਜ ਖੋਲ੍ਹੋ।', 'ਕੀਮਤਾਂ ਅਤੇ ਫੀਸ ਮੀਨੂ ਦੇਖੋ।', 'ਜਦੋਂ ਗਾਹਕ ਤਿਆਰ ਹੋਵੇ ਤਾਂ Start 14-Day Trial ਚੁਣੋ।'], '01-home.jpg'],
  ['signup', 'ਕੰਪਨੀ ਸਾਈਨਅਪ', 'ਪਹਿਲਾਂ ਕੰਪਨੀ ਸਾਈਨਅਪ ਕਰਦੀ ਹੈ। ਵਰਕਸਪੇਸ ਤਦ ਤੱਕ ਪੈਂਡਿੰਗ ਰਹਿੰਦਾ ਹੈ ਜਦ ਤੱਕ ਸੁਪਰ ਐਡਮਿਨ ਮਨਜ਼ੂਰੀ ਅਤੇ ਬਿਲਿੰਗ ਐਕਟਿਵ ਨਾ ਹੋਵੇ।', ['ਕੰਪਨੀ ਨਾਮ ਅਤੇ ਫਲੀਟ ਸਾਈਜ਼ ਭਰੋ।', 'ਪਲਾਨ ਅਤੇ ਐਕਟਿਵ ਡਰਾਈਵਰ ਗਿਣਤੀ ਚੁਣੋ।', 'ਪਹਿਲਾ ਐਡਮਿਨ ਯੂਜ਼ਰ ਬਣਾਓ।', 'Stripe ਟਰਾਇਲ ਨਾਲ ਕਾਰਡ ਜੋੜੋ।'], '02-signup.jpg'],
  ['tracking', 'ਪਬਲਿਕ ਸ਼ਿਪਮੈਂਟ ਟਰੈਕਿੰਗ', 'ਗਾਹਕ dispatcher portal ਵਿੱਚ ਲਾਗਇਨ ਕੀਤੇ ਬਿਨਾਂ ਲੋਡ ਟਰੈਕ ਕਰ ਸਕਦੇ ਹਨ।', ['Shipment Tracking ਖੋਲ੍ਹੋ।', 'ਲੋਡ ਜਾਂ ਟਰੈਕਿੰਗ ID ਦਾਖਲ ਕਰੋ।', 'ਸਟੇਟਸ ਹਿਸਟਰੀ, ਸਟਾਪ ਅਤੇ ਮਨਜ਼ੂਰ ਡੌਕੂਮੈਂਟ ਦੇਖੋ।'], '03-tracking.jpg'],
  ['admin', 'ਐਡਮਿਨ ਹੋਮ', 'ਐਡਮਿਨ ਕੰਪਨੀ ਸੈਟਅਪ, ਯੂਜ਼ਰ, ਡਰਾਈਵਰ, ਉਪਕਰਣ, ਅਸਾਈਨਮੈਂਟ, ਬਿਲਿੰਗ ਸਟੇਟਸ ਅਤੇ ਰਿਪੋਰਟਾਂ ਮੈਨੇਜ ਕਰਦੇ ਹਨ।', ['ਐਡਮਿਨ ਜਾਂ ਸੁਪਰ ਐਡਮਿਨ ਵਜੋਂ ਲਾਗਇਨ ਕਰੋ।', 'ਡੈਸ਼ਬੋਰਡ ਕਾਰਡਾਂ ਰਾਹੀਂ ਸੈਟਅਪ ਖੇਤਰ ਖੋਲ੍ਹੋ।', 'ਯੂਜ਼ਰ ਲਾਗਇਨ ਤੋਂ ਪਹਿਲਾਂ ਕੰਪਨੀ ਮਨਜ਼ੂਰੀ ਅਤੇ ਬਿਲਿੰਗ ਸਟੇਟਸ ਚੈਕ ਕਰੋ।'], '04-admin-home.jpg'],
  ['companies', 'ਕੰਪਨੀ ਮਨਜ਼ੂਰੀ ਅਤੇ ਬਿਲਿੰਗ', 'ਸੁਪਰ ਐਡਮਿਨ ਕੰਪਨੀਆਂ ਨੂੰ ਮਨਜ਼ੂਰ ਕਰਦਾ ਹੈ ਅਤੇ ਦੇਖਦਾ ਹੈ ਕਿ ਬਿਲਿੰਗ ਐਕਟਿਵ ਹੈ ਜਾਂ ਐਕਸੈਸ ਬਲੌਕ ਕਰ ਰਹੀ ਹੈ।', ['Company Setup ਖੋਲ੍ਹੋ।', 'ਪੈਂਡਿੰਗ ਕੰਪਨੀਆਂ ਨੂੰ ਮਨਜ਼ੂਰ ਕਰੋ।', 'Mark Paid ਸਿਰਫ਼ ਬਿਲਿੰਗ ਵੇਰੀਫਾਈ ਹੋਣ ਤੋਂ ਬਾਅਦ ਵਰਤੋ।'], '05-companies.jpg'],
  ['dispatch', 'ਡਿਸਪੈਚ ਬੋਰਡ ਅਤੇ ਲੋਡ ਬਣਾਉਣਾ', 'ਡਿਸਪੈਚਰ ਲੋਡ ਬਣਾਉਂਦੇ ਹਨ, ਸਟਾਪ ਜੋੜਦੇ ਹਨ, ਡਰਾਈਵਰ ਅਤੇ compatible equipment ਅਸਾਈਨ ਕਰਦੇ ਹਨ ਅਤੇ ਕੰਮ ਮਾਨੀਟਰ ਕਰਦੇ ਹਨ।', ['Dispatch / Loads ਖੋਲ੍ਹੋ।', 'ਸੇਵ ਕੀਤੇ customer/location ਫੀਲਡ ਵਰਤੋ।', 'ਡਰਾਈਵਰ ਅਤੇ ਵਾਹਨ ਅਸਾਈਨ ਕਰੋ।', 'ਬੋਰਡ ਰਾਹੀਂ today, upcoming, unassigned ਅਤੇ in-transit ਕੰਮ ਦੇਖੋ।'], '06-dispatch-loads.jpg'],
  ['driver-checkin', 'ਡਰਾਈਵਰ ਚੈਕ-ਇਨ ਅਤੇ ਇੰਸਪੈਕਸ਼ਨ', 'ਡਰਾਈਵਰ ਨੂੰ ਕੰਮ ਲਈ ready ਹੋਣ ਜਾਂ assigned load update ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ vehicle inspection ਪੂਰਾ ਕਰਨਾ ਲਾਜ਼ਮੀ ਹੈ।', ['ਡਰਾਈਵਰ ਮੋਬਾਈਲ ਤੇ ਲਾਗਇਨ ਕਰਦਾ ਹੈ।', 'Check-In ਖੋਲ੍ਹੋ।', 'Pre-trip inspection submit ਕਰੋ।', 'Inspection ਤੋਂ ਬਾਅਦ shift start ਕਰੋ।'], '07-driver-checkin.jpg'],
  ['driver-work', 'ਡਰਾਈਵਰ Assigned Work', 'ਡਰਾਈਵਰ pickup, transit, delivery, BOL/POD, exception ਅਤੇ signature mobile page ਤੋਂ update ਕਰਦਾ ਹੈ।', ['Assigned Work ਖੋਲ੍ਹੋ।', 'One-tap status buttons ਵਰਤੋ।', 'ਲੋੜੀਂਦੇ proof documents upload ਕਰੋ।', 'ਜਰੂਰਤ ਹੋਣ ਤੇ signature capture ਕਰੋ।'], '08-driver-work.jpg'],
  ['customer', 'Customer Tracking ਅਤੇ Visibility', 'Dispatch public tracking links copy ਕਰ ਸਕਦਾ ਹੈ ਅਤੇ ਕੰਟਰੋਲ ਕਰ ਸਕਦਾ ਹੈ ਕਿ customer ਕਿਹੜੇ proof documents ਦੇਖ ਸਕੇ।', ['Customer Tracking ਖੋਲ੍ਹੋ।', 'Customer ਜਾਂ load search ਕਰੋ।', 'Update text ਜਾਂ tracking link copy ਕਰੋ।', 'Load card ਤੇ public BOL/POD visibility ਚੁਣੋ।'], '09-customer-tracking.jpg'],
  ['reports', 'ਰਿਪੋਰਟਾਂ, ਸੈਟਿੰਗਜ਼ ਅਤੇ ਸਪੋਰਟ', 'Reports load activity, inspections, defects, documents ਅਤੇ driver activity summarize ਕਰਦੀਆਂ ਹਨ। Settings company configuration, notifications ਅਤੇ backup guidance ਦਿਖਾਉਂਦੀਆਂ ਹਨ।', ['Reports ਖੋਲ੍ਹ ਕੇ summary ਦੇਖੋ।', 'Settings ਵਿੱਚ setup status confirm ਕਰੋ।', 'App issue ਲਈ Bug Reports ਵਰਤੋ।'], '10-reports-settings.jpg']
];

function renderGuide({ lang, title, subtitle, sections }) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${title}</title>${guideCss()}</head><body>
    <header><p>Dispatcher365</p><h1>${title}</h1><p>${subtitle}</p><div class="toc">${sections.map(([id, heading]) => `<a href="#${id}">${heading}</a>`).join('')}</div></header>
    <nav>${sections.map(([id, heading]) => `<a href="#${id}">${heading}</a>`).join('')}</nav>
    <main>${sections.map(([id, heading, intro, steps, image]) => `<section class="section" id="${id}"><h2>${heading}</h2><p class="meta">${intro}</p><ol class="steps">${steps.map(step => `<li>${step}</li>`).join('')}</ol><div class="shot"><img src="screenshots/${image}" alt="${heading}" /></div></section>`).join('')}
    <section class="section"><h2>${lang === 'pa' ? 'ਮਹੱਤਵਪੂਰਨ ਨੋਟ' : 'Important Notes'}</h2><p class="note">${lang === 'pa' ? 'ਹਰ ਕੰਪਨੀ ਦੀ ਜਾਣਕਾਰੀ company-scoped ਹੈ। Billing payment issue ਹੋਣ ਤੇ portal access block ਹੋ ਸਕਦਾ ਹੈ। Super admin approval ਅਤੇ active billing ਦੋਵੇਂ ਲੋੜੀਂਦੇ ਹਨ।' : 'Each company keeps its own company-scoped data. If billing has a payment issue, portal access can be blocked. Super admin approval and active billing are both required.'}</p></section></main>
    <footer>Dispatcher365 &copy; ${new Date().getFullYear()}</footer></body></html>`;
}

async function main() {
  ensureDirs();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  try {
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
    await screenshot(page, '01-home.jpg');
    await page.goto(`${baseURL}/signup`, { waitUntil: 'networkidle' });
    await screenshot(page, '02-signup.jpg');
    await page.goto(`${baseURL}/track/DEMO0001-2026-000777`, { waitUntil: 'networkidle' });
    await screenshot(page, '03-tracking.jpg');

    await login(page, adminEmail, adminPassword);
    const guideData = await setupGuideData(page);
    await page.getByText(/Admin Home|Platform Home|Dispatch Home/i).first().waitFor({ timeout: 15000 });
    await screenshot(page, '04-admin-home.jpg');
    await page.getByRole('button', { name: /Company Setup|Companies/i }).first().click();
    await page.getByText(/Companies/i).first().waitFor({ timeout: 10000 });
    await screenshot(page, '05-companies.jpg');
    await browserJson(page, 'POST', '/api/auth/logout').catch(() => null);
    await login(page, guideData.admin.email, 'StrongPass123!');
    await page.getByRole('button', { name: 'Dispatch / Loads', exact: true }).click();
    await page.getByRole('heading', { name: 'Dispatch Board' }).waitFor({ timeout: 10000 });
    await screenshot(page, '06-dispatch-loads.jpg');
    await page.getByRole('button', { name: /Customer Tracking/i }).click();
    await page.getByText(/Customer Tracking/i).first().waitFor({ timeout: 10000 });
    await screenshot(page, '09-customer-tracking.jpg');
    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await page.getByText(/Operational Reports/i).waitFor({ timeout: 10000 });
    await screenshot(page, '10-reports-settings.jpg');

    await mobile.goto(`${baseURL}/portal`, { waitUntil: 'networkidle' });
    await mobile.getByLabel('Email').fill(guideData.driverUser.email);
    await mobile.getByLabel('Password').fill(guideData.driverUser.password);
    await mobile.getByRole('button', { name: /sign in/i }).click();
    await mobile.getByRole('heading', { name: 'Pre-trip Inspection' }).waitFor({ timeout: 10000 });
    await screenshot(mobile, '07-driver-checkin.jpg');
    await mobile.getByRole('button', { name: /Assigned Work/i }).click();
    await mobile.getByText(guideData.load.loadNumber).waitFor({ timeout: 10000 });
    await screenshot(mobile, '08-driver-work.jpg');
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(outDir, 'user-guide.html'), renderGuide({
    lang: 'en',
    title: 'Dispatcher365 User Guide',
    subtitle: 'Step-by-step guide for company signup, dispatch, driver mobile work, customer tracking, billing, and reports.',
    sections: sectionsEn
  }));
  fs.writeFileSync(path.join(outDir, 'user-guide-pa.html'), renderGuide({
    lang: 'pa',
    title: 'Dispatcher365 ਵਰਤੋਂ ਗਾਈਡ',
    subtitle: 'ਕੰਪਨੀ ਸਾਈਨਅਪ, ਡਿਸਪੈਚ, ਡਰਾਈਵਰ ਮੋਬਾਈਲ ਕੰਮ, customer tracking, billing ਅਤੇ reports ਲਈ step-by-step guide.',
    sections: sectionsPa
  }));
  console.log(JSON.stringify({ ok: true, output: outDir, guides: ['user-guide.html', 'user-guide-pa.html'] }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
