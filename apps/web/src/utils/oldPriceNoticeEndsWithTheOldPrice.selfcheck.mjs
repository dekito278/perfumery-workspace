// `node src/utils/oldPriceNoticeEndsWithTheOldPrice.selfcheck.mjs`
//
// "Harga lama berlaku sampai 11.11" must stop being true the second it stops being true.
//
// The notice and the price change are two different mechanisms — a date in JavaScript and an
// effective_at in Postgres — and the failure they invite is the banner still promising the old price
// after the new one has started being charged. So the switch instant is written ONCE on this side, and
// this guard asserts the migration's rows carry that same instant.
//
// The brief also says: domestic only, and no percentage. The dollar prices are not moving, so telling an
// overseas visitor that current prices hold announces a change that never reaches them; and printing the
// size of a rise invites everyone to wait for the deadline and then feel the number.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { PRICE_NOTICE_FROM, PRICE_SWITCH_AT, priceNoticeIsDue } from './priceChangeNotice.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(src, '..');

// --- 1. The window, to the second --------------------------------------------------------------------
const due = (asOf, region = 'id') => priceNoticeIsDue({ asOf, region });
assert.equal(due('2026-10-31T23:59:59+07:00'), false, 'not up before 1 Nov');
assert.equal(due('2026-11-01T00:00:00+07:00'), true, 'up at the start of 1 Nov');
assert.equal(due('2026-11-11T23:59:59+07:00'), true, 'still up on the last day the old price holds');
assert.equal(due(PRICE_SWITCH_AT), false, 'DOWN at the instant the prices change, not a minute after');
assert.equal(due('2026-11-12T00:00:01+07:00'), false, 'and stays down');
assert.equal(due('2027-11-05T00:00:00+07:00'), false, 'and does not come back next year');

// --- 2. Domestic only --------------------------------------------------------------------------------
assert.equal(due('2026-11-05T00:00:00+07:00', 'en'), false,
  'the English shop must not see it: the dollar prices are not changing');
assert.equal(due('2026-11-05T00:00:00+07:00', 'id'), true, 'the Indonesian shop does');
for (const region of [undefined, null, '', 'xx']) {
  assert.equal(priceNoticeIsDue({ asOf: '2026-11-05T00:00:00+07:00', region }), true,
    `an unknown region (${JSON.stringify(region)}) is treated as the domestic shop, which is the default`);
}

// --- 3. One instant, not two copies ------------------------------------------------------------------
// The JS constant and the SQL rows must name the same moment. This is the assertion the whole file
// exists for: the day those two drift, the banner lies.
const migration = readFileSync(
  join(web, '..', '..', 'supabase', 'migrations', '20261021090000_scheduled_domestic_prices.sql'), 'utf8',
);
// Read from the INSERT rows and nowhere else. The first attempt matched `effective_at = '...'` anywhere
// in the file and picked up the comment that shows how to POSTPONE the change — 2026-11-19 — so the
// guard failed on a date that is only an example. The rows are the only statement of fact here.
const insertBlock = migration.slice(migration.indexOf('insert into public.storefront_price_schedule'));
const values = insertBlock.slice(0, insertBlock.indexOf('on conflict'));
const instants = [...new Set([...values.matchAll(/'(\d{4}-\d\d-\d\d[ T][\d:+.-]+)'/g)].map((m) => m[1]))];
assert.equal(instants.length, 1,
  `the scheduled rows name ${instants.length} different instants (${instants.join(', ')}) — every row of `
  + 'one price change switches together or the shop charges two prices at once');
const [sqlInstant] = instants;
assert.equal(new Date(sqlInstant).getTime(), new Date(PRICE_SWITCH_AT).getTime(),
  `the notice ends at ${PRICE_SWITCH_AT} but the schedule switches at ${sqlInstant} — one of them is `
  + 'wrong, and whichever it is, the shop promises a price it is not charging');
assert.ok(new Date(PRICE_NOTICE_FROM).getTime() < new Date(PRICE_SWITCH_AT).getTime(),
  'the notice starts before it ends');

// --- 4. What it says, and what it must not say -------------------------------------------------------
const id = MESSAGES.id['price.oldPricesHold'];
const en = MESSAGES.en['price.oldPricesHold'];
assert.ok(id && en, 'the notice text exists in both shops, even though only one of them renders it');
assert.notEqual(id, en, 'and is translated, so the pairing guard is not satisfied by a copy');
for (const [language, text] of [['id', id], ['en', en]]) {
  assert.doesNotMatch(text, /%|persen|percent|diskon|discount/i,
    `${language}: no percentage and no word for one — the brief is explicit, and a shop that prints the `
    + 'size of a coming rise invites everyone to wait for the deadline');
  assert.match(text, /11\.11/, `${language}: names the deadline the way Dekito writes it`);
}

// --- 5. Mounted where every storefront screen passes through -----------------------------------------
// Two surfaces, because the shop has two: the desktop pages share PublicHeader and the phone screens sit
// in MobileCommerceLayout. A notice on one of them is a notice half the buyers never see.
for (const [file, label] of [
  [join(src, 'components', 'storefront', 'PublicHeader.jsx'), 'the desktop header'],
]) {
  assert.match(readFileSync(file, 'utf8'), /<PriceChangeNotice\b/,
    `${label} must render the notice, or half the shop never sees it`);
}
// And the component itself asks the shared predicate rather than re-deriving the dates.
const component = readFileSync(join(src, 'components', 'storefront', 'PriceChangeNotice.jsx'), 'utf8');
assert.match(component, /priceNoticeIsDue\(\{ region \}\)/,
  'the component asks the one predicate; a second copy of the window is a second thing to get wrong');
assert.doesNotMatch(component, /2026-11/, 'and holds no date of its own');

console.log('oldPriceNoticeEndsWithTheOldPrice: ok (1-11 Nov WIB, domestic only, no percentage, and the '
  + 'notice ends at the same instant the schedule switches)');
