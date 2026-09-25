// `node src/utils/trackingLink.selfcheck.mjs`
//
// The tracking link is the one link we push at a buyer: it goes out in the WhatsApp message and it is
// printed as the QR on the parcel. Both carry an ORDER number (/track/DKT-...). A QR on a box and a link
// in WhatsApp are opened on a phone almost every time.
//
// From audit round 9 until today a phone opening that link was redirected to /mobile/customer?code=<order
// number> — and that page's ?code= is the CUSTOMER code (SOLI-...). Every tracking link we ever sent
// answered "that customer code was not found" on the device it was made for. Nothing failed: the redirect
// worked, the portal worked, the buyer was just shown the wrong page asking for a different code.
//
// The rule this file holds is not "there is no mapping". It is: wherever a phone lands from a tracking
// link, that page must be the tracking page. Add a real /mobile/track route later and map to it — this
// check passes. Point it at any other screen and it fails.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { toMobilePath } from './deviceRouting.js';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// A comment quoting the very expression being searched for has defeated a text check in this repo five
// times. Comments go first, every time.
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// --- 1. Which routes ARE the tracking page — read from the router, never listed by hand ------------------
const app = read('App.jsx');
const trackingRoutes = [...app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{<PublicTrackingPage\b[^}]*\}\s*\/>/g)]
  .map((match) => match[1]);
assert.ok(trackingRoutes.length >= 2, 'the router must still render PublicTrackingPage on at least the code and no-code routes');

const routePattern = (route) => new RegExp(`^${route.replace(/:[^/]+/g, '[^/]+')}$`);
const sampleFor = (route) => route.replace(/:[^/]+/g, 'DKT-TEST-1');
const isTrackingRoute = (path) => trackingRoutes.some((route) => routePattern(route).test(path));

// --- 2. A phone opening a tracking link must land on the tracking page ----------------------------------
for (const route of trackingRoutes) {
  const path = sampleFor(route);
  const mapped = toMobilePath(path);
  if (mapped === null) continue; // stays on the same page, which is a tracking page by definition
  const [mappedPath] = mapped.split('?');
  assert.ok(isTrackingRoute(mappedPath),
    `a phone opening ${path} is sent to ${mapped}, which is not a tracking page — that is the round-9 bug: `
    + 'the buyer is asked for a customer code they were never given');
}

// --- 3. The links we actually hand buyers point at that page --------------------------------------------
// Build the path each template actually produces and put it through the router's own list. Comparing only
// the first segment is not enough: rename /track/:code to /lacak/:code and a bare /track route left behind
// would still "match" while every link we send 404s. The whole path has to be a route.
const samplePath = (template) => template
  .replace(/^(?:\$\{[^}]*\})+/, '') // origin and the /en shop prefix are not part of the router path
  .replace(/\$\{[^}]*\}/g, 'DKT-TEST-1');
const templateOf = (source, fnName) => {
  const body = source.match(new RegExp(`${fnName}[\\s\\S]*?\\n};`));
  assert.ok(body, `${fnName} must still exist — it builds a link a buyer receives`);
  const template = body[0].match(/`([^`]*)`/);
  assert.ok(template, `${fnName} must still build its link from a template literal`);
  return template[1];
};

const service = read('services', 'publicTrackingService.js');
const notifications = read('services', 'notificationTemplateService.js');
const trackingTemplate = templateOf(notifications, 'const getTrackingUrl');
const dashboardTemplate = templateOf(notifications, 'const getCustomerDashboardUrl');
for (const [label, template] of [
  ['buildPublicTrackingPath (the QR printed on the parcel, via buildPublicTrackingUrl)', templateOf(service, 'export const buildPublicTrackingPath')],
  ['getTrackingUrl (the link in the WhatsApp message)', trackingTemplate],
]) {
  const path = samplePath(template);
  assert.ok(isTrackingRoute(path),
    `${label} builds ${template} — ${path} is not a route the tracking page answers`);
  const mapped = toMobilePath(path);
  assert.ok(mapped === null || isTrackingRoute(mapped.split('?')[0]),
    `${label} builds ${path}, and a phone opening it is sent to ${mapped}`);
}

// The two links differ in WHAT they carry, and that is the whole confusion: one carries the order number,
// the other the customer code. Swap them and both pages greet the buyer with "not found".
// Read the TEMPLATES, not the function bodies: getTrackingUrl also mentions order.orderNumber in its
// guard clause, so a body-wide search says yes even when the link itself is built from the wrong field.
assert.match(trackingTemplate, /order\.orderNumber/, 'the tracking link carries the ORDER number');
assert.doesNotMatch(trackingTemplate, /customerCode/, 'never the customer code — the tracking page cannot resolve one');
assert.match(dashboardTemplate, /order\.customerCode/, 'the portal link carries the CUSTOMER code');
assert.doesNotMatch(dashboardTemplate, /orderNumber/, 'never the order number — the portal cannot resolve one');

// --- 4. And the portal really does read ?code= as a customer code ---------------------------------------
// This is the fact that makes rule 2 necessary. If the portal ever learns to resolve an order number too,
// this assertion is the place to say so on purpose.
const portal = read('pages', 'CustomerPortalPage.jsx');
assert.match(portal, /searchParams\.get\('code'\)/, 'the portal takes its code from the query string');
assert.match(portal, /getCustomerPortalByCode\(code\)/,
  'and resolves it as a CUSTOMER code — an order number handed to this page is simply not found');

// So the portal must not CALL it an order code either. It did, in both languages: the field was headed
// "Cari pakai kode order" above a box that only ever resolved SOLI09232, and a buyer holding DKT-... was
// answered "Kode customer tidak ditemukan" by the same screen that had just asked them for an order code.
// One page, two names for two different things.
for (const language of ['id', 'en']) {
  for (const [key, text] of Object.entries(MESSAGES[language])) {
    if (!key.startsWith('cust.')) continue;
    assert.doesNotMatch(text, /kode order|order code/i,
      `${language}.${key} calls it an order code, but this page resolves customer codes only`);
  }
}

// --- The timeline marks a STAGE, and never claims a time -------------------------------------------------
// The step list appends track.current to whichever step the order has reached. In Indonesian that reads
// "Pesanan diterima (saat ini)" — this is where it stands. The English said " (now)", which on a four-
// month-old order rendered "Order received (now)": a status marker reading as a timestamp, directly
// above a "Placed 22 May 2026" that said otherwise. Read on a real order, DKT-MPGB5BF0.
//
// The rule is about what the marker CLAIMS, not its wording: it marks a position in a list, so it may
// not be a word for the present moment.
{
  const page = read('pages', 'PublicTrackingPage.jsx');
  assert.match(page, /index === completeCount - 1 \? t\('track\.current'\) : ''/,
    'the timeline must still mark the reached step — without it a buyer cannot tell where the order is');
  for (const locale of ['id', 'en']) {
    const marker = MESSAGES[locale]['track.current'];
    assert.ok(marker && marker.trim(), `track.current is missing in ${locale}`);
    assert.doesNotMatch(marker, /^\s*\(?\s*(now|just now|sekarang|barusan)\s*\)?\s*$/i,
      `${locale}.track.current reads as a time: "${marker.trim()}". It marks which step the order has `
      + 'reached, and it sits above the real dates — on an old order the two contradict each other');
  }
}

console.log('trackingLink selfcheck OK (the link on the box and in WhatsApp opens the tracking page, on a phone too)');
