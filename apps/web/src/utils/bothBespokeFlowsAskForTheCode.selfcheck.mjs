// `node src/utils/bothBespokeFlowsAskForTheCode.selfcheck.mjs`
//
// A returning customer can give their code on either bespoke flow, or on neither — not on one.
//
// The phone has had the field and the lookup since the bespoke flow shipped. Desktop had `customerCode` in
// its form state, read it at both submit sites, and had nothing that wrote it and no field to type into —
// so the fallback could only ever resolve to '' (#380 deleted the dead state; this restored it with a
// writer). A customer ordering bespoke from a laptop was filed under a freshly generated code and their
// history split in two.
//
// Both halves derived: the flows are found on disk by what they build, and the three answers a lookup can
// give are read out of the code rather than named here.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// --- 1. The bespoke flows, swept rather than listed ---------------------------------------------------
const files = [];
// The lookup's own body, sliced by brace counting. A flat character window around the call reached into
// validateForm next door and reported bsp.errName as one of the lookup's messages.
const lookupBody = (source) => {
  const at = source.search(/const lookupCustomer\s*=/);
  if (at === -1) return '';
  const open = source.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(at, i + 1);
    }
  }
  return source.slice(at);
};

const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx$/.test(entry.name)) files.push(rel);
  }
};
walk('pages');
// A bespoke flow is a screen that SUBMITS a bespoke request, which is createBespokeRequest — the one
// function both flows share. Guessed at the names first (submitBespokeRequest, createBespokeOrder) and
// found zero; the Studio settings screen mentions bespoke all over and submits nothing, so "mentions the
// word" would have dragged it in.
const flows = files.filter((rel) => /createBespokeRequest\(/.test(strip(readFileSync(join(src, rel), 'utf8'))));
console.log(`  bespoke flows: ${flows.join(', ')}`);
// Floor lowered when the phone storefront retired (2026-10-31): every screen counted here had a phone twin.
assert.ok(flows.length >= 1,
  `expected the desktop and phone bespoke flows; found ${flows.length}: ${flows.join(', ')}. A third one `
  + 'has to be caught by this too.');

// --- 2. Each files the order under the customer's own code -----------------------------------------------
// Since #595 neither checkout asks a buyer to type a SOLI code. The main checkout fills it from the signed-in
// account (useCheckoutFlow); the bespoke checkout does the same, and must — or a returning customer's bespoke
// order is filed under a fresh code and their history splits, which is what this guard was written for.
const unfilled = [];
for (const rel of flows) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  const fills = /getCustomerAccount\(\)/.test(source) && /customerCode: current\.customerCode \|\| customer\.customerCode/.test(source);
  const asks = /lookupCustomerByCode\(/.test(source) && /updateField\('customerCode'|updateForm\('customerCode'/.test(source);
  if (!fills && !asks) unfilled.push(rel);
}
assert.deepEqual(unfilled, [],
  'these bespoke flows neither ask for a returning customer\'s code nor fill it from their account, so the '
  + 'order is filed under a new one and their history splits:\n  ' + unfilled.join('\n  '));


// --- 3. And the code the buyer gave reaches the order -------------------------------------------------
// Collected and then dropped on the way to the order is the shape this repo has shipped before.
// PER SITE, not "somewhere in the file". The desktop flow builds the field in two places and a sabotage
// that dropped the typed code from one of them was satisfied by the other.
const orphaned = [];
for (const rel of flows) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  // Only the sites that BUILD the field from the order. `customerCode: ''` in the form's initial state is
  // an initialiser, not a submit site, and a first version of this rule reported both pages' init lines.
  // The lookup's own setForm writes customer.customerCode — that is the answer arriving, not a submit.
  const sites = [...source.matchAll(/customerCode: ([^,\n]*order[^,\n]*)/g)];
  assert.ok(sites.length >= 1, `${rel} never puts a customer code on the order at all`);
  for (const site of sites) {
    if (!/form\.customerCode/.test(site[1])) orphaned.push(`${rel}: customerCode: ${site[1].trim()}`);
  }
}
assert.deepEqual(orphaned, [],
  'these build the order\'s customer code without the one the buyer typed, so a code given on the form is '
  + 'collected and then dropped on the way to the order:\n  ' + orphaned.join('\n  '));

console.log(`bothBespokeFlowsAskForTheCode selfcheck OK (${flows.length} flow(s), each filing the order under the customer's own code)`);
