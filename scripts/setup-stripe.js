const Stripe = require('stripe');

const secretKey = process.env.STRIPE_SECRET_KEY;
const publicUrl = String(process.env.PUBLIC_APP_URL || 'https://dispatcher365.co').replace(/\/$/, '');
const currency = String(process.env.STRIPE_CURRENCY || 'cad').toLowerCase();

if (!secretKey) {
  console.error('Missing STRIPE_SECRET_KEY. Set it before running npm run stripe:setup.');
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });

const planDefinitions = [
  { key: 'starter', name: 'Starter', baseAmount: 9900, driverAmount: 1000 },
  { key: 'operations', name: 'Operations', baseAmount: 14900, driverAmount: 1500 },
  { key: 'pro', name: 'Pro', baseAmount: 39900, driverAmount: 1800 }
];

async function findOrCreateProduct(plan) {
  const lookup = `dispatcher365_${plan.key}`;
  const existing = await stripe.products.search({ query: `metadata['lookup_key']:'${lookup}' AND active:'true'`, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stripe.products.create({
    name: `Dispatcher365 ${plan.name}`,
    description: `${plan.name} company workspace subscription`,
    metadata: { lookup_key: lookup, app: 'dispatcher365', plan: plan.key }
  });
}

async function findOrCreatePrice(product, lookupKey, amount, nickname) {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return stripe.prices.create({
    product: product.id,
    currency,
    unit_amount: amount,
    recurring: { interval: 'month' },
    lookup_key: lookupKey,
    nickname,
    metadata: { app: 'dispatcher365', lookup_key: lookupKey }
  });
}

async function ensureWebhook() {
  const url = `${publicUrl}/api/stripe/webhook`;
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find(endpoint => endpoint.url === url);
  const enabledEvents = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_failed',
    'invoice.payment_succeeded'
  ];
  if (existing) {
    const updated = await stripe.webhookEndpoints.update(existing.id, { enabled_events: enabledEvents });
    return { endpoint: updated, created: false };
  }
  const endpoint = await stripe.webhookEndpoints.create({ url, enabled_events: enabledEvents });
  return { endpoint, created: true };
}

async function main() {
  const env = {
    STRIPE_SECRET_KEY: secretKey.startsWith('sk_test_') ? 'sk_test_...' : 'sk_live_...',
    PUBLIC_APP_URL: publicUrl,
    STRIPE_CURRENCY: currency,
    STRIPE_TRIAL_DAYS: process.env.STRIPE_TRIAL_DAYS || '14'
  };

  const created = {};
  for (const plan of planDefinitions) {
    const product = await findOrCreateProduct(plan);
    const upper = plan.key.toUpperCase();
    const base = await findOrCreatePrice(product, `dispatcher365_${plan.key}_base_monthly`, plan.baseAmount, `${plan.name} base monthly`);
    const driver = await findOrCreatePrice(product, `dispatcher365_${plan.key}_driver_monthly`, plan.driverAmount, `${plan.name} active driver monthly`);
    env[`STRIPE_PRICE_${upper}_BASE`] = base.id;
    env[`STRIPE_PRICE_${upper}_DRIVER`] = driver.id;
    created[plan.key] = { product: product.id, basePrice: base.id, driverPrice: driver.id };
  }

  const webhook = await ensureWebhook();
  env.STRIPE_WEBHOOK_SECRET = webhook.created && webhook.endpoint.secret ? webhook.endpoint.secret : 'Use existing whsec_... from Stripe Dashboard';

  console.log(JSON.stringify({
    ok: true,
    mode: secretKey.startsWith('sk_live_') ? 'live' : 'test',
    currency,
    productsAndPrices: created,
    webhook: {
      id: webhook.endpoint.id,
      url: webhook.endpoint.url,
      created: webhook.created
    },
    railwayEnv: env
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
