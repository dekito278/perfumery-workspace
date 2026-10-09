// `node src/utils/brandFactsAreStatedOnce.selfcheck.mjs`
//
// A house that wants to be in a fragrance database has to be transcribable from one page. Until
// October 2026 SOLIVAGANT had none: /about was a 404, there was no route by that name at all, and the
// brand's details were spread across a hero, a footer and a tagline with nothing anyone could link to.
//
// The rule is not "there is an About page". It is that the facts on it come from ONE module, so the
// page cannot drift from what the shop actually is, and so a fact nobody has stated yet — the founding
// year, the city — is absent rather than guessed. A guessed founding year is the worst kind of wrong
// here: a database quotes it back forever, and `storefront_products.created_at` sits right there
// looking like an answer while meaning something else entirely (when a row was made in this app, not
// when a perfume was released).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { BRAND_PROFILE, brandOrigin, brandFacts } from '../data/brandProfile.js';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- 1. The facts, run in every state the shop can be in -----------------------------------------------
// Both states, whichever one is live. The first version of this section asserted that the city was
// empty and the founding year absent, which was true on the day it was written and became false the
// moment Dekito answered ("Rilis dari 2023, kota bogor", 9 Oct 2026). A guard that pins today's data
// fails when the data arrives — which is the one moment it was supposed to be useful.
const withProfile = (patch, check) => {
  const saved = { city: BRAND_PROFILE.city, foundedYear: BRAND_PROFILE.foundedYear };
  Object.assign(BRAND_PROFILE, patch);
  try {
    check(Object.fromEntries(brandFacts({ fragranceCount: 19 }).map((fact) => [fact.key, fact.value])));
  } finally {
    Object.assign(BRAND_PROFILE, saved);
  }
};

// Nothing stated: absent, not blank, and never a stray comma.
withProfile({ city: '', foundedYear: null }, (facts) => {
  assert.equal(brandOrigin(), 'Indonesia', 'with no city stated, the origin is the country alone');
  assert.ok(!('founded' in facts), 'a founding year nobody has stated must not reach the page');
});
// Stated: shown, in that order, with no edit to the page or to this guard.
withProfile({ city: 'Bogor', foundedYear: 2023 }, (facts) => {
  assert.equal(brandOrigin(), 'Bogor, Indonesia', 'city and country, one comma, in that order');
  assert.equal(facts.founded, '2023');
});

// And the state that is actually live, checked for self-consistency rather than for a value: every
// field the profile holds appears, every field it does not hold is absent.
const facts = brandFacts({ fragranceCount: 19 });
const byKey = Object.fromEntries(facts.map((fact) => [fact.key, fact.value]));
assert.equal(byKey.house, 'SOLIVAGANT');
assert.equal(byKey.perfumer, 'Dekito');
assert.equal(byKey.fragrances, '19');
assert.equal(byKey.size, '30 ml');
assert.equal('founded' in byKey, Boolean(BRAND_PROFILE.foundedYear),
  'the profile and the page disagree about whether a founding year is known');
assert.equal(byKey.origin.startsWith(BRAND_PROFILE.city ? `${BRAND_PROFILE.city}, ` : BRAND_PROFILE.country), true,
  'the origin line does not match the city the profile holds');
assert.deepEqual(brandFacts().filter((fact) => fact.key === 'fragrances'), [],
  'a catalogue that has not loaded yet shows no count rather than "0 fragrances"');
// A year can only be a year. The page has no other defence against a typo here.
if (BRAND_PROFILE.foundedYear !== null) {
  assert.ok(Number.isInteger(BRAND_PROFILE.foundedYear)
    && BRAND_PROFILE.foundedYear >= 1900 && BRAND_PROFILE.foundedYear <= new Date().getFullYear(),
  `foundedYear is ${BRAND_PROFILE.foundedYear}, which is not a year this atelier could have started in`);
}

// --- 2. Every fact a reader could meet has a label, in BOTH shops ---------------------------------------
// Derived from the module: a fact added there renders as a bare key on the page unless its label is
// written too, and the key is what a buyer would see. Checked against both message tables because the
// English shop is the one a database editor reads.
const possible = ['house', 'perfumer', 'origin', 'founded', 'fragrances', 'concentration', 'size'];
const produced = [...new Set([
  ...brandFacts({ fragranceCount: 1 }).map((fact) => fact.key),
  'founded',
])];
for (const key of produced) {
  assert.ok(possible.includes(key),
    `brandFacts can emit "${key}", which this guard has never heard of — add its label and list it here`);
}
for (const key of possible) {
  for (const shop of ['id', 'en']) {
    const label = MESSAGES[shop][`about.fact.${key}`];
    assert.ok(label && label.trim(),
      `about.fact.${key} has no ${shop} label, so that row would print the key to a reader`);
  }
}
for (const key of Object.keys(MESSAGES.en).filter((k) => k.startsWith('about.'))) {
  assert.ok(MESSAGES.id[key], `${key} exists in English and not in Indonesian`);
}

// --- 3. The page renders the facts rather than repeating them -------------------------------------------
const page = read('pages', 'AboutPage.jsx');
assert.match(page, /brandFacts\(/, 'the About page must build its details from the module');
for (const stated of [BRAND_PROFILE.perfumer, BRAND_PROFILE.concentration, `${BRAND_PROFILE.sizeMl} ml`]) {
  assert.ok(!page.includes(`>${stated}<`) && !page.includes(`'${stated}'`),
    `the About page writes "${stated}" out itself instead of reading it from brandProfile.js — two `
    + 'places to change, and the shop is the thing being described');
}
// A year typed into the page would bypass the module entirely, which is the one mistake that matters.
assert.doesNotMatch(page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''), /\b(?:19|20)\d\d\b/,
  'a year is written into the About page. If it is the founding year it belongs in brandProfile.js, '
  + 'where it is stated once and can be left empty until somebody actually knows it');

// --- 4. And the page can be reached and linked ----------------------------------------------------------
// A brand page nobody can link to is the problem this started as. The build already refuses to ship a
// sitemap entry with no route; this is the other direction — the route exists and is advertised.
const seo = read('..', 'tools', 'seo-artifacts.mjs');
assert.match(seo, /STATIC_PUBLIC_ROUTES = \[[^\]]*'\/about'/,
  '/about is not advertised, so it is in neither the sitemap nor the prerendered pages, and a link '
  + 'pasted into a forum would preview as the app shell');
const app = read('App.jsx');
for (const route of ['"/about"', '"/mobile/about"']) {
  assert.ok(app.includes(`path=${route}`), `App.jsx has no route for ${route}`);
}
assert.match(read('components', 'storefront', 'StorefrontFooter.jsx'), /to: '\/about'/,
  'nothing links to the About page, which is how it came to be missing in the first place');

console.log(`brandFactsAreStatedOnce selfcheck OK (${facts.length} facts stated once and labelled in both `
  + `shops, ${possible.length - facts.length} left empty until somebody says them, page linked and advertised)`);
