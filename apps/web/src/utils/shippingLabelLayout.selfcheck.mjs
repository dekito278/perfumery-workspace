// `node src/utils/shippingLabelLayout.selfcheck.mjs`
//
// The QR block is pinned to the bottom of the A6 label. The bespoke brief above it used to be drawn by a
// loop with no bound, so a long aroma ran straight through the box: the printed label had the note list
// overlapping the order number, cut mid-word, exactly as it came off the owner's phone.
//
// This renders a real label with a deliberately long brief and reads the text positions back out of the
// PDF, so it measures where the ink lands rather than trusting the source to look careful.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

const here = dirname(fileURLToPath(import.meta.url));
const modulePath = join(here, 'shippingLabelPdf.js');
const shimPath = join(here, `.shippingLabel.selfcheck.${process.pid}.mjs`);

// Load the real module with its '@/' imports stripped and the two it needs stubbed on globalThis.
writeFileSync(shimPath, `${readFileSync(modulePath, 'utf8')
  .replace(/^import .*?;$/gm, '')
  .replace(/^export /gm, '')}\nexport { drawShippingLabel, QR_BLOCK_TOP, PAGE_HEIGHT };\n`);

globalThis.jsPDF = jsPDF;
globalThis.QRCode = QRCode;
globalThis.buildPublicTrackingUrl = (n) => `https://www.solivagantscent.com/track/${n}`;
globalThis.getOrderNoteField = (notes, field) => ({
  Address: 'Jl. Studento No.6 Blok C2 Lantai 3 Unit 3A, Kompleks Permata Hijau Residence, Pagedangan, '
    + 'Kec. Pagedangan, Kabupaten Tangerang, Banten 15339',
  Area: 'PAGEDANGAN, PAGEDANGAN, TANGERANG, BANTEN, 15339',
  Shipping: 'JnT Reguler / Rp 9.000',
}[field]);

const { drawShippingLabel, QR_BLOCK_TOP, PAGE_HEIGHT } = await import(shimPath);
unlinkSync(shimPath);

const doc = new jsPDF({ unit: 'mm', format: 'a6', orientation: 'portrait' });
await drawShippingLabel(doc, {
  orderNumber: 'DKT-MTI5UDHE-X4BE65',
  customerName: 'Kelvin Wiranata Sati',
  contact: '085274374098',
  courierName: 'JnT Reguler / Rp 9.000',
  updatedAt: '2026-09-07T01:01:00+07:00',
  items: [{
    type: 'bespoke_request',
    perfumeName: 'Youzu 08',
    size: '30 ml',
    bottleType: 'Classic',
    capDesign: 'Cap custom Abstrak',
    labelDesign: 'Tulis tangan',
    exoticMaterial: 'Oud Kalimantan tua',
    preferredNotes: 'Top: yuzu, pink pepper, mandarin orange, green tea, bergamot, neroli. '
      + 'Mid: hinoki, lily of the valley, green hojari, oolong tea, bamboo, cypress, cardamom, jasmine. '
      + 'Base: white musk, cedarwood, vetiver, ambergris, sandalwood, tonka, labdanum, benzoin.',
  }],
});

const PT_PER_MM = 72 / 25.4;
const pdf = Buffer.from(doc.output('arraybuffer')).toString('latin1');

// jsPDF writes uncompressed streams. A block is "<x> <y> Td" then "(text) Tj", and every line after the
// first is "T* (text) Tj" — a newline of `TL` leading. A regex that only reads Td misses exactly the
// lines that overflow, which is the whole point of this check, so walk the operators instead.
const placed = [];
let leading = 0;
let cursorY = null;
const OPERATOR = /(-?[\d.]+)\s+TL|(-?[\d.]+)\s+(-?[\d.]+)\s+Td|(T\*)|\(((?:\\.|[^)])*)\)\s*Tj/g;
for (const match of pdf.matchAll(OPERATOR)) {
  const [, tl, , td, star, text] = match;
  if (tl !== undefined) leading = Number(tl);
  else if (td !== undefined) cursorY = Number(match[3]);
  else if (star !== undefined && cursorY !== null) cursorY -= leading;
  else if (text !== undefined && cursorY !== null) {
    placed.push({
      mmFromTop: (PAGE_HEIGHT * PT_PER_MM - cursorY) / PT_PER_MM,
      text: text.replace(/\\([()\\])/g, '$1'),
    });
  }
}

assert.ok(placed.length > 8, `only ${placed.length} text runs found — the PDF parse broke, not the layout`);

// What the QR block is allowed to contain. Everything else belongs above it.
const BELONGS_IN_QR_BLOCK = /^(DKT-|Scan QR|www\.|https?:)/;
const intruders = placed
  .filter((run) => run.mmFromTop > QR_BLOCK_TOP && run.text.trim() && !BELONGS_IN_QR_BLOCK.test(run.text.trim()))
  .map((run) => `${run.mmFromTop.toFixed(1)}mm: "${run.text.trim().slice(0, 48)}"`);

assert.deepEqual(
  intruders,
  [],
  `text was drawn inside the QR block (below ${QR_BLOCK_TOP}mm), which prints as an overlap:\n  `
  + `${intruders.join('\n  ')}\n`
  + 'The brief must stop at BRIEF_BOTTOM and mark itself cut, not keep writing down the page.',
);

// And the cut has to be announced — a sentence that simply stops mid-word is what started this.
assert.ok(
  placed.some((run) => run.text.includes('dipotong')),
  'this brief is far too long to fit, so the label must say it was cut',
);

console.log(`shippingLabelLayout selfcheck OK (${placed.length} text runs, none below ${QR_BLOCK_TOP}mm)`);
