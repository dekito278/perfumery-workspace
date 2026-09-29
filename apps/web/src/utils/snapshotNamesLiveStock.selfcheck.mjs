// `node src/utils/snapshotNamesLiveStock.selfcheck.mjs`
//
// tools/build.mjs writes a static snapshot for each public landing page — the <noscript> body a crawler
// reads and the only thing a visitor sees if the bundle never arrives. Each snapshot carries a list of
// sections, and for two of those pages the sections ARE the shop's stock.
//
// The catalogue learned this the hard way: its snapshot named five perfumes and four had been
// discontinued, so search results advertised bottles nobody could buy. It was fixed by building the
// list from the live fetch. The journal was the same shape and never got the same fix — measured
// 30 Sep 2026 it advertised four articles ("From lab note to finished bottle", …) while the journal held
// exactly ONE published post, and none of the four was it.
//
// The rule is not "these two routes". It is: every collection this build FETCHES has a landing page, and
// that page's sections come from the fetch rather than from a sentence someone typed once. The count is
// taken from the build's own fetch calls, so a third collection added later fails here.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const build = stripComments(readFileSync(join(webRoot, 'tools', 'build.mjs'), 'utf8'));

// --- 1. Every fetched collection feeds its own landing page -------------------------------------------
const fetched = [...build.matchAll(/fetch([A-Za-z]+)\(env\)/g)].map((match) => match[1]);
assert.ok(fetched.length >= 2, `only ${fetched.length} Supabase fetches found in build.mjs — the derivation broke`);

const liveBlock = build.match(/const liveSections = \{([^}]*)\}/);
assert.ok(liveBlock, 'build.mjs no longer routes live data into the snapshots at all');
const liveRoutes = [...liveBlock[1].matchAll(/'([^']+)':/g)].map((match) => match[1]);

assert.equal(liveRoutes.length, fetched.length,
  `build.mjs fetches ${fetched.length} collections (${fetched.join(', ')}) but only ${liveRoutes.length} landing `
  + `page(s) take their sections from live data (${liveRoutes.join(', ')}). The one left out ships a list `
  + 'somebody typed once, and it goes stale the day the shop changes without anyone noticing.');
// Containment, not equality: a third collection added later must be able to pass by bringing its own
// landing page with it — the count above is what keeps it honest.
for (const route of ['/catalog', '/journal']) {
  assert.ok(liveRoutes.includes(route), `${route} lists database rows, so its snapshot must come from them`);
}

// --- 2. And each of them is actually handed the data ---------------------------------------------------
assert.match(build, /writeStaticPublicPages\(env\.siteUrl, products, journal\)/,
  'the generator must receive both collections — passing only products is how the journal was missed');

// --- 3. The offline fallback must describe, never enumerate --------------------------------------------
// It is what ships when Supabase cannot be reached, so it outlives the stock by definition. The failure
// is subtle: a stale name still READS as a real listing. Held to a shape instead — a stock page's
// hard-coded sections stay short and generic, and the live list replaces them when there is one.
// Only the `sections:` array — `items:` next to it is the chip row, not a listing.
const sectionTitles = (body) => {
  const block = body.match(/sections: \[([\s\S]*?)\n    \]/);
  return block ? [...block[1].matchAll(/\[\s*'([^']+)',/g)].map((match) => match[1]) : [];
};

const pageBlocks = [...build.matchAll(/\{\s*route: '([^']+)',[\s\S]*?\n  \}/g)];
assert.ok(pageBlocks.length >= 4, `only ${pageBlocks.length} static pages parsed — the derivation broke`);
for (const [body, route] of pageBlocks.map((match) => [match[0], match[1]])) {
  if (!liveRoutes.includes(route)) continue;
  const sections = sectionTitles(body);
  assert.ok(sections.length <= 2,
    `${route}'s offline fallback lists ${sections.length} sections (${sections.join(', ')}). It ships when `
    + 'Supabase is unreachable and therefore outlives the stock — describe the collection, do not list it.');
}

// --- 4. Nothing in a crawled snapshot may call the shop unfinished -------------------------------------
// Same rule the boot screen already holds (publicTrackingVocabulary): "Continue toward a public checkout
// placeholder" sat in the bespoke snapshot long after that checkout started taking money.
const unfinished = [...build.matchAll(/'([^']*\bplaceholder\b[^']*)'/gi)].map((match) => match[1]);
assert.deepEqual(unfinished, [],
  `these snapshot sentences tell a crawler the shop is a mock-up:\n  ${unfinished.join('\n  ')}`);

// --- 5. And it may not advertise a page that is behind the login --------------------------------------
// The home snapshot offered a "Raw Material Archive" of public material stories. Raw materials are a
// Studio screen: /raw-materials is in desktopProtectedRoutePrefixes. Derived from that list, so a
// section naming any private area fails here.
const app = stripComments(readFileSync(join(webRoot, 'src', 'App.jsx'), 'utf8'));
const privatePrefixes = [...(app.match(/desktopProtectedRoutePrefixes = \[([\s\S]*?)\]/) || [])[1]
  .matchAll(/'\/([a-z-]+)'/g)].map((match) => match[1].replace(/-/g, ' '));
assert.ok(privatePrefixes.length >= 8, `only ${privatePrefixes.length} private prefixes parsed — the derivation broke`);
const advertisedPrivate = [];
for (const [body, route] of pageBlocks.map((match) => [match[0], match[1]])) {
  for (const section of sectionTitles(body)) {
    if (privatePrefixes.some((name) => section.toLowerCase().includes(name))) {
      advertisedPrivate.push(`${route}: "${section}"`);
    }
  }
}
assert.deepEqual(advertisedPrivate, [],
  'a public snapshot offers a section that lives behind the Studio login, so a visitor who follows it '
  + `lands on a sign-in screen:\n  ${advertisedPrivate.join('\n  ')}`);

console.log(`snapshotNamesLiveStock selfcheck OK (${fetched.length} fetched collections, ${liveRoutes.length} landing pages built from them, nothing enumerated offline and nothing private advertised)`);
