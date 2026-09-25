// `node src/utils/shopClockBoundaries.selfcheck.mjs`
//
// SOLIVAGANT runs on Jakarta time, and the owner types dates meaning "that day, here". Audit round 7
// found that `${date}T23:59:59.999` is read in whatever zone the runtime happens to be in, and localDay.js
// was written to fix it: shopEndOfDay pins the instant with +07:00, and its header explains exactly why.
//
// The fix reached one caller. voucherValidation.js took it. Four other places kept their own copy of the
// same arithmetic — the shipping-promotion window, the voucher preview, and the Aktif/Expired badge on
// both voucher screens — and there is no version of this where those copies are harmless:
//
//   - getShippingPromotionEligibility decides whether shipping is FREE, and it runs in the buyer's
//     browser. A promo ending on the 25th was still running for a reader in Berlin four hours after
//     Jakarta's 25th was over, and started five hours late for them at the other end. The window the
//     shop typed was not the window anyone outside Indonesia got.
//   - the voucher badge said "Aktif" all through the expiry day on a code the checkout — which uses the
//     pinned parser — had already refused.
//
// Nothing could see it. Every copy is correct when the runtime IS in Jakarta, which is Dekito's laptop,
// so it reads right on the machine anyone would test it on.
//
// The rule: a date-only boundary belongs to the shop's clock, and there is exactly one implementation of
// it. Checked by RUNNING the real functions under two different process timezones and demanding the same
// instant, and by scanning disk so a sixth copy cannot appear quietly.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const utils = dirname(fileURLToPath(import.meta.url));
const src = utils.replace(/\/utils$/, '');
const root = join(src, '..');

// --- 1. The same date, judged from two different chairs -------------------------------------------------
// Run out of process, because a timezone is a property of the process and cannot be changed inside it.
// Jakarta is the shop; New York is eleven hours behind it and on the other side of midnight, which is the
// gap every one of these boundaries used to open.
const probe = `
import { getExpiryTime } from '${pathToFileURL(join(utils, 'voucherValidation.js')).href}';
import { getShippingPromotionEligibility } from '${pathToFileURL(join(utils, 'shippingPromotion.js')).href}';
const promo = { enabled: true, startsAt: '2026-09-20', endsAt: '2026-09-25' };
// 2026-09-25 20:00 UTC is already the 26th in Jakarta: the promo is over, wherever the reader sits.
const justAfter = Date.parse('2026-09-25T20:00:00Z');
// And 2026-09-19 20:00 UTC is already the 20th in Jakarta: it has started.
const justAfterStart = Date.parse('2026-09-19T20:00:00Z');
console.log(JSON.stringify({
  expiry: getExpiryTime('2026-09-25'),
  ended: getShippingPromotionEligibility(promo, 0, justAfter).eligible,
  started: getShippingPromotionEligibility(promo, 0, justAfterStart).eligible,
}));
`;

const readClock = (timeZone) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', probe], {
  env: { ...process.env, TZ: timeZone },
  encoding: 'utf8',
}));

const jakarta = readClock('Asia/Jakarta');
const newYork = readClock('America/New_York');

assert.equal(jakarta.expiry, newYork.expiry,
  'a voucher expiring on a given date expires at a different moment depending on where the browser is — '
  + 'the checkout uses the pinned parser, so the screens that disagree are telling the owner a code is '
  + 'live after it has started being refused');
assert.deepEqual(newYork, jakarta,
  `the shipping promotion window opens and closes at different moments for different readers: Jakarta `
  + `${JSON.stringify(jakarta)} vs New York ${JSON.stringify(newYork)}. This one decides whether shipping `
  + 'is free, and it runs in the buyer\'s browser');
// And the window really is closed at that instant — otherwise the two agreeing proves nothing.
assert.equal(jakarta.ended, false, 'the promo must be over once Jakarta is past its last day');
assert.equal(jakarta.started, true, 'and running once Jakarta has reached its first');
assert.ok(Number.isFinite(jakarta.expiry), 'the expiry must resolve to a real instant');

// --- 2. One implementation, found by walking the tree ---------------------------------------------------
// The copies were identical arithmetic in five files. Listing the four to fix is how a fifth appears.
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx|mjs)$/.test(entry.name) && !entry.name.includes('.selfcheck.')) files.push(full);
  }
};
walk(join(root, 'src'));
walk(join(root, 'api'));

const BOUNDARY = /T23:59:59|T00:00:00/;
const owners = files.filter((file) => BOUNDARY.test(readFileSync(file, 'utf8')));
assert.deepEqual(owners.map((file) => file.slice(root.length + 1)), ['src/utils/localDay.js'],
  'a file other than localDay.js builds the end or start of a calendar day itself. Whatever zone that '
  + 'runtime is in becomes the shop\'s zone for that one check, and it will read correctly on a laptop in '
  + 'Jakarta while being wrong for everyone else. Use shopEndOfDay / shopStartOfDay');

// localDay.js pins both ends to the shop, not to the reader.
const clock = readFileSync(join(utils, 'localDay.js'), 'utf8');
for (const name of ['shopEndOfDay', 'shopStartOfDay']) {
  const line = clock.split('\n').find((text) => text.includes(`export const ${name}`));
  assert.ok(line, `${name} is gone from the shop's clock`);
  assert.match(line, /SHOP_UTC_OFFSET/,
    `${name} no longer pins the instant to the shop's zone, which makes it the same bug with a nicer name`);
}

console.log(`shopClockBoundaries selfcheck OK (one implementation, and Jakarta and New York agree on when `
  + 'a promo window opens, closes, and when a voucher expires)');
