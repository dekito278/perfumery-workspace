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
  'storefront_public_tracking_lookup', 'storefront_payment_link']);

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
// Visible shop text drawn in Studio's DM Sans: an element rendered outside the shop's <main> (a fixed bar,
// a prompt) that never got the shop's font — and the 61 KB font file fetched for it.
const studioFontText = (page) => page.evaluate(() => [...document.querySelectorAll('body *')]
  .filter((el) => el.getClientRects().length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    && /^"?DM Sans/.test(getComputedStyle(el).fontFamily))
  .map((el) => el.textContent.trim().slice(0, 30)));

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
  // The gift prompt is open now, and scrolling to the end brings the product page's sticky buy bar in.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  const studioFont = await studioFontText(page);
  check(run, 'product page, buy bar and gift prompt use the shop font', !studioFont.length, studioFont.slice(0, 3).join(' | '));
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
  // Layout shift, summed per page load, so the catalogue can be held to not jumping as its data lands.
  await context.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.message || error)));

  // --- Home ---
  await goto(page, '/home');
  check(run, 'home renders its headline', await page.locator('h1').first().isVisible());
  check(run, 'home has no horizontal scroll', await noSideScroll(page));
  check(run, 'home stays on /home (no phone redirect)', pathOf(page) === '/home', pathOf(page));
  check(run, 'an Indonesian browser is not offered the English shop', !(await page.locator('.ng-abroad-hint').count()));

  // --- Catalogue filter ---
  await goto(page, '/catalog');
  const filters = page.locator('.ng-filter');
  const filterCount = await filters.count();
  const cls = await page.evaluate(() => window.__cls);
  check(run, 'catalogue does not jump as it loads (CLS < 0.1)', cls < 0.1, `CLS ${cls.toFixed(3)}`);
  if (run === 'phone') {
    // Title, filters and the list share one phone screen; the first perfume has to be whole on it.
    const firstRowEnd = await page.evaluate(() => document.querySelector('.ng-cat-row:not(.ng-cat-row--head)')?.getBoundingClientRect().bottom ?? Infinity);
    check(run, 'the first perfume is on the first screen', firstRowEnd <= page.viewportSize().height, `ends at y=${Math.round(firstRowEnd)}`);
  }
  check(run, 'catalogue offers filters', filterCount >= 2, `${filterCount} filters`);
  const facet = page.locator('button[aria-expanded]', { hasText: ID['wear.times'] }).first();
  if (await facet.count()) {
    await facet.click();
    const option = page.locator(`[id="${await facet.getAttribute('aria-controls')}"] .ng-filter`).first();
    check(run, 'a wear facet opens its options', (await facet.getAttribute('aria-expanded')) === 'true' && await option.isVisible());
    await facet.click();
  }
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

// A buyer who opens several perfumes from the catalogue in new tabs, and one whose catalogue answer is slow.
// Every tab hears every other tab's localStorage writes; a catalogue hook that refetched on any of them sent
// 5 of 6 such tabs to "page not found" on the live shop (2026-11-02), and a request past the 4,2 s timeout did
// the same on its own.
const runTabs = async (browser) => {
  const run = 'tabs';
  const state = { blocked: [], orderBodies: [], order: null };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  await guard(context, state);
  let slowCatalogue = false;
  await context.route('**/rest/v1/storefront_products_public*', async (route) => {
    if (slowCatalogue) await new Promise((done) => setTimeout(done, 6000));
    return route.fallback();
  });
  const errors = [];
  context.on('weberror', (error) => errors.push(String(error.error().message || error.error())));

  const first = await context.newPage();
  await goto(first, '/catalog');
  const hrefs = (await first.$$eval('a[href^="/catalog/"]', (links) => [...new Set(links.map((a) => a.getAttribute('href')))])).slice(0, 6);
  await first.close();

  let downloads = 0;
  const count = (request) => { if (request.url().includes('storefront_products_public')) downloads += 1; };
  context.on('request', count);
  const tabs = await Promise.all(hrefs.map(() => context.newPage()));
  await Promise.all(tabs.map((tab, i) => tab.goto(`${BASE}${hrefs[i]}`, { waitUntil: 'domcontentloaded' })));
  await Promise.all(tabs.map(settle));
  context.off('request', count);
  const lost = tabs.map((tab, i) => [hrefs[i], pathOf(tab)]).filter(([href, at]) => at !== href);
  check(run, 'perfumes opened in new tabs together all stay on their page', hrefs.length >= 2 && !lost.length,
    lost.map(([href, at]) => `${href} → ${at}`).join(', ') || `${hrefs.length} tabs`);
  check(run, 'and download the catalogue about once each', downloads <= hrefs.length * 2, `${downloads} downloads for ${hrefs.length} tabs`);
  await Promise.all(tabs.map((tab) => tab.close()));

  slowCatalogue = true;
  const page = await context.newPage();
  await page.goto(`${BASE}${hrefs[0]}`, { waitUntil: 'domcontentloaded' });
  const retry = page.getByRole('button', { name: ID['stale.retry'], exact: true });
  await retry.waitFor({ timeout: 9000 }).catch(() => {});
  check(run, 'a catalogue that times out says so, not "page not found"', pathOf(page) === hrefs[0] && await page.getByText(ID['pdp.loadFailed']).isVisible().catch(() => false), pathOf(page));
  slowCatalogue = false;
  if (await retry.isVisible().catch(() => false)) {
    await retry.click();
    await settle(page);
    check(run, 'and "try again" brings the perfume back', pathOf(page) === hrefs[0] && await page.getByRole('button', { name: new RegExp(`^${ID['pdp.addToCart']}`) }).first().isVisible().catch(() => false));
  }

  check(run, 'no write left the browser', state.blocked.length === 0, state.blocked.join(', '));
  check(run, 'no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
};

// What a page tells a crawler, read after React has run: one of each head tag, and the page's own address.
// Waits for react-helmet's own canonical first — read before it lands, the prerendered tags alone pass every
// check here without the handover having happened at all (a production run did exactly that, 2026-11-02).
const headOf = async (page) => {
  await page.waitForSelector('link[rel="canonical"][data-react-helmet]', { state: 'attached', timeout: 20000 }).catch(() => {});
  await page.waitForSelector('script[type="application/ld+json"][data-react-helmet]', { state: 'attached', timeout: 20000 }).catch(() => {});
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    canonicals: [...document.querySelectorAll('link[rel="canonical"]')].map((l) => new URL(l.href).pathname),
    descriptions: document.querySelectorAll('meta[name="description"]').length,
    products: [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => { try { return JSON.parse(s.textContent); } catch { return {}; } })
      .filter((j) => j['@type'] === 'Product')
      .map((j) => [].concat(j.offers || [])[0]?.priceCurrency || 'none'),
  }));
};

// A US-English browser — the one Google crawls with — on the Indonesian shop. Until 2026-11-02 the guess
// turned /catalog/l-iris English at US$95 for it, with two canonicals and two prices; the address decides now.
const runAbroad = async (browser) => {
  const run = 'abroad';
  const state = { blocked: [], orderBodies: [], order: null };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', timezoneId: 'America/Los_Angeles' });
  await guard(context, state);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.message || error)));

  await goto(page, '/catalog');
  const href = await page.$eval('a[href^="/catalog/"]', (a) => a.getAttribute('href')).catch(() => '');
  await goto(page, href);
  let head = await headOf(page);
  const price = await page.locator('main').innerText();
  // Not "no US$ anywhere": the Indonesian shop prints its own export line ("Harga untuk pengiriman ke luar negeri").
  const buyIndonesian = await page.getByRole('button', { name: new RegExp(`^${ID['pdp.addToCart']}`) }).first().isVisible().catch(() => false);
  check(run, 'an Indonesian address stays Indonesian (lang, Rp, Indonesian buy button)', head.lang === 'id' && /Rp\s?\d/.test(price) && buyIndonesian, `lang=${head.lang}`);
  check(run, 'with one canonical, its own address', head.canonicals.length === 1 && head.canonicals[0] === href, head.canonicals.join(', '));
  check(run, 'one description and one Product, priced in IDR', head.descriptions === 1 && head.products.join() === 'IDR', `${head.descriptions} descriptions, Product ${head.products.join('/')}`);

  const offer = page.getByRole('button', { name: EN['intl.switchToEn'], exact: true });
  check(run, 'the browser is offered the English shop, in English', await offer.isVisible().catch(() => false)
    && await page.getByText(EN['intl.fromAbroad']).isVisible().catch(() => false));
  if (await offer.isVisible().catch(() => false)) {
    await offer.click();
    await page.waitForURL(/\/en\/catalog\//, { timeout: 10000 }).catch(() => {});
    await settle(page);
    head = await headOf(page);
    check(run, 'which is the same perfume at its /en address', pathOf(page) === `/en${href}` && head.lang === 'en', pathOf(page));
    check(run, 'with one canonical there too', head.canonicals.length === 1 && head.canonicals[0] === `/en${href}`, head.canonicals.join(', '));
    check(run, 'and one Product block, priced in US$ — not the Rp one beside it', head.products.join() === 'USD', head.products.join('/'));
    check(run, 'no English-shop offer inside the English shop', !(await page.locator('.ng-abroad-hint').count()));
  }

  await goto(page, '/catalog?lang=en');
  await page.waitForURL(/\/en\/catalog/, { timeout: 20000 }).catch(() => {});
  check(run, 'an old ?lang=en link lands on the /en address', pathOf(page) === '/en/catalog', pathOf(page));

  check(run, 'no write left the browser', state.blocked.length === 0, state.blocked.join(', '));
  check(run, 'no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
};

// The server unreachable. Every page must say the connection failed — not that a perfume or an article does
// not exist, not that "a new collection is being prepared" (all three were on the live shop, 2026-11-02).
const runOutage = async (browser) => {
  const run = 'outage';
  const sitemap = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text()).catch(() => '');
  const article = (sitemap.match(/<loc>[^<]*?(\/articles\/[^<]+)<\/loc>/) || [])[1];
  const product = (sitemap.match(/<loc>[^<]*?(\/catalog\/[^<]+)<\/loc>/) || [])[1] || '/catalog/l-iris';
  const state = { blocked: [], orderBodies: [], order: null };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  await guard(context, state);
  await context.route(/supabase\.co\/(rest|storage)\//, (route) => route.abort('connectionrefused'));
  const page = await context.newPage();
  const h1 = () => page.locator('h1').first().innerText().catch(() => '');
  // supabase-js retries a failed read before giving up, so a page reaches its failure state seconds later.
  const shows = (text) => page.getByText(text, { exact: false }).first().waitFor({ timeout: 20000 }).then(() => true, () => false);
  const robots = () => page.locator('meta[name="robots"]').getAttribute('content').catch(() => null);

  await goto(page, '/home');
  const saidSo = await shows(ID['stale.emptyBody']);
  check(run, 'home says the catalogue did not load, and promises no new collection', saidSo && !(await page.getByText(ID['home.emptyCollection']).count()));
  await goto(page, product);
  await shows(ID['pdp.loadFailedTitle']);
  check(run, 'a product says it could not load, at its own address', pathOf(page) === product && (await h1()) === ID['pdp.loadFailedTitle'], `${pathOf(page)} "${await h1()}"`);
  if (article) {
    await goto(page, article);
    await shows(ID['journal.loadErrorTitle']);
    check(run, 'an article says it could not load, not that it is unpublished', (await h1()) === ID['journal.loadErrorTitle'], await h1());
    check(run, 'and does not tell Google to drop it', !/noindex/.test((await robots()) || ''), String(await robots()));
  }
  await goto(page, '/journal');
  await shows(ID['journal.loadFailed']);
  check(run, 'the journal offers to try again', await page.getByRole('button', { name: ID['stale.retry'], exact: true }).isVisible().catch(() => false));
  await context.unroute(/supabase\.co\/(rest|storage)\//);
  await goto(page, '/pay/00000000000000000000000000000000');
  check(run, 'a dead payment link has a heading that says so', (await h1()) === ID['pay.link.invalidTitle'], await h1());
  check(run, 'no write left the browser', state.blocked.length === 0, state.blocked.join(', '));
  await context.close();
};

// What a crawler without JavaScript reads must be what the page says once it runs: the two used to be
// built separately and drifted on every product and article (2026-11-02). Plus Google's display limits.
const runSeo = async (browser) => {
  const run = 'seo';
  const sitemap = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text()).catch(() => '');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const pick = (re) => locs.find((path) => re.test(path));
  const paths = ['/home', '/catalog', '/bespoke', '/about', '/journal', '/en/home', '/en/catalog', '/en/bespoke', '/en/about',
    pick(/^\/catalog\/./), pick(/^\/en\/catalog\/./), pick(/^\/articles\//)].filter(Boolean);
  const decode = (text) => String(text || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const drift = [];
  const long = [];
  const bodies = [];
  for (const path of paths) {
    const raw = await fetch(`${BASE}${path}`).then((r) => r.text());
    const rawTitle = decode((raw.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1]);
    const rawDescription = decode((raw.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/) || [])[1]);
    const context = await browser.newContext({ locale: 'en-US', timezoneId: 'America/Los_Angeles' });
    const state = { blocked: [], orderBodies: [], order: null };
    await guard(context, state);
    const page = await context.newPage();
    await goto(page, path);
    const live = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      h1: (document.querySelector('h1')?.innerText || '').replace(/\s+/g, ' ').trim(),
    }));
    // Without JavaScript: one h1, the page's own, and no price (Dekito, 2026-10-21: one file answers every
    // country). Product and article files used to carry only "JavaScript diperlukan".
    const body = raw.slice(raw.indexOf('<body')).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
    const rawH1 = [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
    if (rawH1.length !== 1 || rawH1[0] !== live.h1) bodies.push(`${path} ${JSON.stringify(rawH1)} vs "${live.h1}"`);
    if (/Rp\s?\d/.test(body.replace(/<[^>]+>/g, ' '))) bodies.push(`${path} prints a rupiah price`);
    await context.close();
    if (live.title !== rawTitle) drift.push(`${path} title "${rawTitle}" → "${live.title}"`);
    if (live.description !== rawDescription) drift.push(`${path} description`);
    if (live.title.length > 60) long.push(`${path} title ${live.title.length}`);
    // An article's description is its excerpt, written by Dekito; only the shop's own pages are held to a range.
    if (!path.includes('/articles/') && (live.description.length < 70 || live.description.length > 160)) long.push(`${path} description ${live.description.length}`);
  }
  check(run, `before and after JavaScript, ${paths.length} pages say the same title and description`, drift.length === 0, drift.join('; '));
  check(run, 'titles fit 60 characters, descriptions 70–160', long.length === 0, long.join('; '));
  check(run, 'without JavaScript each page has one h1, the one it shows, and no price', bodies.length === 0, bodies.join('; '));
};

const browser = await chromium.launch();
try {
  await runShop(browser, 'desktop', { viewport: { width: 1440, height: 900 } });
  await runShop(browser, 'phone', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  await runTabs(browser);
  await runAbroad(browser);
  await runOutage(browser);
  await runSeo(browser);
} finally {
  await browser.close();
}
const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
