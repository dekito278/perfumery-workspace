// `node src/utils/publicTrackingVocabulary.selfcheck.mjs`
//
// /track/<orderNumber> is the page the QR printed on every parcel points at, and the link every tracking
// message carries. It prints three statuses — the order's, the payment's, and the shipment's — through
// one map, and anything the map has no key for is printed RAW:
//
//     statusKeys[value] ? t(statusKeys[value]) : String(value).replace(/_/g, ' ')
//
// Measured 29 Sep 2026: the map covered eleven values and the three vocabularies behind it hold sixteen.
// "Selesai" — the normal end state of every fulfilled order, one click away in Studio's status select —
// came out as the English token "completed". So did "expired", "failed", "refunded" and "not ready".
//
// The rule is not "these sixteen keys". It is: every status the owner can SET is a status this page can
// SAY, in both languages. The subject is read from the three label maps the Studio selects are built
// from, so a status added to any of them fails here rather than reaching a buyer as a raw word.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

// The owner's own vocabularies, parsed out of the modules that define them — orderService reaches
// supabase, so it is read rather than imported.
const objectKeys = (source, name) => {
  const body = source.match(new RegExp(`${name} = \\{([\\s\\S]*?)\\n\\};`));
  assert.ok(body, `could not find ${name} — this guard's parse is broken, not the vocabulary`);
  return [...body[1].matchAll(/^\s*(\w+):/gm)].map((match) => match[1]);
};

const orderService = read('services', 'orderService.js');
const VOCABULARIES = {
  'order status': objectKeys(orderService, 'const orderStatusLabels'),
  'shipment status': objectKeys(orderService, 'const shipmentStatusLabels'),
  'payment status': objectKeys(read('utils', 'orderWorkflow.js'), 'export const paymentStatusLabels'),
};
for (const [what, values] of Object.entries(VOCABULARIES)) {
  assert.ok(values.length >= 4, `only ${values.length} ${what} values parsed — the parse is broken`);
}

// Studio really does offer all of them: both order-detail screens build their selects straight from the
// label maps, which is why every value in them is one click away rather than theoretical.
for (const screen of ['pages/OrderDetailPage.jsx', 'pages/mobile/MobileOrderDetailPage.jsx']) {
  const source = read(...screen.split('/'));
  assert.match(source, /Object\.entries\((?:statusLabels|paymentStatusLabels)\)\.map/,
    `${screen} no longer builds its status select from the label map — re-derive this guard's premise`);
}

const page = read('pages', 'PublicTrackingPage.jsx');
const mapBody = page.match(/const statusKeys = \{([\s\S]*?)\n\};/);
assert.ok(mapBody, 'the tracking page must still map statuses to message keys');
const statusKeys = Object.fromEntries(
  [...mapBody[1].matchAll(/^\s*(\w+):\s*'([^']+)'/gm)].map((match) => [match[1], match[2]]),
);

// RUN the page's own renderer, lifted from the file, rather than reasoning about the map. A raw token is
// what a buyer actually sees, so a raw token is what this has to catch.
const rendererBody = page.match(/const formatStatus = \(value, t, fallback = '-'\) => \{([\s\S]*?)\n\};/);
assert.ok(rendererBody, "could not read the page's formatStatus to run it — update this guard");
// The page's own function, read from the file and run exactly as written.
const formatStatus = new Function('statusKeys', `return (value, t, fallback = '-') => {${rendererBody[1]}\n};`)(statusKeys);

const missing = [];
for (const [what, values] of Object.entries(VOCABULARIES)) {
  for (const value of values) {
    for (const language of ['id', 'en']) {
      const rendered = formatStatus(value, (key) => MESSAGES[language][key]);
      if (!statusKeys[value] || !MESSAGES[language][statusKeys[value]] || rendered === value.replace(/_/g, ' ')) {
        missing.push(`${what} "${value}" (${language}) renders as "${rendered}"`);
      }
    }
  }
}
assert.deepEqual(
  missing,
  [],
  'the parcel QR points at this page, and these statuses reach the buyer as a raw English token instead '
  + `of a sentence:\n  ${missing.join('\n  ')}\n`
  + 'Add the value to statusKeys in PublicTrackingPage.jsx and its message to BOTH languages.',
);

const covered = Object.values(VOCABULARIES).flat().length;
assert.ok(covered >= 16, `only ${covered} statuses checked — the vocabularies were lost`);
console.log(`publicTrackingVocabulary selfcheck OK (${covered} statuses across 3 Studio vocabularies, every one of them a sentence on the parcel's own page, in both languages)`);
