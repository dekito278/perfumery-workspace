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
// The shipping note fields, swappable per render: the second bug in this file lives in how a LONG
// destination wraps, and a stub that always answers the same short one cannot reach it.
let NOTE_FIELDS = {
  Address: 'Jl. Studento No.6 Blok C2 Lantai 3 Unit 3A, Kompleks Permata Hijau Residence, Pagedangan, '
    + 'Kec. Pagedangan, Kabupaten Tangerang, Banten 15339',
  Area: 'PAGEDANGAN, PAGEDANGAN, TANGERANG, BANTEN, 15339',
  Shipping: 'JnT Reguler / Rp 9.000',
};
globalThis.getOrderNoteField = (notes, field) => NOTE_FIELDS[field];

const { drawShippingLabel, QR_BLOCK_TOP, PAGE_HEIGHT } = await import(shimPath);
unlinkSync(shimPath);

const PT_PER_MM = 72 / 25.4;

// jsPDF writes uncompressed streams. A block is "<x> <y> Td" then "(text) Tj", and every line after the
// first is "T* (text) Tj" — a newline of `TL` leading. A regex that only reads Td misses exactly the
// lines that overflow, which is the whole point of this check, so walk the operators instead.
//
// The font size and the horizontal rules are read too, because the second failure this file found was
// not a text run in the wrong place: it was a DIVIDER ruled straight through a correctly placed one.
// A scratch document purely as a ruler: jsPDF is the only thing that knows how wide its own Helvetica
// renders, and a hand-rolled character-width guess is how a check like this starts crying wolf.
const ruler = new jsPDF({ unit: 'pt', format: 'a6' });
const PAGE_WIDTH_MM = 105;
const MARGIN_MM = 8;

function parseLabel(doc) {
  const pdf = Buffer.from(doc.output('arraybuffer')).toString('latin1');
  const placed = [];
  const rules = [];
  let leading = 0;
  let cursorY = null;
  let size = 9;
  let cursorX = null;
  let font = 'normal';
  const OPERATOR = /\/(F\d+)\s+(-?[\d.]+)\s+Tf|(-?[\d.]+)\s+TL|(-?[\d.]+)\s+(-?[\d.]+)\s+m\b|(-?[\d.]+)\s+(-?[\d.]+)\s+Td|(T\*)|\(((?:\\.|[^)])*)\)\s*Tj/g;
  const mm = (pt) => (PAGE_HEIGHT * PT_PER_MM - pt) / PT_PER_MM;
  for (const match of pdf.matchAll(OPERATOR)) {
    const [, fontRef, tf, tl, , moveY, tdX, tdY, star, text] = match;
    if (tf !== undefined) { size = Number(tf); font = fontRef === 'F2' ? 'bold' : 'normal'; }
    else if (tl !== undefined) leading = Number(tl);
    else if (moveY !== undefined) rules.push(mm(Number(moveY)));
    else if (tdY !== undefined) { cursorX = Number(tdX); cursorY = Number(tdY); }
    else if (star !== undefined && cursorY !== null) cursorY -= leading;
    else if (text !== undefined && cursorY !== null) {
      const body = text.replace(/\\([()\\])/g, '$1');
      ruler.setFont('helvetica', font);
      ruler.setFontSize(size);
      placed.push({
        xMm: cursorX / PT_PER_MM,
        widthMm: ruler.getTextWidth(body) / PT_PER_MM,
        mmFromTop: mm(cursorY),
        sizeMm: size / PT_PER_MM,
        text: body,
      });
    }
  }
  return { placed, rules };
}

const readLabel = async (order, notes = null) => {
  const previous = NOTE_FIELDS;
  if (notes) NOTE_FIELDS = { ...NOTE_FIELDS, ...notes };
  const doc = new jsPDF({ unit: 'mm', format: 'a6', orientation: 'portrait' });
  await drawShippingLabel(doc, order);
  NOTE_FIELDS = previous;
  return parseLabel(doc);
};

const { placed, rules } = await readLabel({
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
    capDesign: 'Cap custom Abstrak dengan ukiran tangan dan finishing kuningan gelap',
    labelDesign: 'Tulis tangan',
    // Long enough to overrun the block on its own. The scent composition is deliberately not printed on
    // the label any more, so the overflow has to come from a field that still is.
    exoticMaterial: 'Oud Kalimantan tua potongan besar, ambergris grey Selat Madura, musk deer '
      + 'substitute sintetis premium, resin benzoin Siam, sandalwood Mysore tua, tonka bean Venezuela, '
      + 'orris butter Firenze, saffron Kashmir pilihan, dan hyraceum Afrika Selatan.',
  }],
});

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

// --- A block that wraps must push the next one down -------------------------------------------------
//
// The check above measures ONE boundary — the QR block — because that is where the first bug landed. The
// second one landed nowhere near it.
//
// `KIRIM KE` (13.5pt) and the destination area (9.2pt) were both drawn as wrapped text and then stepped
// over with a CONSTANT: `y += 9` and `y += 6.5`, each enough for a single line. The address between them
// already advanced by `lines.length`, which is why nobody noticed the other two did not.
//
// Measured on a real destination taken from the checkout's own search, before the fix: the area wrapped
// to three lines and the divider was ruled through the third at 67.5mm — a line struck through the
// postcode on the courier's copy of the label.
{
  const long = await readLabel({
    orderNumber: 'DKT-MU9L5XW2-JNBGGD',
    // Three lines at 13.5pt. Two was not enough to reach the bug: the constant step happened to leave
    // just enough room for a second line, so a two-line fixture passed while the defect was live.
    customerName: 'Muhammad Alief Ferdiansyah Nugroho Wibowo Kusumaningrat Hardjodipuro Notonegoro',
    contact: '087774026625',
    courierName: 'JNE Reguler / Rp 10.000',
    updatedAt: '2026-09-20T16:00:00+07:00',
    quantity: 1,
    items: [{ name: 'HUG N 1', size: '30 ml', quantity: 1 }],
  }, {
    // A real destination, straight out of the checkout's own search. Spelling the province out is what
    // takes it to three lines — and three is where the divider used to land.
    Area: 'KUTA RAJA SIMPANG TIGA, BANDA ACEH DARUSSALAM, KABUPATEN ACEH BESAR, '
      + 'NANGGROE ACEH DARUSSALAM (NAD), 23111',
  });

  assert.ok(long.rules.length >= 2, `expected the dividers to be drawn; found ${long.rules.length}`);

  // A rule inside a line's ink is a strikethrough. 0.72 above the baseline is the cap height, 0.18 below
  // it the descender — the band a reader sees as "the text".
  const struck = long.placed.flatMap((run) => {
    const top = run.mmFromTop - run.sizeMm * 0.72;
    const bottom = run.mmFromTop + run.sizeMm * 0.18;
    return long.rules
      .filter((rule) => rule > top && rule < bottom)
      .map((rule) => `"${run.text.trim().slice(0, 46)}" (${top.toFixed(1)}-${bottom.toFixed(1)}mm) crossed by the divider at ${rule.toFixed(1)}mm`);
  });
  assert.deepEqual(struck, [],
    `a divider is ruled through printed text — a block wrapped and the next one did not move down:\n  ${struck.join('\n  ')}`);

  // And the same failure with no divider in sight: the name wrapping ONTO the phone number. Held as
  // "nothing printed overlaps anything else printed" rather than as a list of pairs — the first version
  // of this named the name lines by their words, and the third line said "Notonegoro", which none of the
  // words matched. It read the SECOND line as the last one and called the overlap fine.
  const ink = (run) => ({
    top: run.mmFromTop - run.sizeMm * 0.72,
    bottom: run.mmFromTop + run.sizeMm * 0.18,
    left: run.xMm,
    right: run.xMm + run.widthMm,
  });
  const overlaps = [];
  for (let i = 0; i < long.placed.length; i += 1) {
    for (let j = i + 1; j < long.placed.length; j += 1) {
      const a = ink(long.placed[i]);
      const b = ink(long.placed[j]);
      // Real overlap in BOTH directions. Two columns sharing a baseline (KURIR / NOMOR RESI) are side by
      // side, not on top of each other, and a check that ignores x calls them a collision forever.
      if (a.top < b.bottom - 0.15 && b.top < a.bottom - 0.15
        && a.left < b.right - 0.3 && b.left < a.right - 0.3) {
        overlaps.push(`"${long.placed[i].text.trim().slice(0, 34)}" over "${long.placed[j].text.trim().slice(0, 34)}"`);
      }
    }
  }
  assert.deepEqual(overlaps, [],
    `two printed runs sit on top of each other — a block wrapped and the next one did not move down:\n  ${overlaps.join('\n  ')}`);

  // Nothing may leave the label either. Wrapping is what keeps a long destination inside the 105mm, so
  // dropping splitTextToSize looks harmless to every vertical check above while the text runs off the
  // right edge and the courier reads half a postcode.
  const spilled = long.placed
    .filter((run) => run.xMm < MARGIN_MM - 0.5 || run.xMm + run.widthMm > PAGE_WIDTH_MM - MARGIN_MM + 0.5)
    .map((run) => `"${run.text.trim().slice(0, 44)}" ends at ${(run.xMm + run.widthMm).toFixed(1)}mm`);
  assert.deepEqual(spilled, [],
    `text runs past the label's ${MARGIN_MM}mm margin:\n  ${spilled.join('\n  ')}`);
}

console.log(`shippingLabelLayout selfcheck OK (${placed.length} text runs clear of the QR block, and no divider struck through a wrapped block)`);
