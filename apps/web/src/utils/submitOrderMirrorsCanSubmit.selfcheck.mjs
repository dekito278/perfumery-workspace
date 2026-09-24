// `node src/utils/submitOrderMirrorsCanSubmit.selfcheck.mjs`
//
// A checkout asks its buyer the same question twice, in two different places, and the two answers must
// agree. canSubmitCheckout decides whether the button complains about a missing field. submitOrder
// decides whether the order is actually written. Between them sits a buyer who has filled everything in.
//
// They drifted. canSubmitCheckout was taught that an international order needs a destination COUNTRY
// instead of a courier and a RajaOngkir area; submitOrder was not. So an overseas buyer filled in every
// field, saw no complaint, pressed a button that was not disabled — and was answered, in Indonesian, on
// the English shop, with an instruction to pick a RajaOngkir area that is not on their screen and cannot
// exist for a parcel leaving the country. Nothing was written and nothing explained why. The
// international checkout looked finished and could not take a single order.
//
// Two rules hold that shut, and neither cares how the conditions are worded or ordered:
//   1. submitOrder may not require anything canSubmitCheckout does not also require — otherwise the
//      button promises an order the submit refuses.
//   2. Whatever canSubmitCheckout requires of only ONE kind of order, submitOrder must require of only
//      that kind too — the domestic-only conditions belong inside the domestic branch.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const hook = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'useCheckoutFlow.js'),
  'utf8',
);

/** The text of a `{...}` block, given the index of its opening brace. Strings and comments are not
 *  special-cased: this file has neither braces in strings nor commented-out blocks in these ranges,
 *  and the assertions below fail loudly if the slice ever comes out wrong. */
const blockAt = (source, openBrace) => {
  let depth = 0;
  for (let i = openBrace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openBrace + 1, i);
    }
  }
  throw new Error('unbalanced braces');
};

const RESERVED = new Set(['Boolean', 'if', 'else', 'return', 'toast', 'error', 'trim', 'length', 'map',
  'filter', 'join', 'name', 'item', 'names', 'Beberapa', 'const']);
const identsIn = (text) => new Set(
  (text.match(/[A-Za-z_$][\w$]*/g) || []).filter((word) => !RESERVED.has(word)),
);

// --- The two lists ---------------------------------------------------------------------------------
const canSubmitStart = hook.indexOf('const canSubmitCheckout = Boolean(');
assert.ok(canSubmitStart > 0, 'canSubmitCheckout is gone — this guard has nothing left to compare');
const canSubmit = hook.slice(canSubmitStart, hook.indexOf('\n  );', canSubmitStart));

const submitStart = hook.indexOf('const submitOrder = async');
const savingStart = hook.indexOf('setSaving(true)', submitStart);
assert.ok(submitStart > 0 && savingStart > submitStart,
  'submitOrder must still refuse an incomplete order before it starts saving');
// Everything submitOrder checks BEFORE it commits to writing. Guards added after setSaving(true) are a
// different thing — by then the order is being made and the failure is reported, not silently refused.
const preamble = hook.slice(submitStart, savingStart);

// --- Rule 1: submitOrder may not require what the button does not ------------------------------------
// Every `if (!x...)` that returns early is a requirement. The buyer must have been told about it by the
// notice above the button, which is driven by canSubmitCheckout.
const required = [...preamble.matchAll(/if \(!([A-Za-z_$][\w$]*)/g)].map((match) => match[1]);
assert.ok(required.length >= 4, `expected submitOrder to still guard its inputs, found ${required.length}`);
for (const identifier of new Set(required)) {
  assert.ok(
    canSubmit.includes(identifier),
    `submitOrder refuses an order when "${identifier}" is missing, but canSubmitCheckout never asks for `
    + 'it — so the button stays enabled, says nothing is missing, and the order silently never happens. '
    + 'Add it to canSubmitCheckout (and to the notice that names it) or stop requiring it here.',
  );
}

// --- Rule 2: a condition for one kind of order lives in that kind's branch ----------------------------
// canSubmitCheckout splits on isInternational: one side wants a destination country, the other a courier,
// an area and a rate. Whatever appears on only one side is that side's business alone.
const split = canSubmit.indexOf('isInternational');
assert.ok(split > 0, 'canSubmitCheckout no longer distinguishes international orders');
const internationalSide = canSubmit.slice(canSubmit.indexOf('?', split) + 1, canSubmit.indexOf(':', split));
const domesticSide = canSubmit.slice(canSubmit.indexOf(':', split) + 1);
const internationalOnly = [...identsIn(internationalSide)];
const domesticOnly = [...identsIn(domesticSide)].filter((word) => !internationalSide.includes(word));
assert.ok(internationalOnly.length >= 1 && domesticOnly.length >= 2,
  'the two sides of canSubmitCheckout should ask for different things; found '
  + `${internationalOnly.length} / ${domesticOnly.length}`);

const branchStart = preamble.indexOf('if (isInternational)');
assert.ok(branchStart > 0,
  'submitOrder checks the same conditions for every destination. An order leaving Indonesia has no '
  + 'courier and no RajaOngkir area, so those checks refuse every international order — which is exactly '
  + 'how the international checkout shipped unable to place one.');
const internationalBranch = blockAt(preamble, preamble.indexOf('{', branchStart));
const elseAt = preamble.indexOf('else', branchStart + internationalBranch.length);
assert.ok(elseAt > 0, 'the international branch needs its domestic counterpart, or domestic orders stop '
  + 'being checked at all');
const domesticBranch = blockAt(preamble, preamble.indexOf('{', elseAt));

for (const identifier of domesticOnly) {
  if (!preamble.includes(identifier)) continue;
  const outside = preamble.replace(domesticBranch, '');
  assert.ok(
    !outside.includes(identifier),
    `submitOrder requires "${identifier}" of every order, but canSubmitCheckout asks for it only when the `
    + 'parcel stays in Indonesia. An international order has no such value, so this refuses it — with a '
    + 'message naming a field the buyer was never shown.',
  );
}
for (const identifier of internationalOnly) {
  assert.ok(
    internationalBranch.includes(identifier),
    `canSubmitCheckout lets an international order through on "${identifier}", so submitOrder must check `
    + 'the same thing before writing it — a direct caller does not go past a disabled button.',
  );
}

console.log('submitOrderMirrorsCanSubmit.selfcheck: OK');
