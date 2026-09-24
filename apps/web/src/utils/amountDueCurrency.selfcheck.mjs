// `node src/utils/amountDueCurrency.selfcheck.mjs`
//
// Every screen that says "total due" is making a promise about a number someone is about to transfer.
// For a parcel leaving Indonesia that number is in dollars — frozen onto the order at the rate it was
// written with — and for an order still waiting on a freight quote there is no such number yet.
//
// The payment page knew both of those things. Nothing else did:
//   * the checkout summary totalled Rp 1.260.000 under a product page that had just quoted US$80, so the
//     buyer reached the last screen before paying with two numbers and no way to tell which they owed;
//   * the invoice — the document they keep — printed the rupiah alone, a receipt for an amount they
//     never sent;
//   * the customer portal's "total due" banner did the same, and both of them printed a final total for
//     an order whose shipping had not been worked out. The payment page refuses to name one; an invoice
//     that names one anyway is the more convincing of the two documents.
//
// The surfaces are derived, not listed: a file that renders a `*.totalDue` message IS a screen that
// names an amount due. Which rule applies depends on whether the order exists yet — a checkout has no
// order to be waiting on a quote, so it asks the live figure instead.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { usdPriceFor, USD_PRICE_RATE } from './usdPrice.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

/** Every .jsx under a directory, as path segments. Walked, never listed. */
const pagesUnder = (...base) => {
  const found = [];
  const walk = (parts) => {
    for (const entry of readdirSync(join(root, ...parts), { withFileTypes: true })) {
      if (entry.isDirectory()) walk([...parts, entry.name]);
      else if (entry.name.endsWith('.jsx')) found.push([...parts, entry.name]);
    }
  };
  walk(base);
  return found;
};

// --- 1. One rate, one function -------------------------------------------------------------------------
// The checkout computes the dollar figure live and api/orders/create.js freezes one onto the order. If
// those two ever came from different arithmetic, the buyer would agree to one number and be invoiced
// another — so both must call the same function, and the guard runs it rather than trusting the name.
assert.equal(usdPriceFor(1260000), 80, 'the shop quotes US$80 for Rp 1.260.000; both screens must agree');
assert.ok(usdPriceFor(1260001) >= 80, 'rounding is UP — a rounded-down dollar figure is money given away');
const endpoint = readFileSync(join(root, '..', 'api', 'orders', 'create.js'), 'utf8');
assert.match(endpoint, /amountUsd: usdPriceFor\(/,
  'the order must freeze its dollar figure with the same function the checkout quotes with');
assert.match(endpoint, /usdRate: USD_PRICE_RATE/,
  'and record the rate it used, or the invoice cannot explain the number later');
const hook = read('hooks', 'useCheckoutFlow.js');
assert.match(hook, /formatUsdPrice\(totalDue\)/,
  'the checkout must quote the dollar figure from the same module, not convert on its own');
assert.match(hook, /const totalDueUsdLabel = destination \?/,
  'and only for an order with a destination — a domestic total in dollars is nonsense');

// --- 1b. The unit cannot be mistaken ---------------------------------------------------------------------
// usdPriceFor and formatUsdPrice take RUPIAH. The hook exported the converted dollar figure for one
// commit, a checkout page passed it straight back into formatUsdPrice, and the last screen before paying
// read "US$5" for a Rp 1.260.000 order. Both gates were green; it was caught by opening the page. So the
// hook hands out a finished string and nothing downstream converts anything.
for (const page of pagesUnder('pages')) {
  const source = read(...page);
  assert.doesNotMatch(source, /(?:format)?[Uu]sdPrice(?:For)?\(\s*\w*(?:Usd|USD)\w*\s*\)/,
    `${page.join('/')} converts a value that is already in dollars — these functions take rupiah, and the `
    + 'result is a plausible-looking price that is wrong by the exchange rate');
}
assert.ok(USD_PRICE_RATE > 0, 'the rate must be a real number for any of this to mean anything');

// --- 2. Every screen naming a total due follows one of the two rules -------------------------------------
const pages = pagesUnder('pages');

// Whatever holds a total due, however it is spelled. The first version of this filter looked for a
// `*.totalDue` message key and quietly missed the desktop checkout, whose key is called
// `checkout.total` — the one screen this whole finding started from. A set chosen by naming convention
// is a set that omits whatever was named differently.
const namesATotal = pages.filter((file) => /\btotalDue\b/.test(read(...file)));
assert.ok(namesATotal.length >= 5,
  `expected the screens that name an amount due to still be findable this way, found ${namesATotal.length}`);

for (const file of namesATotal) {
  const source = read(...file);
  const where = file.join('/');
  // Bespoke is genuinely outside this rule: storefront_bespoke_options holds one set of numbers with no
  // overseas variant, so a custom bottle going abroad is quoted by hand and there is no dollar figure to
  // print. That exclusion is itself checked — if bespoke ever gains international pricing, this fails and
  // the exclusion has to be rethought rather than silently kept.
  if (/bespoke/i.test(where)) {
    assert.doesNotMatch(source, /internationalPriceFor|usdPriceFor|amountUsd/,
      `${where} now prices something internationally, so it can no longer be excluded from the rule that `
      + 'an amount due is named in the currency the buyer was asked for');
    continue;
  }
  // A checkout has no order yet, so it cannot be waiting on anything — it asks the live figure.
  if (source.includes('canSubmitCheckout')) {
    assert.match(source, /totalDueUsdLabel\s*(?:\?|&&|\|\|)/,
      `${where} totals an international order in rupiah under a page that quoted dollars — the buyer `
      + 'reaches the last screen before paying with two numbers and no way to tell which they owe');
    continue;
  }
  // Everything else is looking at an order that exists, and an order can be waiting on freight.
  //
  // Both questions, not one particular way of asking them. The payment page reads amountUsd off the
  // payment session it builds; the invoice and the portal go through internationalOrderSummary. An
  // earlier version of this guard demanded the helper by name and failed the payment page, which had
  // been right all along — the rule is that the screen KNOWS what currency was asked for, not which
  // function it used to find out.
  assert.match(source, /amountUsd|internationalOrderSummary\(/,
    `${where} names an amount due but never asks what currency the buyer was asked for — an overseas `
    + 'buyer gets a document for an amount they never sent');
  assert.match(source, /isAwaitingShippingQuote\(/,
    `${where} names a final total for an order whose shipping has not been worked out. The payment page `
    + 'refuses to name one; this screen naming one anyway is the more convincing document');
}

// --- 3. The phone and the desktop name the same step the same way -------------------------------------
// The phone's checkout tab read "Pembayaran" / "Payment" while its desktop twin read "Checkout". Same
// step, same form, nothing paid yet — a buyer with both open sees two tabs claiming to be two different
// places, and one of them is claiming they are further along than they are.
{
  const { MESSAGES } = await import('../i18n/messages.js');
  for (const locale of ['id', 'en']) {
    assert.equal(MESSAGES[locale]['mcheckout.tab'], MESSAGES[locale]['checkout.tab'],
      `${locale}: the phone checkout names its step differently from the desktop checkout — same form, `
      + 'same step, nothing paid yet');
  }
}

console.log(`amountDueCurrency selfcheck OK (${namesATotal.length} screens naming an amount due, each in `
  + 'the currency the buyer was asked for, none of them naming a total that is not final yet)');
