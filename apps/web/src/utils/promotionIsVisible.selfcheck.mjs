// `node src/utils/promotionIsVisible.selfcheck.mjs`
//
// applyShippingPromotionToRates rewrites each courier rate before any screen sees it: cost comes down,
// and the rate carries originalCost, promotionApplied and promotionLabel so the screen can say what
// happened.
//
// The phone checkout says all of it — the original struck through, the promo named on the rate, and
// named again under the chosen one. The desktop checkout said none of it. It rendered
// `{rate.service} / {formatTotal(rate.cost)}` and nothing else, so a buyer during a free-shipping
// promotion saw a lower number with no reason attached and never learned there was a promotion at all.
// The desktop bespoke page named the promo but never showed what the shipping had been.
//
// That is a discount given away twice: once in money, once in the reason to remember the shop for it.
// A promotion nobody can see is only a price cut.
//
// The rule: a screen that shows a promoted rate shows that it was promoted. Both halves derived — the
// promotion is RUN over real rate shapes, and the screens are found on disk by the fact that they render
// a courier rate at all.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Buffer } from 'node:buffer';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

const source = readFileSync(join(src, 'utils', 'shippingPromotion.js'), 'utf8')
  .replace(/^import\b[\s\S]*?from '[^']+';\n/gm, '');
const stubs = "const shopEndOfDay = (date) => `${date}T23:59:59.999+07:00`;\n"
  + "const shopStartOfDay = (date) => `${date}T00:00:00.000+07:00`;\n";
const { applyShippingPromotionToRates } = await import(
  `data:text/javascript;base64,${Buffer.from(stubs + source, 'utf8').toString('base64')}`
);

// --- 1. The rate really does carry its own explanation ---------------------------------------------------
const settings = { enabled: true, preset: 'free_all', minimumSubtotal: 0 };
const rates = [{ courierCode: 'jne', service: 'REG', cost: 22000 }];
const [promoted] = applyShippingPromotionToRates(rates, { province: 'Jawa Barat', city: 'Bandung' }, settings, { subtotal: 500000 });

assert.equal(promoted.cost, 0, 'a free-shipping promotion brings the cost to zero');
assert.equal(promoted.originalCost, 22000, 'and keeps what it was, which is the only way a screen can show it');
assert.equal(promoted.promotionApplied, true);
assert.ok(promoted.promotionLabel, 'a promotion with no label cannot be named on screen');
assert.equal(promoted.promotionSavings, 22000, 'and says what came off');

// Nothing invented when no promotion runs: a screen that struck through a price here would be lying
// about a discount that never happened.
const [plain] = applyShippingPromotionToRates(rates, { province: 'Jawa Barat' }, { enabled: false }, { subtotal: 500000 });
assert.equal(plain.cost, 22000, 'a disabled promotion leaves the rate alone');
assert.ok(!plain.promotionApplied, 'and must not claim it applied');

// --- 2. Every screen that renders a courier rate explains a promoted one ----------------------------------
const screens = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) screens.push(full);
  }
};
walk(join(src, 'pages'));

// A screen that prints a rate's cost inside a chooser is a screen a buyer picks shipping on.
const rateScreens = screens.filter((file) => {
  const text = readFileSync(file, 'utf8');
  return /setSelectedShipping\(rate\)/.test(text) && /\(rate\.cost\)/.test(text);
});
assert.ok(rateScreens.length >= 4,
  `expected the four screens that choose a courier rate, found ${rateScreens.length} — the scan is `
  + 'broken, not the code');
assert.ok(rateScreens.some((file) => !file.includes(join('pages', 'mobile'))),
  'no desktop rate chooser found, and the desktop was the half that explained nothing');

for (const file of rateScreens) {
  const where = file.slice(src.length + 1);
  const text = readFileSync(file, 'utf8');
  assert.match(text, /rate\.promotionApplied/,
    `${where} shows a promoted price without saying it was promoted. The buyer gets the discount and no `
    + 'reason to remember it, which is the entire point of running one');
  assert.match(text, /rate\.originalCost/,
    `${where} never shows what the shipping had been, so the promotion is invisible even when named — a `
    + 'number that is simply lower explains nothing');
}

console.log(`promotionIsVisible selfcheck OK (${rateScreens.length} rate choosers, every one of them `
  + 'showing that a promotion applied and what it came off)');
