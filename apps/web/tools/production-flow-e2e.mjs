#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ensureDirectoryExists, parseArgs } from './material-reference-common.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_OUTPUT_DIR = path.resolve('docs/production-flow-e2e');

const nowIso = new Date().toISOString();
const orderNumber = `DKT-E2E-${Date.now()}`;
const customerCode = 'SOLI90001';
const product = {
  id: 'e2e-product-1',
  slug: 'e2e-santal-flow',
  name: 'E2E Santal Flow',
  category: 'Woody',
  priceNumber: 289000,
  size: '30 ml',
  notes: 'Sandalwood, citrus, musk',
  topNotes: ['Bergamot'],
  heartNotes: ['Sandalwood'],
  baseNotes: ['Musk'],
  mood: 'Checkout confidence',
  description: 'Production flow test product.',
  concentration: 'Eau de Parfum',
  stock: 12,
  variants: [
    { id: 'e2e-30', size: '30 ml', priceNumber: 289000, stock: 12 },
    { id: 'e2e-50', size: '50 ml', priceNumber: 389000, stock: 5 },
  ],
  tags: ['E2E'],
  intensity: 'Medium',
  featured: true,
  popularity: 100,
  visual: 'from-[#f5d78f] via-[#f8efe1] to-[#d7b98b]',
  source: 'custom',
};

const productRow = {
  id: product.id,
  slug: product.slug,
  name: product.name,
  category: product.category,
  price_number: product.priceNumber,
  size: product.size,
  notes: product.notes,
  top_notes: product.topNotes,
  heart_notes: product.heartNotes,
  base_notes: product.baseNotes,
  mood: product.mood,
  description: product.description,
  concentration: product.concentration,
  stock: product.stock,
  variants: product.variants,
  tags: product.tags,
  intensity: product.intensity,
  featured: product.featured,
  popularity: product.popularity,
  visual: product.visual,
  source: product.source,
  created_at: nowIso,
  updated_at: nowIso,
};

const adminOrderRow = {
  id: '11111111-1111-4111-8111-111111111111',
  order_number: orderNumber,
  status: 'paid',
  customer_name: 'E2E Customer',
  customer_code: customerCode,
  contact: '6281200000000',
  notes: 'Address: Jalan E2E 1\nArea: Jakarta Selatan\nShipping: JNE Reguler / ETA 2-3 hari / Rp 12000',
  items: [{
    productId: product.id,
    slug: `${product.slug}-e2e-30`,
    productSlug: product.slug,
    variantId: 'e2e-30',
    name: product.name,
    price: 'Rp 289.000',
    priceNumber: 289000,
    size: '30 ml',
    quantity: 1,
  }],
  quantity: 1,
  subtotal: 301000,
  checkout_draft: 'E2E checkout draft',
  payment_provider: 'doku',
  payment_status: 'paid',
  payment_reference: 'E2E-DOKU-REF',
  payment_url: 'https://pay-sandbox.doku.test/e2e',
  payment_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  payment_session_id: 'e2e-session',
  payment_response: {},
  inventory_deducted: true,
  inventory_events: [],
  shipment_status: 'packing',
  courier_name: '',
  tracking_number: '',
  tracking_url: '',
  packing_notes: '',
  created_at: nowIso,
  updated_at: nowIso,
};

const base64Url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const fakeJwt = [
  base64Url({ alg: 'HS256', typ: 'JWT' }),
  base64Url({
    sub: '99999999-9999-4999-8999-999999999999',
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    aal: 'aal2',
    email: 'admin-e2e@solivagant.test',
  }),
  Buffer.from('e2e-signature').toString('base64url'),
].join('.');

const authSession = {
  access_token: fakeJwt,
  refresh_token: 'e2e-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  user: {
    id: '99999999-9999-4999-8999-999999999999',
    email: 'admin-e2e@solivagant.test',
    user_metadata: { name: 'E2E Admin' },
  },
};

const expectVisibleText = async (page, text, label = text) => {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 12000 });
  return label;
};

const clickFirstText = async (page, text) => {
  await page.getByText(text, { exact: false }).first().click();
};

const fillByPlaceholder = async (page, placeholder, value) => {
  await page.getByPlaceholder(placeholder, { exact: false }).first().fill(value);
};

const setupApiMocks = async (page) => {
  await page.route('**/rest/v1/storefront_products**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([productRow]) });
  });
  await page.route('**/rest/v1/storefront_vouchers**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/rest/v1/storefront_orders**', async (route, request) => {
    const method = request.method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([adminOrderRow]) });
      return;
    }
    await route.fulfill({ status: method === 'POST' ? 201 : 204, contentType: 'application/json', body: method === 'POST' ? JSON.stringify([adminOrderRow]) : '' });
  });
  await page.route('**/rest/v1/storefront_order_audit_logs**', async (route, request) => {
    await route.fulfill({
      status: request.method() === 'GET' ? 200 : 201,
      contentType: 'application/json',
      body: request.method() === 'GET' ? JSON.stringify([]) : JSON.stringify({}),
    });
  });
  await page.route('**/auth/v1/user**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(authSession.user),
    });
  });
  await page.route('**/auth/v1/factors**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totp: [] }) });
  });
  await page.route('**/rest/v1/rpc/storefront_upsert_customer**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: '22222222-2222-4222-8222-222222222222',
        customer_code: customerCode,
        customer_name: 'E2E Customer',
        contact: '6281200000000',
        delivery_address: 'Jalan E2E 1',
        delivery_area: 'Jakarta Selatan',
        order_count: 1,
      }]),
    });
  });
  await page.route('**/rest/v1/rpc/storefront_customer_portal**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        customer: {
          customer_code: customerCode,
          customer_name: 'E2E Customer',
          contact: '6281200000000',
          delivery_address: 'Jalan E2E 1',
          delivery_area: 'Jakarta Selatan',
          requires_security: false,
        },
        orders: [adminOrderRow],
      }]),
    });
  });
  await page.route('**/rest/v1/rpc/storefront_deduct_inventory_for_order**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route('**/api/shipping/destinations?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        destinations: [{
          id: 'e2e-destination',
          label: 'Jakarta Selatan, DKI Jakarta, 12110',
          cityName: 'Jakarta Selatan',
        }],
      }),
    });
  });
  await page.route('**/api/shipping/rates', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rates: [{
          courierCode: 'jne',
          courierName: 'JNE',
          service: 'REG',
          serviceLabel: 'Reguler',
          etd: '2-3 hari',
          cost: 12000,
        }],
      }),
    });
  });
  await page.route('**/api/doku/checkout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        paymentUrl: 'https://pay-sandbox.doku.test/e2e',
        requestId: 'E2E-DOKU-REF',
        invoiceNumber: orderNumber,
        paymentSessionId: 'e2e-session',
        paymentExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        dokuResponse: { source: 'e2e' },
      }),
    });
  });
  await page.route('**/api/doku/status?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        orderNumber,
        orderStatus: 'paid',
        paymentStatus: 'paid',
        syncApplied: true,
      }),
    });
  });
};

const seedBrowserState = async (page) => {
  await page.addInitScript(({ authSessionValue, productValue, orderValue }) => {
    window.localStorage.setItem('solivagant.supabase.auth.v1', JSON.stringify(authSessionValue));
    window.localStorage.setItem('dekito.storefront.products.v1', JSON.stringify([productValue]));
    window.localStorage.setItem('dekito.storefront.orders.v1', JSON.stringify([{
      ...orderValue,
      id: orderValue.id,
      orderNumber: orderValue.order_number,
      customerName: orderValue.customer_name,
      customerCode: orderValue.customer_code,
      paymentProvider: orderValue.payment_provider,
      paymentStatus: orderValue.payment_status,
      paymentReference: orderValue.payment_reference,
      paymentUrl: orderValue.payment_url,
      paymentExpiresAt: orderValue.payment_expires_at,
      paymentSessionId: orderValue.payment_session_id,
      shipmentStatus: orderValue.shipment_status,
      courierName: orderValue.courier_name,
      trackingNumber: orderValue.tracking_number,
      trackingUrl: orderValue.tracking_url,
      packingNotes: orderValue.packing_notes,
      createdAt: orderValue.created_at,
      updatedAt: orderValue.updated_at,
    }]));
  }, { authSessionValue: authSession, productValue: product, orderValue: adminOrderRow });
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args.get('base-url') || DEFAULT_BASE_URL).replace(/\/$/, '');
  const outputDir = path.resolve(String(args.get('out-dir') || DEFAULT_OUTPUT_DIR));
  ensureDirectoryExists(outputDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const consoleIssues = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push({ type: message.type(), text: message.text(), location: message.location() });
    }
  });

  await setupApiMocks(page);
  await seedBrowserState(page);

  const checkpoints = [];

  await page.goto(`${baseUrl}/products/${product.slug}`, { waitUntil: 'networkidle' });
  checkpoints.push(await expectVisibleText(page, product.name, 'product detail'));
  await clickFirstText(page, 'Masukkan keranjang');
  await clickFirstText(page, 'Lihat keranjang');
  checkpoints.push(await expectVisibleText(page, 'Checkout', 'cart checkout'));

  await fillByPlaceholder(page, 'Nama customer', 'E2E Customer');
  await fillByPlaceholder(page, 'Contoh: 081234567890', '6281200000000');
  await fillByPlaceholder(page, 'Nama jalan', 'Jalan E2E 1, Jakarta Selatan');
  await page.locator('select').first().selectOption('jne');
  await expectVisibleText(page, 'Ongkir paling hemat dipilih', 'shipping auto selected');
  await clickFirstText(page, 'DOKU Checkout');
  await clickFirstText(page, 'Bayar sekarang');
  checkpoints.push(await expectVisibleText(page, 'Pembayaran Solivagant', 'payment page'));
  checkpoints.push(await expectVisibleText(page, customerCode, 'payment customer code'));

  await page.goto(`${baseUrl}/customer?code=${customerCode}`, { waitUntil: 'networkidle' });
  checkpoints.push(await expectVisibleText(page, 'Cek order', 'customer portal'));
  checkpoints.push(await expectVisibleText(page, orderNumber, 'customer order visible'));

  await page.goto(`${baseUrl}/studio/shipments`, { waitUntil: 'networkidle' });
  checkpoints.push(await expectVisibleText(page, 'Pengiriman', 'shipments page'));
  if (await page.locator('article select').count() === 0) {
    fs.writeFileSync(path.join(outputDir, 'shipments-empty.txt'), await page.locator('body').innerText(), 'utf8');
    await page.screenshot({ path: path.join(outputDir, 'shipments-empty.png'), fullPage: true });
  }
  await fillByPlaceholder(page, 'Nomor resi', 'E2E-RESI-001');
  await page.locator('select').last().selectOption('shipped');
  await page.getByRole('checkbox').last().click();
  await fillByPlaceholder(page, 'Kurir massal', 'JNE');
  checkpoints.push(await expectVisibleText(page, 'Siap cetak', 'batch shipment controls'));

  await page.screenshot({ path: path.join(outputDir, 'production-flow.png'), fullPage: true });
  await browser.close();

  const summary = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    checkpoints,
    console_issues: consoleIssues,
  };
  fs.writeFileSync(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
