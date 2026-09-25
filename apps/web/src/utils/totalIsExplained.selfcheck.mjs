// `node src/utils/totalIsExplained.selfcheck.mjs`
//
// An order's total is products, minus whatever a voucher took off, plus freight. Studio showed the
// breakdown in exactly two places — OrdersPage and OrderDetailPage — and both hung the whole section on
// `voucherSnapshot`, returning null without one.
//
// The shipping line lives inside that section. So the freight was visible only on orders that happened
// to carry a voucher code, and on every ordinary order Studio showed one figure and no way to explain
// it. The section was named for the condition it was gated on rather than the question it answers.
//
// The phone showed neither. MobileOrderDetailPage — the screen Dekito actually opens before packing —
// read "3 item / Rp 289.000" and nothing else. MobileOrdersPage did print a voucher row, which made it
// worse than silence: the lines above it did not add up to the figure beside them, because the missing
// term was never named.
//
// The rule: wherever a total is shown next to the things that make it up, the freight is one of them.
// Both halves derived — the arithmetic is RUN against the real helpers, and the screens are found on
// disk rather than listed.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

const totalsSource = readFileSync(join(src, 'utils', 'orderTotals.js'), 'utf8')
  .replace(/'@\//g, `'${pathToFileURL(src).href}/`);
const { getOrderProductsSubtotal, getOrderSubtotalAfterVoucher, getOrderShippingFee } = await import(
  `data:text/javascript;base64,${Buffer.from(totalsSource, 'utf8').toString('base64')}`
);

// --- 1. The arithmetic these screens print, run ---------------------------------------------------------
const plain = {
  subtotal: 514000,
  items: [{ priceNumber: 359000, quantity: 1 }, { priceNumber: 130000, quantity: 1 }],
};
assert.equal(getOrderProductsSubtotal(plain), 489000, 'products are the lines added up');
assert.equal(getOrderShippingFee(plain), 25000,
  'freight is what the total carries beyond the products — an ordinary order with no voucher, which is '
  + 'exactly the case the old gate hid');
assert.equal(getOrderSubtotalAfterVoucher(plain), 489000, 'with no voucher, nothing comes off');

const withVoucher = {
  subtotal: 478000,
  items: [{ priceNumber: 359000, quantity: 1 }, { priceNumber: 130000, quantity: 1 }],
  voucherSnapshot: { code: 'SOLI10', discountAmount: 36000, subtotalBeforeDiscount: 489000, subtotalAfterDiscount: 453000 },
};
assert.equal(getOrderShippingFee(withVoucher), 25000, 'the discount is not mistaken for freight');
assert.equal(
  getOrderSubtotalAfterVoucher(withVoucher) + getOrderShippingFee(withVoucher),
  withVoucher.subtotal,
  'the parts must add up to the total, or the screen showing them is lying about one of them',
);

// An order read through the anon payment lookup has a total and no items. Calling the difference
// "shipping" there would print "Subtotal produk Rp 0 / Ongkir Rp 225.000" — the helper already refuses,
// and this is the assertion that keeps it refusing.
assert.equal(getOrderShippingFee({ subtotal: 225000 }), 0,
  'with no items to subtract, the whole total is not freight');

// --- 2. Every screen that shows an order total shows the freight in it -----------------------------------
const screens = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) screens.push(full);
  }
};
walk(join(src, 'pages'));

// Found, not listed: a Studio order screen is one that renders an order's own total beside its status
// controls. The public-facing screens are a different conversation — a buyer is shown shipping at
// checkout and on the invoice — so they are matched out by their lack of the Studio status control.
const orderScreens = screens.filter((file) => {
  const text = readFileSync(file, 'utf8');
  return /formatTotal\(order\.subtotal\)/.test(text) && /statusLabels\[order\.status\]/.test(text);
});
assert.ok(orderScreens.length >= 4,
  `expected the four Studio order screens, found ${orderScreens.length} — the scan is broken, not the code`);
assert.ok(orderScreens.some((file) => file.includes(join('pages', 'mobile'))),
  'no phone order screen was found, and the phone was the half that showed nothing');

for (const file of orderScreens) {
  const where = file.slice(src.length + 1);
  const text = readFileSync(file, 'utf8');
  assert.match(text, /getOrderShippingFee\(/,
    `${where} shows an order total without ever naming the freight inside it. A total nobody can take `
    + 'apart is a total nobody can defend when a customer asks');
  // And not gated behind a voucher. The bug was never a missing line; it was a line that only appeared
  // when an unrelated condition happened to be true.
  //
  // Checked by BALANCING the braces of each `{voucherSnapshot ? … }` expression, not by a window of
  // characters after it. A window reported MobileOrderDetailPage as gated when its voucher line and its
  // freight line are adjacent siblings — the match simply ran past `: null}` into the next block. The
  // same lazy-window mistake this repo has now made in three different guards.
  for (const start of [...text.matchAll(/\{voucherSnapshot \?/g)].map((found) => found.index)) {
    let depth = 0;
    let index = start;
    while (index < text.length) {
      if (text[index] === '{') depth += 1;
      else if (text[index] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }
    const branch = text.slice(start, index + 1);
    assert.doesNotMatch(branch, /getOrderShippingFee\(/,
      `${where} shows the freight only when a voucher was used. Most orders have no voucher and do have `
      + 'shipping, so this is exactly the case it hides');
  }
  // The other shape of the same bug: a whole breakdown component that bails out without a voucher.
  assert.doesNotMatch(text, /if \(!voucherSnapshot\) return null;/,
    `${where} still returns nothing when no voucher applied, and the freight line is inside what it `
    + 'refuses to render');
}

console.log(`totalIsExplained selfcheck OK (${orderScreens.length} Studio order screens, every one naming `
  + 'the freight inside the total it prints)');
