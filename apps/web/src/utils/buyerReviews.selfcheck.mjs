// Verified buyer reviews (Dekito, 20 Nov 2026).
//
// He asked for it in his words: a buyer who has bought can give stars and a review from their account,
// shown under the perfume, named or anonymous. He chose: checked first (nothing shows until he publishes it
// in Studio), only once the order has SHIPPED, the name as "first name + initial", and the English shop shows
// the reviews with a line saying they are from buyers in Indonesia, in Indonesian.
//
// This guard holds the rules that make it honest, and the October rule it inherits from the quotes
// (buyerQuotesAreNeverInvented): nothing in this repo writes a review, and with none there is silence.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noteSkip } from '../../tools/selfcheckSubject.mjs';
import {
  CARD_RATING_MIN_REVIEWS,
  REVIEW_BODY_MAX,
  averageRating,
  cardShowsRating,
  cleanReviewBody,
  clampRating,
  formatAverage,
  indexReviewStats,
  normalizeReviewableItem,
  reviewDisplayName,
  reviewIsEditable,
  reviewRequestMessage,
} from './reviews.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.resolve(HERE, rel), 'utf8');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// --- 1. The public name: first name + initial, the same rule as the SQL ----------------------------------
assert.equal(reviewDisplayName('rina  sari dewi'), 'Rina D.');
assert.equal(reviewDisplayName('BUDI'), 'Budi');
assert.equal(reviewDisplayName('anne-marie putri'), 'Anne-Marie P.', 'initcap, as Postgres does it');
assert.equal(reviewDisplayName('Walk-in customer'), '', 'a placeholder name is no name — the shop prints "Pembeli terverifikasi"');
assert.equal(reviewDisplayName('  '), '');
assert.ok(reviewDisplayName('x'.repeat(200)).length <= 40);

// --- 2. Stars and words --------------------------------------------------------------------------------
assert.equal(clampRating(5), 5);
assert.equal(clampRating(0), 0, 'zero stars is not a rating');
assert.equal(clampRating(6), 0);
assert.equal(clampRating('4'), 4);
assert.equal(cleanReviewBody('a\u0001b\n\n\n\nc  '), 'ab\n\nc');
assert.equal(cleanReviewBody('x'.repeat(5000)).length, REVIEW_BODY_MAX);
assert.equal(averageRating([{ rating: 5 }, { rating: 4 }]), 4.5);
assert.equal(averageRating([]), 0);
assert.equal(formatAverage(4.8, 'id-ID'), '4,8');
assert.equal(formatAverage(4.8, 'en-US'), '4.8');
assert.deepEqual(indexReviewStats([{ product_slug: 'la-rose', review_count: 3, average_rating: '4.67' }, { product_slug: 'x', review_count: 0 }]),
  { 'la-rose': { count: 3, average: 4.7 } }, 'a slug with no reviews is not in the index at all');

// A card shows stars from three reviews up — never "(1)", never "(0)".
assert.equal(CARD_RATING_MIN_REVIEWS, 3);
assert.equal(cardShowsRating({ count: 2, average: 5 }), false);
assert.equal(cardShowsRating({ count: 3, average: 4 }), true);
assert.equal(cardShowsRating(undefined), false);

// Editable for 30 days from when it was first sent; a review that does not exist yet is "editable".
assert.equal(reviewIsEditable(null), true);
assert.equal(reviewIsEditable({ editable_until: '2026-12-20T00:00:00Z' }, Date.parse('2026-12-01')), true);
assert.equal(reviewIsEditable({ editableUntil: '2026-12-20T00:00:00Z' }, Date.parse('2026-12-21')), false);
assert.equal(normalizeReviewableItem({ review: { status: 'bogus', rating: 4 } }).review.status, 'pending');

// --- 3. Empty means silent; nothing invents a review ---------------------------------------------------
const productReviews = stripComments(read('../components/storefront/ProductReviews.jsx'));
assert.match(productReviews, /if \(!reviews\?\.length\) return null;/, 'a product with no published review shows nothing');
assert.doesNotMatch(productReviews, /beFirst|jadilah yang pertama|be the first|Ulasan \(0\)/i);
const cardRating = stripComments(read('../components/storefront/CardRating.jsx'));
assert.match(cardRating, /if \(!cardShowsRating\(stats\)\) return null;/);
const REVIEW_SHAPED = /(body|rating|display_name|displayName)\s*:\s*(['"`][^'"`]{8,}|[1-5]\b)/;
for (const file of [
  '../components/storefront/ProductReviews.jsx', '../components/storefront/MyReviewsPanel.jsx',
  '../components/storefront/CardRating.jsx', '../pages/ReviewsPage.jsx', '../services/reviewService.js',
  '../components/ReviewsModerator.jsx',
]) {
  const source = stripComments(read(file));
  assert.doesNotMatch(source, REVIEW_SHAPED, `${file} carries a hardcoded review that could reach a page`);
  assert.doesNotMatch(source, /lorem|dummy|sample review|contoh ulasan/i, `${file} offers to invent one`);
}
// Studio can publish, hide and reply — never rewrite the buyer's words.
const service = stripComments(read('../services/reviewService.js'));
const updateFn = service.slice(service.indexOf('export const updateStudioReview'));
assert.doesNotMatch(updateFn, /patch\.(body|rating|display_name|anonymous)\s*=/, 'Studio must not edit what the buyer wrote');

// The footer links /reviews only once a review is published — an empty page linked from every page would
// say what "Ulasan (0)" says (25 Nov 2026).
const footer = stripComments(read('../components/storefront/StorefrontFooter.jsx'));
assert.match(footer, /to: '\/reviews', onlyWithReviews: true/);
assert.match(footer, /!link\.onlyWithReviews \|\| hasReviews/);

// --- 4. Who may review is decided by the server, from the verified session ------------------------------
const create = read('../../api/orders/create.js');
assert.match(create, /buyer_account: buyer\.authUserId/,
  'the order records the signed-in account from resolveBuyer (a verified token), never from the request');
assert.doesNotMatch(create, /buyer_account:\s*input\./, 'a buyer_account the browser sends would let anyone review anything');

// --- 5. The WhatsApp ask is its own message --------------------------------------------------------------
const ask = reviewRequestMessage({ customerName: 'rina sari' }, 'https://www.solivagantscent.com/');
assert.match(ask, /^Halo Rina, ini SOLIVAGANT\./);
assert.match(ask, /https:\/\/www\.solivagantscent\.com\/customer#ulasan/);
assert.doesNotMatch(read('../services/notificationTemplateService.js'), /reviewRequestMessage|minta ulasan/i,
  'the order-confirmation/notification templates are Dekito\'s flow and stay untouched');

// --- 6. The page has an address in both shops ------------------------------------------------------------
const vercel = read('../../vercel.json');
assert.equal((vercel.match(/\|reviews\|/g) || []).length, 2, '/reviews and /en/reviews must both serve the app');
assert.equal((read('../../middleware.js').match(/\|reviews\|/g) || []).length, 2, 'the country routing must see /reviews');
assert.match(read('./shopByCountry.js'), /'reviews'/);
assert.match(read('../App.jsx'), /<Route path="\/reviews" element=\{<ReviewsPage \/>\} \/>/);
assert.match(read('../App.jsx'), /<Route path="\/studio\/reviews"/);
assert.match(read('../App.jsx'), /<Route path="\/mobile\/studio\/reviews"/);

// Both Studio dashboards say when a review waits (25 Nov 2026) — and say nothing when none does.
const desk = read('../pages/DashboardPage.jsx');
assert.match(desk, /pendingReviews\.ready && pendingReviews\.count \?/);
assert.match(desk, /navigate\('\/studio\/reviews'\)/);
const phone = read('../pages/mobile/MobileDashboardPage.jsx');
assert.match(phone, /pendingReviews\.ready && pendingReviews\.count \?/);
assert.match(phone, /navigate\('\/mobile\/studio\/reviews'\)/);

// --- 7. The SQL (developer machine only — Vercel checks out apps/web alone) -----------------------------
const SQL = path.resolve(HERE, '../../../../supabase/manual/20261120090000_buyer_reviews.sql');
if (!fs.existsSync(SQL) || !fs.readFileSync(SQL, 'utf8').trim()) {
  noteSkip('supabase/manual is outside the build checkout, so the SQL half of buyerReviews runs on a developer machine only');
} else {
  const sql = fs.readFileSync(SQL, 'utf8');
  assert.match(sql, /status text not null default 'pending'/, 'every review starts waiting for Dekito');
  assert.match(sql, /where r\.status = 'published'/, 'the shop reads published reviews only');
  assert.match(sql, /o\.status in \('shipped', 'completed'\) or o\.shipment_status in \('shipped', 'delivered'\)/,
    'only shipped orders can be reviewed');
  assert.match(sql, /'vial hadiah'/, 'a free vial is a gift, not a purchase to review');
  assert.match(sql, /interval '30 days'/);
  assert.match(sql, /unique \(order_id, product_id\)/, 'one review per perfume per order');
  assert.match(sql, /revoke all on public\.storefront_reviews from anon, authenticated/);
  assert.match(sql, /revoke execute on function public\.storefront_submit_review\(uuid, uuid, integer, text, boolean\) from public, anon/);
  assert.match(sql, /\(o\.client_context ->> 'buyer_account'\) = caller::text/, 'the account that ordered is matched by the session, server-side');
  const publicView = sql.slice(sql.indexOf('create or replace view public.storefront_reviews_public'), sql.indexOf('create or replace view public.storefront_review_stats'));
  assert.doesNotMatch(publicView, /order_id|customer_id|auth_user_id|order_number|contact/, 'the public view carries no order or buyer data');
}

console.log('buyerReviews selfcheck OK');
