#!/usr/bin/env node
// Phone Studio scan. Start `npm run dev:e2e` (port 3001), then:
//   node tools/studio-phone-scan.mjs                     every protected /mobile Studio screen
//   node tools/studio-phone-scan.mjs /mobile/studio/orders,/mobile/formulas
//   WIDTH=360 SHOTS=1 ALLFIELDS=1 OUT=/some/dir node tools/studio-phone-scan.mjs
//   DESKTOP=1 [WIDTH=1440] node tools/studio-phone-scan.mjs   the desktop Studio (/studio, lab pages)
//
// Per screen it reports: sideways overflow, clipped text, text overlapping text, controls under 40px,
// the end of the page hidden under the nav or a floating button, anything under the account button,
// console errors — and, for each field, whether it is still visible and uncovered after it takes focus
// and the viewport shrinks by a keyboard's height (320px), with the app's own keyboard handling running.
// Written 2026-11-08 when Dekito asked for exactly that; it found the keyboard-avoidance jump and the
// dead export-policy boxes.
//
// READ-ONLY by construction. The session is the e2e admin that only `--mode e2e` accepts (see
// e2eAdminScope.selfcheck.mjs), every request off this machine is answered here, and every write is
// refused and listed. Fixtures are synthetic; the only thing fetched is the public catalogue view.
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = 'http://localhost:3001';
const OUT = `${process.env.OUT || join(tmpdir(), 'studio-phone-scan')}/`;
mkdirSync(OUT, { recursive: true });
// DESKTOP=1 scans the desktop Studio instead: a desktop browser, the desktop routes, and WCAG 2.2's 24px
// target floor rather than the phone's 40px. The keyboard pass finds no phone shell there and skips itself.
const DESK = Boolean(process.env.DESKTOP);
const W = Number(process.env.WIDTH || (DESK ? 1280 : 390)), H = DESK ? 900 : 844, KB = 320;
const EMAIL = 'admin-e2e@solivagant.test';
const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const jwt = [b64({ alg: 'HS256', typ: 'JWT' }), b64({ sub: '99999999-9999-4999-8999-999999999999', aud: 'authenticated', exp, aal: 'aal2', email: EMAIL }), 'c2ln'].join('.');
const user = { id: '99999999-9999-4999-8999-999999999999', email: EMAIL, user_metadata: { name: 'Ade Rizki Wiranto' } };
const session = { access_token: jwt, refresh_token: 'e2e-refresh', expires_at: exp, user };
const now = new Date().toISOString();

// --- fixtures --------------------------------------------------------------------------------------
const pub = await fetch('https://ysokpneuumtmgqfgdpmc.supabase.co/rest/v1/storefront_products_public?select=*', {
  headers: { apikey: 'sb_publishable_tfwEANvMvOTmVXLpIapTYw_oh3DDmyw' },
}).then((r) => r.json());
const products = pub.map((p) => ({ ...p, source: 'custom' }));
const P = products.find((p) => /iris/i.test(p.name)) || products[0];
const longName = products.find((p) => /ayang/i.test(p.name)) || products[1];
const prices = products.slice(0, 19).flatMap((p) => (p.variants || []).slice(0, 1).flatMap((v) => [
  { id: `m-${p.id}`, product_id: p.id, variant_id: v.id, tier: 'member', price_number: Math.floor(v.priceNumber * 0.9 / 1000) * 1000 },
  { id: `o-${p.id}`, product_id: p.id, variant_id: v.id, tier: 'overseas', price_number: Math.ceil(v.priceNumber * 3.5 / 10000) * 10000 },
]));
const item = (p, q = 1) => ({ productId: p.id, slug: p.slug, productSlug: p.slug, variantId: p.variants?.[0]?.id, name: p.name, size: p.variants?.[0]?.size || '30 ml', quantity: q, priceNumber: p.variants?.[0]?.priceNumber || 359000, price: 'Rp 359.000' });
const order = (n, status, pay, ship, extra = {}) => ({
  id: `3333333${n}-3333-4333-8333-33333333333${n}`, order_number: `SOLI-20261108-00${n}`, status, payment_status: pay, shipment_status: ship,
  customer_name: n === 1 ? 'Raden Ajeng Kartika Sekar Ayu Wulandari Pramesti Kusumaningrum' : 'Budi',
  customer_code: `SOLI9000${n}`, contact: '6281234567890',
  notes: 'Address: Jl. Panglima Polim Raya No. 123A, RT 004/RW 011, Kelurahan Kramat Pela, Kebayoran Baru\nArea: Jakarta Selatan, DKI Jakarta 12130\nShipping: JNE Reguler / ETA 2-3 hari / Rp 12000',
  items: n === 1 ? [item(longName, 2), item(P, 1)] : [item(P, 1)], quantity: n === 1 ? 3 : 1, subtotal: 1089000,
  payment_provider: 'manual', payment_reference: '', source: 'storefront', courier_name: ship === 'shipped' ? 'JNE' : '', tracking_number: '',
  created_at: now, updated_at: now, ...extra,
});
// An overseas order as the English cart writes it (api/orders/create.js, input.international, since
// 2026-11-10) — captured from the real handler run against a fake database, with the receipt uploaded.
const intlOrder = {
  id: '33333334-3333-4333-8333-333333333334', order_number: 'DKT-MWAUROI3-KQJDYC', status: 'pending_payment',
  customer_name: 'Jordan Ellis-Whitaker', customer_code: 'SOLI90004', customer_id: null,
  contact: 'jordan.ellis@example.com · +1 415 555 0132',
  notes: 'Order luar negeri dari toko EN (web) — United States.\nParfum US$190 · Ongkir DHL US$45 · Total US$235 (kurs toko Rp 16.500).\nAlamat:\n2210 Fillmore Street, Apt 4B\n94115 San Francisco, CA\nUnited States',
  items: [
    { id: P.id, slug: P.slug, productSlug: P.slug, name: P.name, category: P.category || 'Floral', cartSlug: `${P.slug}-${P.variants?.[0]?.id}`, variantId: P.variants?.[0]?.id, size: '30 ml', quantity: 2, priceNumber: 1567500, price: 'US$95', tags: [] },
    { id: 'p-vial', slug: 'vial-hadiah', productSlug: 'vial-hadiah', name: 'Vial hadiah', category: 'Gift', cartSlug: 'vial-hadiah-la-rose', variantId: 'la-rose', size: 'La Rose', quantity: 1, priceNumber: 0, price: 'Gratis', tags: ['Vial hadiah'] },
  ],
  quantity: 3, subtotal: 3877500, checkout_draft: '', payment_provider: 'manual', payment_status: 'pending',
  payment_token: 'MD8YVJE7EZ1G0ZN80FY0MBR17JHBJQDM',
  payment_response: { amountUsd: 235, currency: 'USD', amountIdr: 3877500, usdRate: 16500, bankName: 'PT Bank SMBC Indonesia Tbk (Jenius)', swift: 'SUNIIDJA', accountNumber: '', accountName: '', bankAddress: '' },
  courier_name: 'DHL Express / US$45 / 5–8 business days after dispatch', source: 'storefront',
  client_context: { surface: 'mobile', shop: 'en', viewport_width: 390 },
  payment_proof_url: 'orders/DKT-MWAUROI3-KQJDYC/1794320000000-abc.png', payment_proof_file_name: 'wise-receipt.png',
  payment_proof_content_type: 'image/png', payment_proof_uploaded_at: now, payment_proof_status: 'submitted',
  shipment_status: 'not_ready', tracking_number: '', inventory_deducted: true, created_at: now, updated_at: now,
};
const orders = [order(1, 'paid', 'paid', 'pending'), order(2, 'pending_payment', 'pending', 'pending'), order(3, 'shipped', 'paid', 'shipped'), intlOrder];
const customers = [1, 2, 3].map((n) => ({ id: `4444444${n}-4444-4444-8444-44444444444${n}`, customer_code: `SOLI9000${n}`, customer_name: n === 1 ? orders[0].customer_name : `Pelanggan ${n}`, contact: '6281234567890', delivery_address: 'Jl. Panglima Polim Raya No. 123A, RT 004/RW 011, Kebayoran Baru', delivery_area: 'Jakarta Selatan', notes: '', order_count: n, last_order_at: now, created_at: now, updated_at: now, tier: n === 2 ? 'reseller' : 'retail', auth_user_id: null }));
const matNames = ['Hedione HC (Methyl Dihydrojasmonate high cis)', 'Iso E Super', 'Ambroxan', 'Bergamot Essential Oil FCF (Bergaptene free)', 'Galaxolide 50% IPM', 'Vanillin', 'Ethyl Maltol', 'Cashmeran', 'Rose Absolute Turkey', 'Sandalwood Mysore Australian (Santalum spicatum)', 'Dipropylene Glycol (DPG)', 'Ethanol 96% Perfumer Grade'];
const materials = matNames.map((name, i) => ({ id: `5555555${String(i).padStart(1, '0')}-5555-4555-8555-5555555555${String(i).padStart(2, '0')}`, user_id: user.id, name, category: i > 9 ? 'Solvent' : ['Floral', 'Woody', 'Amber', 'Citrus', 'Musk', 'Gourmand'][i % 6], type: i > 9 ? 'solvent' : 'aroma_chemical', scent_family: 'Floral', note_type: ['top', 'heart', 'base'][i % 3], unit: 'g', cost_per_unit: 1250 + i * 731, supplier_name: 'PT Aroma Nusantara Sejahtera Abadi', vendor: 'Perfumer Supply House', default_dilution_percent: 100, ifra_limit: i % 3 ? 2.5 : null, pyramid_placement: ['top', 'heart', 'base'][i % 3], description: 'Bright, radiant jasmine facet with fresh, diffusive lift.', notes: '', is_diluted: false, cas_number: '24851-98-7', stock_quantity: i * 13, minimum_stock: 10, low_stock_threshold: 20, data_status: 'verified', created_at: now, updated_at: now }));
const formulas = ['L’iris v3 — poudre de cuir final', 'Ayang-ayang (ꦲꦪꦁꦲꦪꦁ) draft 2', 'Maskumambang', 'Test akord vanila'].map((name, i) => ({ id: `6666666${i}-6666-4666-8666-66666666666${i}`, user_id: user.id, name, code: `F-00${i + 1}`, notes: '', category: 'Floral', status: i ? 'draft' : 'final', version: 3, batch_size: 100, batch_date: now, markup_percentage: 300, created_at: now, updated_at: now, author_name: 'Dekito', packaging_cost: 25000, bottle_cost: 18000, cap_cost: 7000, parent_formula_id: null, revision_note: '' }));
const formulaItems = materials.slice(0, 8).map((m, i) => ({ id: `7777777${i}-7777-4777-8777-77777777777${i}`, formula_id: formulas[0].id, item_type: 'raw_material', item_id: m.id, percentage: [12.5, 8, 6, 20, 15, 3, 0.5, 35][i], grams: null, dilution_percent: 100, concentrate_amount: null, sort_order: i, created_at: now, updated_at: now }));
const batches = [{ id: '88888880-8888-4888-8888-888888888880', user_id: user.id, batch_code: 'B-20261108-LIRIS-30ML', formula_id: formulas[0].id, solvent_id: materials[11].id, target_quantity: 500, produced_quantity: 480, production_date: now, unit: 'ml', formula_percentage: 20, solvent_percentage: 80, formula_quantity_needed: 100, solvent_quantity_needed: 400, status: 'completed', notes: '', is_stock_deducted: true, created_at: now, updated_at: now, bottle_ml: 30, loss_percent: 4, usable_quantity: 480, bottle_count: 16, cogs_per_bottle: 96500, selling_price: 429000, sku: 'SOLI-LIRIS-30', product_id: P.id, qc_status: 'passed', qc_notes: '', qc_checked_at: now, qc_reviewer: 'Dekito' }];
const posts = [
  { id: '99999990-9999-4999-8999-999999999990', user_id: user.id, title: 'Vanila itu buah dari bunga anggrek, dan butuh sembilan bulan untuk jadi aroma', category: 'bahan', status: 'published', slug: 'vanila-itu-buah', related_formula_id: null, excerpt: 'Panjang ceritanya.', content: 'Paragraf satu.\n\nParagraf dua.', seo_title: '', cover_image_url: '', tags: ['vanila'], published_at: now, created_at: now, updated_at: now, related_product_slug: '', seo_description: '', cover_alt: '' },
  { id: '99999991-9999-4999-8999-999999999991', user_id: user.id, title: 'Draft: kenapa musk tidak selalu bau sabun', category: 'cerita', status: 'draft', slug: 'musk', related_formula_id: null, excerpt: '', content: '', seo_title: '', cover_image_url: '', tags: [], published_at: null, created_at: now, updated_at: now, related_product_slug: '', seo_description: '', cover_alt: '' },
];
const vouchers = [{ id: 'aaaaaaa0-aaaa-4aaa-8aaa-aaaaaaaaaaa0', code: 'WELCOME10', discount_type: 'percent', discount_value: 10, minimum_order: 300000, expires_at: '2026-12-31T16:59:59Z', active: true, usage_limit_total: 100, usage_count: 12, eligible_product_slugs: [], eligible_categories: [], created_at: now, updated_at: now, minimum_quantity: 1, usage_limit_per_account: 1 },
  { id: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', code: 'KARTUPAKETNOVEMBER2026', discount_type: 'fixed', discount_value: 50000, minimum_order: 0, expires_at: null, active: false, usage_limit_total: null, usage_count: 0, eligible_product_slugs: [P.slug], eligible_categories: [], created_at: now, updated_at: now, minimum_quantity: 1, usage_limit_per_account: null }];
const FIX = {
  storefront_products: products, storefront_products_public: products, storefront_product_prices: prices,
  storefront_orders: orders, storefront_customers: customers, raw_materials: materials, formulas, formula_items: formulaItems,
  batches, journal_posts: posts, storefront_vouchers: vouchers,
  storefront_product_categories: [{ id: 'bbbbbbb0-bbbb-4bbb-8bbb-bbbbbbbbbbb0', name: 'Chypre', description: '', accent: '', sort_order: 9, created_at: now, updated_at: now }],
  raw_material_categories: ['Floral', 'Woody', 'Amber', 'Citrus', 'Musk', 'Gourmand', 'Solvent'].map((name, i) => ({ id: `ccccccc${i}-cccc-4ccc-8ccc-ccccccccccc${i}`, user_id: user.id, name, color: '#c8a46a', created_at: now, updated_at: now })),
};
const matchFilters = (rows, url) => {
  let out = rows;
  for (const [k, v] of new URL(url).searchParams) {
    if (['select', 'order', 'limit', 'offset', 'or', 'and', 'on_conflict', 'columns'].includes(k)) continue;
    if (v.startsWith('eq.')) out = out.filter((r) => String(r[k]) === v.slice(3));
    else if (v.startsWith('in.(')) { const set = v.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '')); out = out.filter((r) => set.includes(String(r[k]))); }
    else if (v.startsWith('is.null')) out = out.filter((r) => r[k] == null);
  }
  return out;
};

// --- routes ----------------------------------------------------------------------------------------
const ALL = [
  '/mobile/studio', '/mobile/studio/dashboard', '/mobile/studio/products', '/mobile/studio/products/wear', '/mobile/studio/products/new',
  `/mobile/studio/products/${P.id}/edit`, '/mobile/studio/product-categories', '/mobile/studio/bespoke', '/mobile/studio/vouchers',
  '/mobile/studio/shipping', '/mobile/studio/orders', `/mobile/studio/orders/${orders[0].id}`, '/mobile/studio/fulfillment',
  '/mobile/studio/customers', '/mobile/journal', '/mobile/journal/new', `/mobile/journal/${posts[0].id}`, `/mobile/journal/${posts[0].id}/edit`,
  '/mobile/raw-materials', '/mobile/raw-materials/new', `/mobile/raw-material/${materials[0].id}`, `/mobile/raw-material/${materials[0].id}/edit`,
  '/mobile/raw-material-audit', '/mobile/categories', '/mobile/formulas', '/mobile/formulas/new', `/mobile/formulas/${formulas[0].id}`,
  `/mobile/formulas/${formulas[0].id}/edit`, '/mobile/batches', `/mobile/batches/${batches[0].id}`, '/mobile/production-costing',
  '/mobile/validation', '/mobile/validation/new', '/mobile/studio/site-images', '/mobile/studio/site-facts', '/mobile/studio/export-shipping',
  '/mobile/authenticator',
];
const DESKTOP_ALL = [
  '/studio', '/dashboard', '/studio/products', '/studio/products/curation', '/studio/products/wear', '/studio/products/new',
  '/studio/products/inventory', `/studio/products/${P.id}/edit`, '/studio/product-categories', '/studio/vouchers', '/studio/shipping',
  '/studio/orders', `/studio/orders/${orders[0].id}`, '/studio/customers', '/studio/shipments', '/studio/site-images', '/studio/site-facts',
  '/studio/export-shipping', '/studio/stories', '/studio/journal', '/studio/journal/new', `/studio/journal/${posts[0].id}`,
  `/studio/journal/${posts[0].id}/edit`, '/raw-materials', '/raw-material-audit', `/raw-material/${materials[0].id}`, '/categories',
  '/formulas', '/formulas/new', `/formulas/${formulas[0].id}`, `/formulas/${formulas[0].id}/edit`, '/batches', `/batches/${batches[0].id}`,
  '/production-costing', '/validation', '/authenticator',
];
const routes = process.argv[2] ? process.argv[2].split(',') : DESK ? DESKTOP_ALL : ALL;

const browser = await chromium.launch();
const context = await browser.newContext(DESK ? { viewport: { width: W, height: H } } : { ...devices['iPhone 13'], viewport: { width: W, height: H } });
const blockedWrites = [];
await context.route('**/*', async (route, req) => {
  const url = req.url();
  if (url.startsWith(BASE) || /fonts\.(googleapis|gstatic)/.test(url)) return route.continue();
  if (url.includes('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
  if (url.includes('/auth/v1/factors')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totp: [] }) });
  if (url.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  if (/\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(url) || url.includes('/storage/v1/object/public/')) return route.continue();
  const m = url.match(/\/rest\/v1\/(rpc\/)?([a-z0-9_]+)/);
  if (m && m[1]) {
    if (m[2] === 'is_admin') return route.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  }
  if (m && req.method() === 'GET') {
    const rows = matchFilters(FIX[m[2]] || [], url);
    const single = /vnd\.pgrst\.object/.test(req.headers().accept || '');
    if (single) return rows[0] ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows[0]) }) : route.fulfill({ status: 406, contentType: 'application/json', body: '{"code":"PGRST116"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${rows.length}/${rows.length}` }, body: JSON.stringify(rows) });
  }
  if (m && req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': '0-0/0' }, body: '' });
  blockedWrites.push(`${req.method()} ${url.slice(0, 100)}`);
  return route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"scanner: writes refused"}' });
});
await context.addInitScript((s) => { try { localStorage.setItem('solivagant.supabase.auth.v1', JSON.stringify(s)); } catch {} }, session);

const page = await context.newPage();
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 160)); });
page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR ${String(e.message).slice(0, 160)}`));

const results = [];
for (const route of routes) {
  consoleErrors.length = 0;
  await page.setViewportSize({ width: W, height: H });
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(900);
  const slug = route.replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
  if (process.env.SHOTS) await page.screenshot({ path: `${OUT}${slug}-${W}.png`, fullPage: true });
  const res = await page.evaluate(async ({ H, DESK }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; // < 2: sr-only text is 1px on purpose
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false; if (el.closest('[aria-hidden="true"],[hidden],[data-state="inactive"],[inert],.mobile-accordion-content[data-open="false"]')) return false;
      for (let p = el; p && p !== document.body; p = p.parentElement) { const pc = getComputedStyle(p); if (Number(pc.opacity) === 0) return false; if (p !== el && /(hidden|clip)/.test(pc.overflowX + pc.overflowY)) { const pr = p.getBoundingClientRect(); if (r.bottom <= pr.top + 1 || r.top >= pr.bottom - 1 || r.right <= pr.left + 1 || r.left >= pr.right - 1) return false; } }
      return true; };
    const name = (el) => { const t = (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || '').trim().replace(/\s+/g, ' '); return `${el.tagName.toLowerCase()}${t ? ` "${t.slice(0, 38)}"` : ''}`; };
    const risky = /logout|keluar|hapus|delete|simpan|kirim|bayar|publish|terbit|batal|reset|upload|sync|tandai|lunas|selesai|update|perbarui/i;
    for (const c of [...document.querySelectorAll('.mobile-accordion-content[data-open="false"]')]) { const b = c.previousElementSibling; if (b && !risky.test(b.innerText)) { b.click(); await sleep(50); } }
    for (const b of [...document.querySelectorAll('main button[aria-expanded="false"]')]) if (!risky.test(b.innerText) && vis(b)) { b.click(); await sleep(50); }
    await sleep(400);
    const vw = document.documentElement.clientWidth;
    const all = [...document.querySelectorAll('body *')].filter(vis);
    const inScroller = (el) => { for (let p = el.parentElement; p; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true; return false; };
    const overflow = all.filter((el) => { const r = el.getBoundingClientRect(); return (r.right > vw + 1 || r.left < -1) && !inScroller(el); })
      .filter((el, _, arr) => !arr.some((o) => o !== el && el.contains(o))).slice(0, 6).map((el) => `${name(el)} →${Math.round(el.getBoundingClientRect().right)}`);
    const clipped = all.filter((el) => { if (!el.textContent.trim() || el.querySelector('input,textarea,select,img,svg')) return false; const cs = getComputedStyle(el); return /(hidden|clip)/.test(cs.overflowX + cs.overflowY) && el.clientWidth > 0 && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 3); })
      .filter((el, _, arr) => !arr.some((o) => o !== el && el.contains(o))).slice(0, 10).map((el) => `${getComputedStyle(el).textOverflow === 'ellipsis' ? '…' : '✂'} ${name(el)}`);
    const pinned = (el) => { for (let p = el; p; p = p.parentElement) if (/(fixed|sticky)/.test(getComputedStyle(p).position)) return true; return false; };
    const texts = all.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !pinned(el) && !el.closest('.mobile-fixed-action,[role=dialog],[data-sonner-toaster]'));
    const boxes = texts.map((el) => ({ el, r: el.getBoundingClientRect() }));
    const overlaps = [];
    outer: for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (x > 4 && y > 4 && x * y > 0.25 * Math.min(a.r.width * a.r.height, b.r.width * b.r.height)) { overlaps.push(`${name(a.el)} ✕ ${name(b.el)}`); if (overlaps.length >= 6) break outer; }
    }
    const session = document.querySelector('.mobile-session-actions');
    const sr = session && vis(session) ? session.getBoundingClientRect() : null;
    const underSession = sr ? texts.concat(all.filter((el) => el.matches('button,a,input'))).filter((el) => !session.contains(el) && !el.contains(session)).filter((el) => { const r = el.getBoundingClientRect(); return r.right > sr.left + 2 && r.left < sr.right - 2 && r.bottom > sr.top + 2 && r.top < sr.bottom - 2; }).filter((el, _, arr) => !arr.some((o) => o !== el && el.contains(o))).slice(0, 4).map(name) : [];
    const small = all.filter((el) => el.matches('button,a[href],select,[role=button],[role=tab],input:not([type=hidden]):not([type=checkbox]):not([type=radio])') && !el.closest('p'))
      .filter((el) => { const r = el.getBoundingClientRect(); return DESK ? r.height < 24 || r.width < 24 : r.height < 40 || r.width < 30; }).slice(0, 8).map((el) => `${name(el)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
    const scrollers = [document.scrollingElement, ...[...document.querySelectorAll('body *')].filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 10)];
    const scroller = scrollers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    document.documentElement.style.scrollBehavior = 'auto'; scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'instant' }); await sleep(350);
    const fixedBottom = [...document.querySelectorAll('body *')].filter((el) => vis(el) && getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().top > H / 2 && el.getBoundingClientRect().height < H / 2 && !el.closest('[data-sonner-toaster]'));
    const coverTop = Math.min(H, ...fixedBottom.map((el) => el.getBoundingClientRect().top));
    const content = [...document.querySelectorAll('main *')].filter((el) => vis(el) && getComputedStyle(el).position !== 'fixed' && !el.closest('.mobile-fixed-action') && (el.matches('button,a,input,textarea,select') || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())));
    const lowest = content.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
    const hiddenEnd = lowest && lowest.getBoundingClientRect().bottom > coverTop + 2 ? `${name(lowest)} ${Math.round(lowest.getBoundingClientRect().bottom)}>${Math.round(coverTop)}` : '';
    scroller.scrollTo({ top: 0, behavior: 'instant' });
    const rawKeys = [...document.body.innerText.matchAll(/\b[a-z]+(?:\.[a-zA-Z]+){1,3}\b/g)].map((m) => m[0]).filter((t) => /^(cust|pdp|home|nav|cart|bsp|why|journal|imm|wear|track|price|studio|mobile)\./.test(t)).slice(0, 5);
    return { overflow, clipped, overlaps, small, hiddenEnd, underSession, rawKeys, path: location.pathname, h1: document.querySelector('h1')?.textContent?.trim().slice(0, 40) || '' };
  }, { H, DESK });
  // keyboard: focus up to 6 fields, shrink the viewport the way a resizing keyboard does
  // select:not([aria-hidden]): Radix Select keeps a hidden native <select> for forms; nobody types into it,
  // and it reported three phone journal fields as "covered" by whatever sits on top of it.
  const fieldHandles = await page.$$('.mobile-app-shell input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([readonly]):not([disabled]), .mobile-app-shell textarea:not([readonly]), .mobile-app-shell select:not([aria-hidden="true"])');
  const visibleFields = [];
  for (const h of fieldHandles) if (await h.isVisible()) visibleFields.push(h);
  const pick = process.env.ALLFIELDS || visibleFields.length <= 6 ? visibleFields : [0, 1, Math.floor(visibleFields.length / 2), visibleFields.length - 2, visibleFields.length - 1].map((i) => visibleFields[i]);
  const keyboard = [];
  for (const f of pick) {
    await f.evaluate((el) => { const c = el.closest('.mobile-accordion-content[data-open="false"]'); if (c) c.previousElementSibling?.click(); });
    await page.waitForTimeout(350);
    if (!(await f.isVisible())) continue;
    // Every scroll position back to the top first, so each field starts where a person would find it.
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo({ top: 0, behavior: 'instant' }); for (const el of document.querySelectorAll('body *')) if (el.scrollTop) el.scrollTop = 0; });
    await f.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(150);
    await f.evaluate((el) => el.focus());
    await page.setViewportSize({ width: W, height: H - KB });
    await page.waitForTimeout(200);

    await f.evaluate((el) => { document.documentElement.style.scrollBehavior = 'auto'; el.scrollIntoView({ block: 'nearest', behavior: 'instant' }); });
    await page.waitForTimeout(250);
    const verdict = await f.evaluate((el, vh) => {
      const r = el.getBoundingClientRect(); const vw = document.documentElement.clientWidth;
      const x = Math.min(Math.max(r.left + Math.min(r.width / 2, 40), 1), vw - 1), y = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1);
      const hit = document.elementFromPoint(x, y);
      const ok = r.top >= -1 && r.bottom <= vh + 1 && hit && (hit === el || el.contains(hit) || (hit.contains(el) && hit.tagName === 'LABEL'));
      const nm = (n) => `${n.tagName.toLowerCase()}.${String(n.className).split(' ').slice(0, 2).join('.')} "${(n.getAttribute('aria-label') || n.innerText || n.placeholder || '').trim().slice(0, 30)}"`;
      return ok ? '' : `${nm(el)} [${Math.round(r.top)}..${Math.round(r.bottom)} of ${vh}] y=${Math.round(scrollY)} covered by ${hit ? nm(hit) : 'nothing'}`;
    }, H - KB);
    if (verdict) keyboard.push(verdict);
    await f.evaluate((el) => el.blur());
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(100);
  }
  const row = { route, ...res, fields: visibleFields.length, keyboard, errors: [...new Set(consoleErrors)].slice(0, 4) };
  results.push(row);
  const flags = ['underSession', 'overflow', 'clipped', 'overlaps', 'small', 'keyboard', 'errors', 'rawKeys'].filter((k) => row[k]?.length).map((k) => `${k}:${row[k].length}`);
  console.log(`${route.slice(0, 50).padEnd(50)} ${row.path === route ? '' : `→${row.path} `}${row.hiddenEnd ? 'END-HIDDEN ' : ''}${flags.join(' ')}`);
}
writeFileSync(`${OUT}results-${W}.json`, JSON.stringify({ results, blockedWrites }, null, 1));
console.log(`blocked writes: ${blockedWrites.length}`);
await browser.close();
