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
assert.ok(flows.length >= 2,
  `expected the desktop and phone bespoke flows; found ${flows.length}: ${flows.join(', ')}. A third one `
  + 'has to be caught by this too.');

// --- 2. Each offers the code, and something writes it -------------------------------------------------
const missing = [];
const unwritten = [];
const silent = [];
for (const rel of flows) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  if (!/lookupCustomerByCode\(/.test(source)) { missing.push(rel); continue; }

  // #380's lesson: state with no writer reads like it preserves something. A field the buyer can type
  // into is what makes the code reachable at all.
  if (!/updateField\('customerCode'|updateForm\('customerCode'/.test(source)) unwritten.push(rel);

  // The three answers, each distinct. A lookup that could not run must not be reported as a code that
  // does not exist — lookupCustomerByCode rethrows for exactly that (#367).
  const body = lookupBody(source);
  assert.ok(body.includes('lookupCustomerByCode('), `${rel}: lookupCustomer does not call the lookup`);
  const said = [...body.matchAll(/t\('(bsp\.code\w+)'/g)].map((match) => match[1]);
  const distinct = new Set(said);
  if (!distinct.has('bsp.codeLookupFailed') || !distinct.has('bsp.codeNotFound') || distinct.size < 3) {
    silent.push(`${rel}: ${[...distinct].join(', ') || '(none)'}`);
  }
}
assert.deepEqual(missing, [],
  'these bespoke flows never let a returning customer give their code, so their order is filed under a '
  + 'new one and their history splits:\n  ' + missing.join('\n  '));
assert.deepEqual(unwritten, [],
  'these read a customer code that nothing writes — the state is there and the field is not, which is '
  + 'exactly what #380 deleted:\n  ' + unwritten.join('\n  '));
assert.deepEqual(silent, [],
  'these do not tell the three answers apart — a code not given, a code looked for and not found, and a '
  + 'lookup that could not run. The third must never read as the second:\n  ' + silent.join('\n  '));

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

// --- 4. Every message it can show exists in BOTH shops ------------------------------------------------
const messages = readFileSync(join(src, 'i18n', 'messages.js'), 'utf8');
const keys = new Set();
for (const rel of flows) {
  for (const match of lookupBody(strip(readFileSync(join(src, rel), 'utf8'))).matchAll(/t\('(bsp\.\w+)'/g)) {
    keys.add(match[1]);
  }
}
console.log(`  messages the lookup can show: ${[...keys].sort().join(', ')}`);
for (const key of keys) {
  const count = messages.split(`"${key}":`).length - 1;
  assert.equal(count, 2,
    `${key} appears ${count} time(s) in messages.js — it must exist in both the Indonesian and the English `
    + 'catalogue, or the English shop shows a raw key');
}

console.log(`bothBespokeFlowsAskForTheCode selfcheck OK (${flows.length} flows, each asking, each telling the three answers apart)`);
