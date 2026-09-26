// `node src/utils/maskedCustomerIsExplained.selfcheck.mjs`
//
// storefront_customer_portal has two answers for a code. A code with a security question returns the
// question and nothing else. A code WITHOUT one — the default, which is most of them — returns the
// customer masked: mask_name() gives back the first letter and three dots, and contact and address are
// not in the payload at all (20260730120000, the round-7 privacy fix).
//
// That is the right payload. What was wrong is what a screen does with it. The portal says "Detail
// disembunyikan demi keamanan" and tells the buyer how to see the rest. The invoice — the page people
// print and keep — rendered customer.contact straight through, so a buyer opening their own invoice
// read "A•••" over a bare dash with no explanation at all.
//
// The rule: a screen that reads the portal payload and shows a customer must handle the masked case
// where it shows it. Subject derived from the import, not listed; and checked inside the JSX expression
// that renders the contact rather than anywhere in the file — a file-wide search passes while the one
// expression that matters has been changed back.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
));

// A portal screen is one that reads the by-code lookup. Studio's customer lists read the admin table
// through getCustomers and never see a masked row, so they are not in this set by construction —
// no exemption needed, and no list to forget to grow.
const portalScreens = walk(join(src, 'pages'))
  .filter((file) => file.endsWith('.jsx'))
  .filter((file) => /getCustomerPortalByCode|verifyCustomerPortalSecurity/.test(readFileSync(file, 'utf8')));
assert.ok(portalScreens.length >= 2,
  `only ${portalScreens.length} screens read the portal lookup — the scan is broken, not the code`);

// The enclosing JSX expression of an occurrence: walk back to the unmatched '{', forward to its match.
const enclosingExpression = (text, at) => {
  let depth = 0;
  let open = -1;
  for (let i = at; i >= 0; i -= 1) {
    if (text[i] === '}') depth += 1;
    else if (text[i] === '{') {
      if (depth === 0) { open = i; break; }
      depth -= 1;
    }
  }
  if (open === -1) return '';
  depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  return '';
};

let checked = 0;
for (const file of portalScreens) {
  const where = file.slice(src.length + 1);
  const text = readFileSync(file, 'utf8');
  for (const found of text.matchAll(/(?:portal\.)?customer\.contact\b/g)) {
    const expression = enclosingExpression(text, found.index);
    assert.ok(expression, `${where}: could not read the expression around customer.contact — update this guard`);
    // Only what is put on screen has to explain itself. A JSX interpolation is a single expression;
    // a semicolon means this is a statement block (the profile-form prefill, which fills an input the
    // buyer can then correct), and an object key means it is a payload being built, not rendered.
    //
    // The object-key test has to be the KEY, not any colon: `masked ? … : customer.contact` is a
    // ternary whose else branch reads exactly like one, and skipping on that silently dropped the very
    // render this guard exists for.
    if (expression.includes(';') || /\bcontact:\s*customer\.contact/.test(expression)) continue;
    assert.match(expression, /masked/,
      `${where} prints the customer's contact without asking whether the payload is masked. `
      + 'A buyer whose code has no security question reads a dash where their phone number should be, '
      + `and "${'A•••'}" where their name should be, with nothing saying why.`);
    checked += 1;
  }
}
assert.ok(checked >= 3, `only ${checked} contact renders checked — the derivation lost them`);

// The masked notice has to exist in both shops, or one of them explains nothing.
for (const key of ['cust.hiddenForSecurity', 'inv.maskedNote']) {
  for (const language of ['id', 'en']) {
    assert.ok(MESSAGES[language]?.[key], `${language}.${key} is missing`);
    assert.ok(MESSAGES[language][key].length > 20, `${language}.${key} is too short to explain anything`);
  }
  assert.notEqual(MESSAGES.id[key], MESSAGES.en[key], `${key} was never translated`);
}

console.log(`maskedCustomerIsExplained selfcheck OK (${portalScreens.length} portal screens, ${checked} contact renders, each saying why it is hidden)`);
