// `node src/utils/invoiceSaysNothingCustomsStops.selfcheck.mjs`
//
// A commercial invoice travels with the parcel, so what it calls the goods is read by an inspector and
// not only by the buyer. A shipment to the United States was held by Fish and Wildlife over the word
// "oud" — a word that reads, to someone holding a species list, like an Aquilaria extract. Nothing this
// shop ships contains it: the oud and the sandalwood are reconstructions and the musks are synthetic.
//
// So this guard asserts the three things that keep a parcel moving, and one that keeps a bank happy:
//   1. every goods line says what customs recognises, and nothing says what it stops;
//   2. the gift is FOC at zero, which is what a declaration expects of a sample;
//   3. the invoice makes no "shipping included" claim — that promise was retired on 2026-09-25, and
//      this document prints the freight as its own line, so the note would contradict the number;
//   4. the file lands between 5 KB and 5 MB, which is what a bank or PayPal upload accepts.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { jsPDF } from 'jspdf';
import { GIFT_VIAL_SIZE_ML, giftVialsFor } from './internationalGiftVials.js';
import {
  BOTTLE_CUSTOMS_DESCRIPTION, FORBIDDEN_CUSTOMS_WORDS, namesAForbiddenIngredient, vialCustomsDescription,
} from './invoiceCustomsText.js';
import { BRAND_PROFILE } from '../data/brandProfile.js';

const here = dirname(fileURLToPath(import.meta.url));
const shimPath = join(here, `.invoicePdf.selfcheck.${process.pid}.mjs`);

// The real module with its '@/' imports stripped and its collaborators stubbed on globalThis — the same
// harness shippingLabelLayout.selfcheck uses, for the same reason: reading the source is not running it.
writeFileSync(shimPath, `${readFileSync(join(here, 'invoicePdf.js'), 'utf8')
  .replace(/^import .*?;$/gm, '')
  .replace(/^export /gm, '')}\nexport { buildInvoicePdf };\n`);
globalThis.BRAND_PROFILE = BRAND_PROFILE;
globalThis.GIFT_VIAL_SIZE_ML = GIFT_VIAL_SIZE_ML;
globalThis.giftVialsFor = giftVialsFor;
globalThis.BOTTLE_CUSTOMS_DESCRIPTION = BOTTLE_CUSTOMS_DESCRIPTION;
globalThis.vialCustomsDescription = vialCustomsDescription;

const ORDER = {
  invoiceNumber: 'SOL-2026-005',
  orderNumber: 'DKT-MSSKNMSA',
  customerName: 'Buyer Name',
  deliveryAddress: '123 Example Street\nApartment 4\nCity, State 12345',
  contact: '+1 555 0100',
  email: 'buyer@example.com',
  paymentStatus: 'unpaid',
};
const LINES = [{ quantity: 1, unitUsd: 80 }, { quantity: 1, unitUsd: 95 }];

try {
  // --- Pass 1: a recorder, so every drawn string can be read ------------------------------------------
  const drawn = [];
  class Recorder {
    constructor() { this.internal = {}; }
    setFont() {} setFontSize() {} setTextColor() {} setDrawColor() {} setLineWidth() {}
    line() {} rect() {}
    text(value) { drawn.push(String(value)); }
    splitTextToSize(value) { return String(value).split('\n'); }
    output() { return ''; }
  }
  globalThis.jsPDF = Recorder;
  const { buildInvoicePdf } = await import(`file://${shimPath}`);
  buildInvoicePdf({ order: ORDER, lines: LINES, shipping: { usd: 40 }, whatsapp: '6287774026625' });
  const page = drawn.join('\n');
  assert.ok(drawn.length > 20, `only ${drawn.length} strings were drawn — the recorder caught nothing`);

  // 1. The goods are described the way customs reads them.
  assert.ok(page.includes(BOTTLE_CUSTOMS_DESCRIPTION), 'every bottle line carries the customs description');
  assert.equal(drawn.filter((row) => row === BOTTLE_CUSTOMS_DESCRIPTION).length, LINES.length,
    'one line per bottle line, each with that description');
  // And nothing anywhere on the page names something a species list would stop.
  assert.ok(!namesAForbiddenIngredient(page),
    `the invoice names a forbidden ingredient. Checked: ${FORBIDDEN_CUSTOMS_WORDS.join(', ')}`);
  // The perfume names are deliberately absent — "Aquilaria tuberosa" is one of the nineteen products,
  // and printing it would put a CITES genus in front of an inspector.
  for (const name of ['Aquilaria tuberosa', 'La Tulipe', 'Maskumambang']) {
    assert.ok(!page.includes(name), `${name} must not be printed on a document that travels with the parcel`);
  }

  // 2. The gift, at zero, labelled the way a declaration expects.
  assert.ok(page.includes(vialCustomsDescription(GIFT_VIAL_SIZE_ML)),
    `the gift line says "Perfume sample, ${GIFT_VIAL_SIZE_ML} ml"`);
  assert.equal(giftVialsFor(2), 5, 'two bottles ship five vials');
  assert.ok(drawn.includes('5'), 'and the quantity column says five');
  assert.ok(drawn.includes('FOC'), 'free of charge, not US$0 beside a gift');

  // 3. No claim this document must not make.
  for (const forbidden of [/shipping included/i, /ongkir termasuk/i, /freight included/i]) {
    assert.ok(!forbidden.test(page),
      `the invoice must not claim ${forbidden} — retired 2026-09-25, and the freight is a line above`);
  }
  assert.ok(/duties and taxes/i.test(page), 'it does say who pays the duties');
  assert.ok(/dangerous goods/i.test(page), 'and that it ships under the dangerous goods rules');
  assert.ok(page.includes('SOL-2026-005'), 'the invoice number is on it');
  assert.ok(page.includes('DKT-MSSKNMSA'), 'and the order number, as the buyer\'s reference');
  assert.ok(page.includes('Status: Unpaid'), 'an unpaid invoice says so');

  // The paid form carries the method, the date and the reference — the three things a bank asks for.
  drawn.length = 0;
  buildInvoicePdf({
    order: {
      ...ORDER, paymentStatus: 'paid', paymentMethod: 'Wise', paidAt: '2026-10-21', paymentReference: 'MTCN123',
    },
    lines: LINES,
    shipping: { usd: 40 },
  });
  const paid = drawn.join('\n');
  assert.match(paid, /Status: Paid · Wise · 2026-10-21 · MTCN123/, 'the paid status names method, date and reference');

  // 4. The real library, once, for the size a bank upload cares about.
  globalThis.jsPDF = jsPDF;
  const { buildInvoicePdf: buildReal } = await import(`file://${shimPath}?real`);
  const bytes = buildReal({ order: ORDER, lines: LINES, shipping: { usd: 40 }, whatsapp: '6287774026625' })
    .output('arraybuffer');
  assert.ok(bytes.byteLength >= 5 * 1024,
    `the PDF is ${bytes.byteLength} bytes; a bank upload wants at least 5 KB, which is why the mark is `
    + 'drawn rather than omitted');
  assert.ok(bytes.byteLength <= 5 * 1024 * 1024, `the PDF is ${(bytes.byteLength / 1024).toFixed(0)} KB, over the 5 MB ceiling`);

  // --- 5. The number comes from the database, once per order ----------------------------------------
  // Allocated by an RPC that updates and reads in one statement; a max()+1 in JavaScript would hand two
  // invoices generated in the same minute the same number, and both copies are already sent by then.
  const migration = readFileSync(
    join(here, '..', '..', '..', '..', 'supabase', 'migrations', '20261021140000_invoice_numbers.sql'), 'utf8',
  );
  assert.match(migration, /create table if not exists public\.storefront_invoice_counters/,
    'a counter per year, so 2027 does not start at 005');
  assert.match(migration, /values \(2026, 4\)/, 'seeded at 4 — SOL-2026-004 was the last one sent by hand');
  assert.match(migration, /update public\.storefront_invoice_counters[\s\S]*?returning last_number into v_next/,
    'the update and the read are one statement, which is what stops two callers taking one number');
  assert.match(migration, /lpad\(v_next::text, 3, '0'\)/, 'three digits: SOL-2026-005');
  assert.match(migration, /if not public\.is_admin\(\) then/, 'only Dekito may burn a number');
  assert.match(migration, /revoke all on function public\.storefront_next_invoice_number\(\) from anon/,
    'and anon may not call it at all');
  assert.match(migration, /create unique index[\s\S]*?invoice_number/,
    'the column is unique, so even a bug cannot write one number twice');

  const service = readFileSync(join(here, '..', 'services', 'invoiceNumberService.js'), 'utf8');
  assert.match(service, /if \(existing\) return existing;/,
    'reprinting an invoice reprints the same number rather than burning the next');
  assert.ok(!/max\(|order by .*desc/i.test(service), 'the client never derives the number itself');
  const detail = readFileSync(join(here, '..', 'pages', 'OrderDetailPage.jsx'), 'utf8');
  assert.match(detail, /onClick=\{exportInvoice\}/, 'the order screen offers the download');
  assert.match(detail, /allocateInvoiceNumber\(orderKey, order\?\.invoiceNumber/,
    'and passes the number the order already has, if it has one');

  console.log(`invoiceSaysNothingCustomsStops: ok (${(bytes.byteLength / 1024).toFixed(1)} KB, customs `
    + 'description on every line, no forbidden word, gift FOC, no shipping-included claim)');
} finally {
  try { unlinkSync(shimPath); } catch { /* already gone */ }
}
