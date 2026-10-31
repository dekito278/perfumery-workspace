#!/usr/bin/env node
// Storefront smoke test: every buyer flow of the shop, in both shops, on a desktop and on an emulated
// phone, against a built dist served locally (any static server with an SPA fallback).
//
//   npm run build && <serve dist with SPA fallback on :8740> && node tools/storefront-smoke.mjs http://127.0.0.1:8740
//
// SAFETY — it never writes to production. Supabase READS (the catalogue, prices, zones) go through to the
// live project as an anonymous visitor would. Every WRITE is either answered by a mock below or aborted
// and reported as a failure: table inserts and updates, every RPC not known to be read-only, every
// /api/* call. The order is "placed" against a mocked /api/orders/create; nothing reaches the orders
// table, no stock is reserved, no message is sent. A fresh browser context, so no real session is used.
import { chromium, devices } from 'playwright';
import { MESSAGES } from '../src/i18n/messages.js';

const BASE = (process.argv[2] || 'http://127.0.0.1:8740').replace(/\/$/, '');
const SHOTS = process.argv[3] || '';
const ID = MESSAGES.id;
const EN = MESSAGES.en;
const fill = (text, values) => Object.entries(values).reduce((out, [key, value]) => out.replace(`{${key}}`, value), text);

const CUSTOMER_CODE = 'SOLI90001';
const VOUCHER = { code: 'SMOKE10', discount_type: 'percent', discount_value: 10, active: true };

// RPCs that only read. Everything else under /rest/v1/rpc/ is mocked or refused.
const READ_RPC = new Set(['storefront_member_prices', 'storefront_prices_for_me', 'storefront_my_price_tier', 'is_admin',
  'storefront_public_tracking_lookup']);

const makeOrder = (body) => {
  const items = Array.isArray(body.items) ? body.items : [];
  const goods = items.reduce((sum, item) => sum + Number(item.priceNumber || 0) * Number(item.quantity || 0), 0);
  const discount = body.voucherCode === VOUCHER.code ? Math.round(goods * 0.1) : 0;
  const now = new Date().toISOString();
  return {
    id: '33333333-3333-4333-8333-333333333333',
    order_number: `DKT-SMOKE-${Date.now()}`,
    status: 'pending_payment',
    customer_name: body.customer?.name || '',
    customer_code: body.customer?.code || CUSTOMER_CODE,
    contact: body.customer?.contact || '',
    items,
    quantity: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    subtotal: goods - discount + 12000,
    payment_provider: body.paymentProvider || 'manual',
    payment_status: 'pending',
    shipment_status: 'pending',
    notes: `Address: ${body.delivery?.address || ''}`,
    created_at: now,
    updated_at: now,
  };
};

const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const guard = async (context, state) => {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const reading = ['GET', 'HEAD', 'OPTIONS'].includes(method);

    if (url.hostname.endsWith('supabase.co')) {
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const name = url.pathname.split('/').pop();
        if (name === 'storefront_voucher_lookup') {
          const code = String(JSON.parse(request.postData() || '{}').p_code || '');
          return json(route, code === VOUCHER.code ? [VOUCHER] : []);
        }
        if (name === 'storefront_voucher_redeemed_by_me') return json(route, 0);
        if (name === 'storefront_payment_session_lookup') return json(route, state.order || null);
        if (name === 'storefront_customer_portal') {
          return json(route, [{ customer: { customer_code: CUSTOMER_CODE, customer_name: 'Smoke Buyer', contact: '6281200000000',
            delivery_address: 'Jalan Smoke 1', delivery_area: 'Jakarta Selatan', requires_security: false },
          orders: state.order ? [state.order] : [] }]);
        }
        if (name === 'storefront_customer_checkout_lookup' || name === 'storefront_lookup_customer') return json(route, []);
        if (READ_RPC.has(name)) return route.continue();
        state.blocked.push(`rpc ${name}`);
        return route.abort('blockedbyclient');
      }
      // Listing a storage bucket is a read that the storage API happens to take as a POST.
      if (reading || (method === 'POST' && url.pathname.startsWith('/storage/v1/object/list/'))) return route.continue();
      state.blocked.push(`${method} ${url.pathname}`);
      return route.abort('blockedbyclient');
    }

    if (url.origin === BASE && url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/shipping/destinations') {
        return json(route, { destinations: [{ id: 'smoke-dest', label: 'Kebayoran Baru, Jakarta Selatan, DKI Jakarta, 12110', cityName: 'Jakarta Selatan' }] });
      }
      if (url.pathname === '/api/shipping/rates') {
        // Answer for the courier asked about: the checkout lists only the chosen courier's services.
        const asked = JSON.parse(request.postData() || '{}').couriers;
        const courierCode = String(Array.isArray(asked) ? asked[0] : asked || 'jne').split(/[,:]/)[0] || 'jne';
        return json(route, { rates: [{ courierCode, courierName: courierCode.toUpperCase(), service: 'REG', serviceLabel: 'Reguler', etd: '2-3 hari', cost: 12000 }] });
      }
      if (url.pathname === '/api/orders/create') {
        const body = JSON.parse(request.postData() || '{}');
        state.orderBodies.push(body);
        state.order = makeOrder(body);
        return json(route, { order: state.order });
      }
      if (url.pathname.startsWith('/api/doku/')) return json(route, { paymentStatus: 'pending', orderStatus: 'pending_payment' });
      state.blocked.push(`unmocked ${method} ${url.pathname}`);
      return json(route, { message: 'smoke: not mocked' }, 404);
    }

    if (/(^|\.)wa\.me$|whatsapp\.com$|doku\.com$/.test(url.hostname)) {
      state.blocked.push(`external ${url.hostname}`);
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
};

const results = [];
const check = (run, name, ok, detail = '') => {
  results.push({ run, name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${run}] ${name}${detail ? ` — ${detail}` : ''}`);
};

const settle = async (page) => {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
};
const goto = async (page, path) => {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await settle(page);
};
const pathOf = (page) => new URL(page.url()).pathname.replace(/\/$/, '') || '/';
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth <= 1);

// The first product on the catalogue that can be bought right now.
const openBuyableProduct = async (page, run, prefix, label) => {
  await goto(page, `${prefix}/catalog`);
  const hrefs = await page.$$eval('a[href*="/catalog/"]', (links) => [...new Set(links.map((a) => a.getAttribute('href')))]);
  for (const href of hrefs.slice(0, 12)) {
    await goto(page, href.replace(/^\/en/, prefix.startsWith('/en') ? '/en' : ''));
    const add = page.getByRole('button', { name: new RegExp(`^${label}`) }).first();
    if (await add.isVisible().catch(() => false) && await add.isEnabled().catch(() => false)) {
      const name = (await page.locator('h1').first().innerText()).split('\n')[0].trim();
      return { add, name, href };
    }
  }
  check(run, 'a buyable product exists', false, `none of ${hrefs.length} catalogue links had an enabled add button`);
  return null;
};

const addToCart = async (page, run, prefix, M) => {
  const found = await openBuyableProduct(page, run, prefix, M['pdp.addToCart']);
  if (!found) return null;
  await found.add.click();
  const toast = page.locator('[data-sonner-toast]').first();
  await toast.waitFor({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(600); // let it finish sliding in before measuring where it sits
  const box = await toast.boundingBox().catch(() => null);
  check(run, 'add to cart is announced, at the top', box && box.y < 200, box ? `toast at y=${Math.round(box.y)}` : 'no toast');
  const prompt = page.locator('.free-vial-prompt');
  if (await prompt.isVisible({ timeout: 3000 }).catch(() => false)) {
    const sheet = await page.locator('.free-vial-prompt__sheet').boundingBox();
    check(run, 'gift prompt and toast do not overlap', !box || !sheet || box.y + box.height <= sheet.y,
      `toast ends ${box ? Math.round(box.y + box.height) : '-'}, sheet starts ${Math.round(sheet.y)}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${run}-gift.png` });
    await page.locator('.free-vial-prompt .ng-chip').first().click();
    await page.waitForTimeout(400);
    check(run, 'picking a gift closes the prompt', !(await prompt.isVisible().catch(() => false)));
  } else {
    check(run, 'gift prompt (skipped: no vial product or gift already chosen)', true);
  }
  return found;
};

const runShop = async (browser, run, contextOptions) => {
  const state = { blocked: [], orderBodies: [], order: null };
  const context = await browser.newContext({ ...contextOptions, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  await guard(context, state);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.message || error)));

  // --- Home ---
  await goto(page, '/home');
  check(run, 'home renders its headline', await page.locator('h1').first().isVisible());
  check(run, 'home has no horizontal scroll', await noSideScroll(page));
  check(run, 'home stays on /home (no phone redirect)', pathOf(page) === '/home', pathOf(page));

  // --- Catalogue filter ---
  await goto(page, '/catalog');
  const filters = page.locator('.ng-filter');
  const filterCount = await filters.count();
  check(run, 'catalogue offers filters', filterCount >= 2, `${filterCount} filters`);
  if (filterCount >= 2) {
    const target = filters.nth(1);
    await target.click();
    await page.waitForTimeout(400);
    check(run, 'a chosen filter announces itself (aria-pressed)', (await target.getAttribute('aria-pressed')) === 'true');
  }
  check(run, 'catalogue has no horizontal scroll', await noSideScroll(page));

  // --- Product → cart ---
  const product = await addToCart(page, run, '', ID);
  if (!product) return { state, errors };
  check(run, 'product page has no horizontal scroll', await noSideScroll(page));

  await goto(page, '/cart');
  const increase = page.getByRole('button', { name: fill(ID['cart.increaseOf'], { name: product.name }) }).first();
  const lineFound = await increase.isVisible().catch(() => false);
  check(run, 'the bottle is in the cart', lineFound, product.name);
  if (lineFound) {
    await increase.click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: fill(ID['cart.decreaseOf'], { name: product.name }) }).first().click();
    await page.waitForTimeout(300);
  }
  // Voucher: a wrong code is refused out loud, the right one is applied.
  const voucherInput = page.getByRole('textbox', { name: ID['cart.voucherPlaceholder'] }).first();
  await voucherInput.fill('SALAH1');
  await page.getByRole('button', { name: ID['cart.voucherApply'], exact: true }).first().click();
  await page.waitForTimeout(800);
  check(run, 'a wrong voucher is refused with a message', await page.locator('.ng-error:visible, .ng-notice--error:visible').first().isVisible().catch(() => false));
  await voucherInput.fill(VOUCHER.code);
  await page.getByRole('button', { name: ID['cart.voucherApply'], exact: true }).first().click();
  await page.getByText(fill(ID['cart.voucherApplied'], { code: VOUCHER.code })).first().waitFor({ timeout: 6000 }).catch(() => {});
  check(run, 'the voucher is applied', await page.getByText(fill(ID['cart.voucherApplied'], { code: VOUCHER.code })).first().isVisible().catch(() => false));
  check(run, 'cart has no horizontal scroll', await noSideScroll(page));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${run}-cart.png`, fullPage: true });

  // --- Checkout (mocked order) ---
  const toCheckout = page.getByRole('link', { name: new RegExp(`^(${ID['cart.toCheckout']}|${ID['cart.payNext']})`) });
  await toCheckout.locator('visible=true').first().click();
  await settle(page);
  check(run, 'cart leads to the checkout', pathOf(page) === '/checkout', pathOf(page));
  await page.getByRole('textbox', { name: ID['checkout.namePlaceholder'] }).fill('Smoke Buyer');
  await page.getByRole('textbox', { name: ID['checkout.whatsappAria'] }).fill('081200000000');
  await page.locator('#checkout-address').fill('Jalan Smoke No. 1, Kebayoran Baru');
  const courier = page.getByRole('combobox', { name: ID['checkout.pickCourier'] });
  const courierValue = await courier.locator('option').nth(1).getAttribute('value');
  await courier.selectOption(courierValue);
  await page.waitForTimeout(600);
  const area = page.getByRole('textbox', { name: ID['checkout.destinationAria'] });
  if (!(await area.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: ID['mcheckout.editManualShipping'] }).click().catch(() => {});
  }
  await area.fill('Kebayoran Baru');
  await page.getByRole('button', { name: ID['checkout.search'] }).first().click();
  const rate = page.locator('button.ng-choice', { hasText: 'REG' }).first();
  await rate.waitFor({ timeout: 8000 }).catch(() => {});
  check(run, 'shipping rates appear for the area', await rate.isVisible().catch(() => false));
  if (await rate.isVisible().catch(() => false)) await rate.click();
  const manual = page.getByRole('group', { name: ID['checkout.paymentMethod'] }).locator('button.ng-choice').first();
  await manual.click();
  check(run, 'a payment method can be chosen', (await manual.getAttribute('aria-pressed')) === 'true');
  check(run, 'checkout has no horizontal scroll', await noSideScroll(page));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${run}-checkout.png`, fullPage: true });
  await page.getByRole('button', { name: ID['checkout.placeOrder'] }).locator('visible=true').first().click();
  await page.waitForURL(/\/payment\?/, { timeout: 15000 }).catch(() => {});
  await settle(page);
  check(run, 'placing the order lands on the payment page', pathOf(page) === '/payment', page.url().replace(BASE, ''));
  const body = state.orderBodies[0];
  check(run, 'the order carried the bottle, the voucher and the courier',
    body && body.items?.some((item) => item.name === product.name) && body.voucherCode === VOUCHER.code && body.shipping?.courier,
    body ? `${body.items?.length} item(s), voucher ${body.voucherCode || '-'}, courier ${body.shipping?.courier || '-'}` : 'no order posted');
  check(run, 'the payment page names the order', state.order && await page.getByText(state.order.order_number).first().isVisible({ timeout: 8000 }).catch(() => false));
  check(run, 'payment page has no horizontal scroll', await noSideScroll(page));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${run}-payment.png`, fullPage: true });

  // --- Account portal, tracking, journal, bespoke ---
  await goto(page, `/customer?code=${CUSTOMER_CODE}`);
  check(run, 'the account shows the order', state.order && await page.getByText(state.order.order_number).first().isVisible({ timeout: 8000 }).catch(() => false));
  await goto(page, '/track');
  check(run, 'tracking page renders', await page.locator('h1').first().isVisible());
  await goto(page, '/journal');
  const article = page.locator('a[href^="/articles/"]').first();
  check(run, 'journal lists articles', await article.isVisible().catch(() => false));
  if (await article.isVisible().catch(() => false)) {
    await article.click();
    await settle(page);
    check(run, 'an article opens', pathOf(page).startsWith('/articles/') && await page.locator('h1').first().isVisible());
  }
  await goto(page, '/bespoke');
  check(run, 'bespoke page renders its form', await page.locator('form, fieldset').first().isVisible().catch(() => false));
  check(run, 'bespoke has no horizontal scroll', await noSideScroll(page));
  await goto(page, '/mobile/catalog');
  check(run, 'an old phone address lands on its page', pathOf(page) === '/catalog', pathOf(page));

  // --- English shop ---
  await goto(page, '/en/home');
  check(run, 'English home renders', await page.locator('h1').first().isVisible());
  const enProduct = await addToCart(page, `${run}/en`, '/en', EN);
  if (enProduct) {
    await goto(page, '/en/cart');
    const country = page.getByLabel(EN['intlQuote.countryLabel']);
    check(run, 'English cart asks for a destination', await country.isVisible().catch(() => false));
    if (await country.isVisible().catch(() => false)) {
      const option = await country.locator('option').nth(1).getAttribute('value');
      await country.selectOption(option);
      await page.waitForTimeout(800);
      const order = page.getByRole('link', { name: EN['cart.intl.order'] });
      check(run, 'with a destination, the WhatsApp order is offered', await order.isVisible().catch(() => false));
      const href = await order.getAttribute('href').catch(() => '');
      check(run, 'and it goes to WhatsApp (not clicked)', /^https:\/\/wa\.me\//.test(href || ''), href ? href.slice(0, 40) : 'no href');
    }
    check(run, 'English cart has no horizontal scroll', await noSideScroll(page));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${run}-en-cart.png`, fullPage: true });
  }

  check(run, 'no write left the browser', state.blocked.length === 0, state.blocked.join(', '));
  check(run, 'no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
  return { state, errors };
};

const browser = await chromium.launch();
try {
  await runShop(browser, 'desktop', { viewport: { width: 1440, height: 900 } });
  await runShop(browser, 'phone', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
} finally {
  await browser.close();
}
const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
