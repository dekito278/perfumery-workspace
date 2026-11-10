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
const READ_RPC = new Set(['storefront_member_prices', 'storefront_prices_for_me', 'storefront_my_price_tier', 'storefront_my_member_status', 'is_admin',
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
          // As the server answers since 20261107100000: a code alone opens nothing; the checkout number does.
          const typed = String(JSON.parse(request.postData() || '{}').p_contact || '').replace(/\D/g, '').replace(/^0/, '62');
          if (typed !== '6281200000000') {
            return json(route, [{ customer: { customer_code: CUSTOMER_CODE, requires_security: false, requires_identity: true }, orders: [] }]);
          }
          return json(route, [{ customer: { customer_code: CUSTOMER_CODE, customer_name: 'S**** B****', order_count: 1,
            requires_security: false, masked: true },
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

// Every visible control at least 44px both ways (Dekito's rule), and every visible text at 4.5:1 (3:1 when
// large). A link inside running text is exempt from the size, as WCAG has it; a closed <details> and an
// off-screen skip link are not on screen. Footer links, the header nav and the gallery dots failed the
// first, the price notice and the account page's notes the second (2026-11-02).
const a11yFaults = (page) => page.evaluate(() => {
  const shown = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < document.documentElement.scrollHeight && cs.visibility !== 'hidden'
      && Number(cs.opacity) > 0.05 && !el.closest('[aria-hidden="true"],[inert],details:not([open]) > :not(summary),.sr-only'); };
  const rgb = (c) => (c.match(/[\d.]+/g) || [0, 0, 0, 0]).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const backdrop = (el) => { for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n);
    if (cs.backgroundImage !== 'none') return null; const c = rgb(cs.backgroundColor); if ((c[3] ?? 1) > 0.9) return c; } return null; };
  const faults = [];
  for (const el of document.querySelectorAll('a[href],button,select,input:not([type=hidden]),textarea,summary')) {
    if (!shown(el) || el.getBoundingClientRect().top < -100) continue;
    const r = el.getBoundingClientRect();
    const inText = el.matches('a') && el.parentElement && [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!inText && (r.width < 44 || r.height < 44)) faults.push(`${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 24)}"`);
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const bg = backdrop(el); if (!bg) continue;
    const cs = getComputedStyle(el); const fg = rgb(cs.color); const a = fg[3] ?? 1;
    const mixed = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
    const [hi, lo] = [lum(mixed), lum(bg)].sort((x, y) => y - x); const ratio = (hi + 0.05) / (lo + 0.05);
    const size = parseFloat(cs.fontSize); const need = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700) ? 3 : 4.5;
    if (ratio < need && !el.closest('[disabled],[aria-disabled="true"]')) faults.push(`contrast ${ratio.toFixed(2)} "${el.textContent.trim().slice(0, 24)}"`);
  }
  return [...new Set(faults)];
});

// Tab through a page: every stop shows a focus mark, and none is left under a fixed bar once the page has
// finished scrolling to it (the buy bar hid the product FAQ on a desktop, 2026-11-02).
const focusFaults = async (page, stops = 30) => {
  const faults = [];
  for (let i = 0; i < stops; i += 1) {
    await page.keyboard.press('Tab');
    // The shop scrolls smoothly, so a long jump back up is still travelling after half a second: wait until
    // the page has stopped moving, then look.
    await page.evaluate(() => new Promise((done) => {
      let last = -1; let still = 0; const started = performance.now();
      const tick = () => { const y = scrollY; still = y === last ? still + 1 : 0; last = y;
        if (still >= 6 || performance.now() - started > 3000) done(); else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }));
    await page.waitForTimeout(150);
    const fault = await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const name = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 24);
      const cs = getComputedStyle(el);
      if (!((cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'))) return `no focus mark on "${name}"`;
      const r = el.getBoundingClientRect(); if (!r.width) return null;
      const top = document.elementFromPoint(Math.min(innerWidth - 1, r.left + r.width / 2), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
      if (top && !el.contains(top) && !top.contains(el)) { const bar = top.closest('[class]'); return `"${name}" under ${bar ? bar.className.split(' ')[0] : top.tagName}`; }
      return null;
    });
    if (fault) faults.push(fault);
  }
  return [...new Set(faults)];
};

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
  // In the shop's colours: the toaster sits outside every page and arrived as a white card (2026-11-02).
  const toastLook = await toast.evaluate((el) => {
    const lum = (c) => (c.match(/[\d.]+/g) || [255, 255, 255]).slice(0, 3).map(Number)
      .map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const description = el.querySelector('[data-description]');
    return { card: lum(getComputedStyle(el).backgroundColor), note: description ? lum(getComputedStyle(description).color) : 1 };
  }).catch(() => ({ card: 1, note: 0 }));
  check(run, 'and the toast wears the shop: a dark card with readable words', toastLook.card < 0.05 && toastLook.note > 0.3, JSON.stringify(toastLook));
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
  { const faults = await a11yFaults(page); check(run, 'home: 44px targets and 4.5:1 text', faults.length === 0, faults.slice(0, 6).join('; ')); }
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
  // The first Tab on the catalogue is the way past the filters, and it is a 44px target when it shows.
  await goto(page, '/catalog');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400); // it slides in from above the viewport
  const skip = await page.evaluate(() => { const el = document.activeElement; const r = el.getBoundingClientRect();
    return { skip: el.classList.contains('skip-to-results'), shown: r.top >= 0 && r.bottom <= innerHeight, h: Math.round(r.height) }; });
  check(run, 'the first Tab on the catalogue is the skip link, shown and 44px', skip.skip && skip.shown && skip.h >= 44, JSON.stringify(skip));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  check(run, 'and it moves focus to the results', await page.evaluate(() => document.activeElement?.id === 'catalog-results'));
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
  { const faults = await a11yFaults(page); check(run, 'catalogue: 44px targets and 4.5:1 text', faults.length === 0, faults.slice(0, 6).join('; ')); }

  // --- Product → cart ---
  const product = await addToCart(page, run, '', ID);
  if (!product) return { state, errors };
  check(run, 'product page has no horizontal scroll', await noSideScroll(page));
  { const faults = await a11yFaults(page); check(run, 'product page: 44px targets and 4.5:1 text', faults.length === 0, faults.slice(0, 6).join('; ')); }
  await goto(page, product.href);
  { const faults = await focusFaults(page); check(run, 'product page: every Tab stop is marked and in view', faults.length === 0, faults.slice(0, 4).join('; ')); }

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
  // When it does not, say what the checkout itself said: one production run stayed on /checkout with no order
  // posted and nothing to go on (2026-11-02).
  const said = pathOf(page) === '/payment' ? '' : await page.locator('[data-sonner-toast], [role="alert"], [aria-invalid="true"]').allInnerTexts().then((texts) => texts.join(' / ').slice(0, 200)).catch(() => '');
  check(run, 'placing the order lands on the payment page', pathOf(page) === '/payment', `${page.url().replace(BASE, '')}${said ? ` — ${said}` : ''}`);
  const body = state.orderBodies[0];
  check(run, 'the order carried the bottle, the voucher and the courier',
    body && body.items?.some((item) => item.name === product.name) && body.voucherCode === VOUCHER.code && body.shipping?.courier,
    body ? `${body.items?.length} item(s), voucher ${body.voucherCode || '-'}, courier ${body.shipping?.courier || '-'}` : 'no order posted');
  check(run, 'the payment page names the order', state.order && await page.getByText(state.order.order_number).first().isVisible({ timeout: 8000 }).catch(() => false));
  check(run, 'payment page has no horizontal scroll', await noSideScroll(page));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${run}-payment.png`, fullPage: true });

  // --- Account portal, tracking, journal, bespoke ---
  await goto(page, `/customer?code=${CUSTOMER_CODE}`);
  // The code alone must not show the order; the number typed at checkout must (2026-11-07).
  const numberBox = page.getByRole('textbox', { name: ID['cust.identityLabel'] });
  check(run, 'the account asks for the checkout number before showing any order',
    await numberBox.isVisible({ timeout: 8000 }).catch(() => false) && !(await page.getByText(state.order?.order_number || 'none').count()));
  await numberBox.fill('0812-0000-0000').catch(() => {});
  await page.getByRole('button', { name: ID['cust.openDashboard'], exact: true }).click().catch(() => {});
  await settle(page);
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
    // Loaded on its own: the loading block was half a screen, so the footer showed and was then shoved down
    // by the article — CLS 0.28 on a phone (2026-11-02).
    await goto(page, pathOf(page));
    const articleCls = await page.evaluate(() => window.__cls);
    check(run, 'an article does not jump as it loads (CLS < 0.1)', articleCls < 0.1, `CLS ${articleCls.toFixed(3)}`);
  }
  await goto(page, '/bespoke');
  check(run, 'bespoke page renders its form', await page.locator('form, fieldset').first().isVisible().catch(() => false));
  check(run, 'bespoke has no horizontal scroll', await noSideScroll(page));
  await goto(page, '/mobile/catalog');
  check(run, 'an old phone address lands on its page', pathOf(page) === '/catalog', pathOf(page));

  // --- English shop ---
  await goto(page, '/en/home');
  check(run, 'English home renders', await page.locator('h1').first().isVisible());
  // Rendered English from the first frame: it used to start Indonesian, show the domestic price notice, then
  // drop it and lift the header 38 px (2026-11-02).
  { const cls = await page.evaluate(() => window.__cls); check(run, 'English home does not shift as it loads (CLS < 0.02)', cls < 0.02, `CLS ${cls.toFixed(3)}`); }
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

  // No Indonesian on the English shop outside what is marked Indonesian (the journal has no English): /en/home
  // printed "Dari seri Macapat." over a description that had its English twin all along (2026-11-02).
  const indonesianOn = (path) => goto(page, path).then(() => page.evaluate(() => {
    const words = /\b(dan|yang|untuk|dengan|tidak|kamu|kami|belum|sudah|bisa|harga|pesanan|keranjang|lihat|ini|itu|dari|di)\b/i;
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!el.getClientRects().length || el.closest('[lang]:not(html)')?.lang === 'id') continue;
      for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim().length > 3 && words.test(n.textContent)) out.push(n.textContent.trim().slice(0, 50));
    }
    return out;
  }));
  for (const path of ['/en/home', '/en/catalog', `/en${href}`]) {
    const found = await indonesianOn(path);
    check(run, `${path.replace(href, '/catalog/<perfume>')} has no Indonesian outside marked parts`, found.length === 0, found.slice(0, 3).join(' | '));
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
  const previews = [];
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
    // What WhatsApp and Instagram read: an image, a large card, and the shop's own locale.
    const og = (name) => (raw.match(new RegExp(`<meta[^>]*(?:property|name)="${name}"[^>]*content="([^"]*)"`)) || [])[1] || '';
    const locale = path.startsWith('/en') ? 'en_US' : 'id_ID';
    if (!og('og:image') || og('twitter:card') !== 'summary_large_image' || og('og:locale') !== locale) previews.push(`${path} image=${Boolean(og('og:image'))} card=${og('twitter:card')} locale=${og('og:locale') || '-'}`);
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
  check(run, 'link previews carry an image, a large card and the shop\'s locale', previews.length === 0, previews.join('; '));

  // Structured data, read after React (helmet's blocks). The prerendered price is the one a crawler that runs
  // no script reads: it must be the live price, or the 12 Nov 2026 schedule leaves the old one behind.
  const ldOf = async (path) => {
    const context = await browser.newContext({ locale: 'en-US', timezoneId: 'America/Los_Angeles' });
    await guard(context, { blocked: [], orderBodies: [], order: null });
    const page = await context.newPage();
    await goto(page, path);
    await page.waitForSelector('script[type="application/ld+json"][data-react-helmet]', { state: 'attached', timeout: 20000 }).catch(() => {});
    const blocks = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((el) => JSON.parse(el.textContent)));
    await context.close();
    return blocks;
  };
  const rawLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const idProduct = pick(/^\/catalog\/./);
  if (idProduct) {
    const live = (await ldOf(idProduct)).find((j) => j['@type'] === 'Product');
    const baked = rawLd(await fetch(`${BASE}${idProduct}`).then((r) => r.text())).find((j) => j['@type'] === 'Product');
    check(run, 'the prerendered product price is the live one', baked?.offers?.price === live?.offers?.price && live?.offers?.price > 0,
      `prerendered ${baked?.offers?.price} vs live ${live?.offers?.price}`);
    const en = await ldOf(`/en${idProduct}`);
    const enProduct = en.find((j) => j['@type'] === 'Product');
    const trail = (en.find((j) => j['@type'] === 'BreadcrumbList')?.itemListElement || []).map((item) => new URL(item.item).pathname);
    check(run, 'the English product states its own description and an /en trail',
      enProduct?.description && enProduct.description !== live?.description && trail.length && trail.every((path) => path.startsWith('/en')),
      trail.join(' > '));
  }
  const site = (await ldOf('/en/home')).find((j) => j['@type'] === 'WebSite');
  check(run, 'the English home declares English and no dead search box', site?.inLanguage === 'en' && !site?.potentialAction, JSON.stringify(site?.inLanguage));
};

// Asked for less motion: nothing keeps animating, and the page jumps instead of gliding.
const runMotion = async (browser) => {
  const run = 'motion';
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce' });
  await guard(context, { blocked: [], orderBodies: [], order: null });
  const page = await context.newPage();
  await goto(page, '/home');
  const state = await page.evaluate(() => ({
    running: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming?.().iterations === Infinity).length,
    scroll: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  check(run, 'with reduced motion nothing loops and nothing glides', state.running === 0 && state.scroll === 'auto', `${state.running} looping, scroll-behavior ${state.scroll}`);
  // An empty cart sums nothing: its summary used to read Subtotal Rp 0 with a free vial (2026-11-02).
  await goto(page, '/cart');
  check(run, 'an empty cart shows no summary box', !(await page.locator('#cart-summary-title').count()));
  // No article has a cover yet; the placeholder was an empty box repeating the title beside it.
  for (const path of ['/journal', '/articles/kisah-jason-vorhees-32209a44']) {
    await goto(page, path);
    const empty = await page.evaluate(() => [...document.querySelectorAll('figure.ng-cover')].filter((f) => !f.querySelector('img')).length);
    check(run, `${path.split('/')[1]}: no empty placeholder cover`, empty === 0, `${empty} empty`);
  }
  await context.close();
};

// The header and the footer, measured. The shop's root clips sideways overflow, so `noSideScroll` passed
// while the menu button stood half off a 360px phone and wholly off a 320px one (2026-11-06).
const runChrome = async (browser) => {
  const run = 'chrome';
  const found = { bare: [], clipped: [], spilled: [], ragged: [], offCentre: [], edges: [] };
  for (const width of [320, 360, 390, 768, 1024, 1280, 1536, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
    await guard(context, { blocked: [], orderBodies: [], order: null });
    const page = await context.newPage();
    // The account portal kept a header of its own and no footer until 2026-11-07; the tracking page is its sibling.
    for (const path of ['/home', '/en/home', '/catalog', '/customer', '/en/customer', '/track']) {
      await goto(page, path);
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const box = (el) => el?.getBoundingClientRect();
        const name = (el) => (el.textContent.trim() || el.getAttribute('aria-label') || el.tagName).slice(0, 20);
        const controls = [...document.querySelectorAll('.ng-header a, .ng-header button, .ng-footer a, .ng-footer button, .ng-footer input')]
          .filter((el) => el.getClientRects().length);
        const clipped = controls.filter((el) => box(el).left < -0.5 || box(el).right > vw + 0.5).map(name);
        // A row of the footer grid is filled when its blocks run from the grid's left edge to its right.
        const grid = document.querySelector('.ng-footer__grid');
        const rows = new Map();
        for (const block of grid?.children || []) {
          const b = box(block);
          rows.set(Math.round(b.top), [...(rows.get(Math.round(b.top)) || []), b]);
        }
        const g = box(grid);
        const ragged = [...rows.values()].filter((row) => Math.abs(Math.min(...row.map((b) => b.left)) - g.left) > 1
          || Math.abs(Math.max(...row.map((b) => b.right)) - g.right) > 1).length;
        const links = [...document.querySelectorAll('.ng-header__nav a')].filter((el) => el.getClientRects().length);
        const navCentre = links.length ? (box(links[0]).left + box(links.at(-1)).right) / 2 : null;
        const lefts = ['.ng-header__wordmark', 'main .ng-container', '.ng-hero__body', '.ng-footer__wordmark']
          .map((selector) => box(document.querySelector(selector))?.left).filter((left) => left !== undefined).map(Math.round);
        const bare = !document.querySelector('.ng-header') || !document.querySelector('.ng-footer');
        // The page's own controls stay inside the content gutter. On the English account page at 390px the
        // code box's buttons ran past the card's border (2026-11-07): inside the screen, so "clipped" passed.
        const gutter = parseFloat(getComputedStyle(document.querySelector('main .ng-section') || document.body).paddingLeft) || 0;
        const spilled = [...document.querySelectorAll('main a, main button, main input')]
          .filter((el) => el.getClientRects().length && !el.closest('.ng-header, .ng-footer, .ng-filters, nav'))
          // A floating control (back to top, the phone's pay bar) sits on the screen edge by design.
          .filter((el) => { for (let n = el; n && n.tagName !== 'MAIN'; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return false; return true; })
          .filter((el) => gutter && (box(el).right > vw - gutter + 1 || box(el).left < gutter - 1)).map(name);
        return { vw, bare, clipped, spilled, ragged, navCentre, lefts };
      });
      const at = `${path}@${width}`;
      if (m.bare) found.bare.push(at);
      if (m.clipped.length) found.clipped.push(`${at}: ${m.clipped.join(', ')}`);
      if (!['/home', '/en/home', '/catalog'].includes(path) && m.spilled.length) found.spilled.push(`${at}: ${m.spilled.join(', ')}`);
      if (m.ragged) found.ragged.push(`${at}: ${m.ragged} row(s)`);
      // From 1100px the actions fit in half the slack; below it they need more and the nav gives way.
      if (width >= 1100 && m.navCentre !== null && Math.abs(m.navCentre - m.vw / 2) > 2) found.offCentre.push(`${at}: ${Math.round(m.navCentre)} vs ${m.vw / 2}`);
      if (Math.max(...m.lefts) - Math.min(...m.lefts) > 1) found.edges.push(`${at}: ${m.lefts.join('/')}`);
    }
    await context.close();
  }
  check(run, 'every page wears the shop header and footer', !found.bare.length, found.bare.slice(0, 3).join('; '));
  check(run, 'every header and footer control is on screen, 320–1920px', !found.clipped.length, found.clipped.slice(0, 3).join('; '));
  check(run, 'account and tracking controls stay inside the page gutter', !found.spilled.length, found.spilled.slice(0, 3).join('; '));
  check(run, 'every footer row runs edge to edge — no block left on a row alone', !found.ragged.length, found.ragged.slice(0, 3).join('; '));
  check(run, 'the header nav stands on the page centre line', !found.offCentre.length, found.offCentre.slice(0, 3).join('; '));
  check(run, 'header, page and footer start at one left edge', !found.edges.length, found.edges.slice(0, 3).join('; '));
};

// SMOKE_ONLY=phone,seo runs just those, for chasing one failure without the other six minutes.
const ONLY = (process.env.SMOKE_ONLY || '').split(',').filter(Boolean);
const wanted = (name) => !ONLY.length || ONLY.includes(name);
const browser = await chromium.launch();
try {
  if (wanted('desktop')) await runShop(browser, 'desktop', { viewport: { width: 1440, height: 900 } });
  if (wanted('phone')) await runShop(browser, 'phone', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  if (wanted('tabs')) await runTabs(browser);
  if (wanted('abroad')) await runAbroad(browser);
  if (wanted('outage')) await runOutage(browser);
  if (wanted('seo')) await runSeo(browser);
  if (wanted('motion')) await runMotion(browser);
  if (wanted('chrome')) await runChrome(browser);
} finally {
  await browser.close();
}
const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
