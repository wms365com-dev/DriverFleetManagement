const { chromium } = require('@playwright/test');

const baseURL = process.env.QA_BASE_URL || process.env.PUBLIC_APP_URL || 'http://127.0.0.1:3120';

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  try {
    const config = await (await page.request.get(`${baseURL}/api/public/billing-config`)).json();
    expect(config.stripeConfigured, 'Stripe is not configured in this app environment.');
    for (const key of ['starter', 'operations', 'pro']) {
      expect(config.plans?.[key]?.configured, `${key} Stripe price IDs are missing.`);
    }

    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Start 14-Day Trial/i }).first().click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20000 });
    expect(/checkout\.stripe\.com/.test(page.url()), 'Did not redirect to Stripe Checkout.');
    await page.getByText(/Dispatcher365/i).first().waitFor({ timeout: 20000 });
    await page.getByText(/Trial/i).first().waitFor({ timeout: 20000 }).catch(() => null);
    console.log(JSON.stringify({ ok: true, checkoutUrl: page.url().split('#')[0] }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
