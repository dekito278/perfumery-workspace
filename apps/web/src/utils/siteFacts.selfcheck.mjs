// `node src/utils/siteFacts.selfcheck.mjs`
//
// The shop facts Dekito edits in Studio since 2026-11-03 (src/data/siteFacts.js). Three promises:
//   1. an empty or broken row leaves every page saying exactly what it said before;
//   2. every sentence that carries a fact is handed that fact — at runtime AND by the build, or a reader
//      without JavaScript gets a literal "{days}";
//   3. only an admin can write the row, and anyone can read it.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_SITE_FACTS, JOURNAL_CATEGORY_VALUE, journalCategoryLabelIn, journalCategoryValueFor, normalizeSiteFacts,
} from '../data/siteFacts.js';
import { BRAND_PROFILE } from '../data/brandProfile.js';
import { translate } from '../i18n/messages.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

// --- 1. Nothing set means nothing changed --------------------------------------------------------------
for (const empty of [undefined, null, {}, 'rusak', { bespokeDays: 'abc', quoteHours: -1, brandCity: '  ', journalCategories: 'x' }]) {
  assert.deepEqual(normalizeSiteFacts(empty), DEFAULT_SITE_FACTS, `${JSON.stringify(empty)} must read as the shipped facts`);
}
// The sentences, filled with the defaults, are the ones the shop printed before (2026-11-02).
assert.match(translate('id', 'bsp.lead', { days: DEFAULT_SITE_FACTS.bespokeDays }), /dikerjakan dalam 7–14 hari\./);
assert.match(translate('en', 'bsp.lead', { days: DEFAULT_SITE_FACTS.bespokeDays }), /takes 7–14 days\./);
assert.match(translate('id', 'pay.quoteBody', { hours: DEFAULT_SITE_FACTS.quoteHours }), /dalam 1x24 jam/);
assert.match(translate('en', 'pay.quoteBody', { hours: DEFAULT_SITE_FACTS.quoteHours }), /within 24 hours/);
// One source for the brand's own facts: the profile reads its defaults from here.
assert.equal(BRAND_PROFILE.city, DEFAULT_SITE_FACTS.brandCity);
assert.equal(BRAND_PROFILE.foundedYear, DEFAULT_SITE_FACTS.brandFoundedYear);

// What a typo becomes: tidied, or refused back to the default — never a broken page.
assert.equal(normalizeSiteFacts({ bespokeDays: '10 - 21' }).bespokeDays, '10–21');
assert.equal(normalizeSiteFacts({ bespokeDays: '14-7' }).bespokeDays, DEFAULT_SITE_FACTS.bespokeDays, 'a range written backwards');
assert.equal(normalizeSiteFacts({ quoteHours: '48' }).quoteHours, 48);
// A category key must pass the table's own check, whatever name it was made from.
for (const name of ['Catatan Bahan', 'Éclat & Oud', '2026 ide', 'a'.repeat(80)]) {
  assert.match(journalCategoryValueFor(name), JOURNAL_CATEGORY_VALUE, `"${name}" made a key the table refuses`);
}
assert.equal(normalizeSiteFacts({ journalCategories: [{ value: 'BAD KEY', label: 'x' }] }).journalCategories,
  DEFAULT_SITE_FACTS.journalCategories, 'a list with no valid category falls back to the defaults');
assert.equal(journalCategoryLabelIn(DEFAULT_SITE_FACTS.journalCategories, 'old_thing'), 'Old thing',
  'a key no longer listed reads as itself, not as some other category');

// --- 2. Every fact reaches its sentence ----------------------------------------------------------------
for (const [file, pattern, why] of [
  [['pages', 'BespokePage.jsx'], /t\('bsp\.lead', \{ days: siteFacts\.bespokeDays \}\)/, 'the bespoke lead is not given the lead time'],
  [['pages', 'BespokePage.jsx'], /t\('bsp\.preorderConfirm', \{ days: siteFacts\.bespokeDays \}\)/, 'the pre-order consent is not given the lead time'],
  [['pages', 'PaymentPage.jsx'], /t\('pay\.quoteBody', \{ hours: siteFacts\.quoteHours \}\)/, 'the quote promise is not given its hours'],
  [['components', 'storefront', 'StorefrontFooter.jsx'], /\{siteFacts\.footerOwner\}/, 'the footer still types its own name'],
  [['pages', 'AboutPage.jsx'], /city: siteFacts\.brandCity, foundedYear: siteFacts\.brandFoundedYear/, 'About ignores the city and year set in Studio'],
  [['App.jsx'], /function AppRoutes\(\) \{\n[^\n]*\n\s*useSiteFacts\(\);/, 'nothing loads the facts at the root, so labels keep the defaults until a screen asks'],
  // The help page (13 Nov 2026). A promise is shown only once Dekito has set it: an empty fact hides the line.
  [['pages', 'HelpPage.jsx'], /\{facts\.dispatchDays \? <p className="m-0">\{t\('help\.dispatch', \{ days: facts\.dispatchDays \}\)\}/, 'dispatch days are promised only once set'],
  [['pages', 'HelpPage.jsx'], /facts\.problemReportDays > 0 \? t\('help\.problemPromise', \{ days: facts\.problemReportDays \}\) : t\('help\.problemAsk'\)/, 'the broken-parcel promise only once a window is set'],
  [['pages', 'HelpPage.jsx'], /\{facts\.contactEmail \? \(/, 'an email only once one is set'],
  [['pages', 'HelpPage.jsx'], /t\('help\.bespoke', \{ days: facts\.bespokeDays \}\)/, 'the bespoke lead time comes from Studio here too'],
  [['pages', 'HelpPage.jsx'], /hours: PAYMENT_RESERVATION_TTL_HOURS/, 'the hold is the same hours the payment page counts down'],
]) assert.match(read(...file), pattern, `${file.join('/')}: ${why}`);
// Any message that names a fact placeholder must be one of the sentences checked above — a new one would
// otherwise print "{days}" on some screen nobody looked at.
const messages = read('i18n', 'messages.js');
const factKeys = [...new Set([...messages.matchAll(/["']([\w.]+)["']:\s*["'][^\n]*\{(?:days|hours)\}/g)].map((m) => m[1]))].sort();
assert.deepEqual(factKeys, ['bsp.lead', 'bsp.preorderConfirm', 'help.bespoke', 'help.dispatch', 'help.orderEn', 'help.orderIdDoku',
  'help.orderIdTransfer', 'help.problemPromise', 'pay.quoteBody'], `a fact placeholder appeared in: ${factKeys.join(', ')}`);
// The promises are EMPTY until Dekito sets them: the shop says nothing on his behalf.
assert.equal(DEFAULT_SITE_FACTS.dispatchDays, '', 'no dispatch promise by default');
assert.equal(DEFAULT_SITE_FACTS.problemReportDays, 0, 'no broken-parcel window by default');
assert.equal(DEFAULT_SITE_FACTS.contactEmail, '', 'no email by default');
assert.equal(normalizeSiteFacts({ dispatchDays: '1-3', problemReportDays: '2', contactEmail: ' halo@solivagantscent.com ' }).dispatchDays, '1–3');
assert.equal(normalizeSiteFacts({ problemReportDays: '2' }).problemReportDays, 2);
assert.equal(normalizeSiteFacts({ problemReportDays: 99 }).problemReportDays, 0, 'a typo falls back to no promise, never a bigger one');
assert.equal(normalizeSiteFacts({ contactEmail: ' halo@solivagantscent.com ' }).contactEmail, 'halo@solivagantscent.com');
assert.equal(normalizeSiteFacts({ contactEmail: 'not an email' }).contactEmail, '', 'a broken address is not printed');
// The build prints bsp.lead for readers without JavaScript; it must fill it from the saved row.
const build = readFileSync(join(src, '..', 'tools', 'build.mjs'), 'utf8');
assert.match(build, /translate\(lang, page\.leadKey, \{ days: facts\.bespokeDays \}\)/, 'the build prints the lead sentence unfilled');
assert.match(build, /const facts = await fetchSiteFacts\(env\);/, 'the build never reads the saved facts');
// Code for a pending migration must not ship: the build fails on a refused query instead of dropping pages.
assert.match(build, /if \(\/Supabase 4\\d\\d \/\.test\(String\(error\.message \|\| ''\)\) && !process\.env\.SEO_ALLOW_EMPTY_CATALOG\) \{/,
  'a query the database refuses (a column not migrated yet) must fail the build, not quietly drop every product page');

// --- 3. Anyone reads, only an admin writes ---------------------------------------------------------------
const migrations = join(src, '..', '..', '..', 'supabase', 'migrations');
const creator = readdirSync(migrations).filter((name) => /create table if not exists public\.storefront_site_settings/.test(readFileSync(join(migrations, name), 'utf8')));
assert.equal(creator.length, 1, `exactly one migration creates the facts table, found ${creator.join(', ') || 'none'}`);
const sql = readFileSync(join(migrations, creator[0]), 'utf8');
assert.match(sql, /for select using \(true\)/, 'every buyer must be able to read the facts');
assert.match(sql, /for insert with check \(public\.is_admin\(\)\)/, 'a signed-in customer could create the row');
assert.match(sql, /for update using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/, 'a signed-in customer could rewrite the shop');
assert.doesNotMatch(sql, /grant[^;]*delete[^;]*storefront_site_settings/i, 'nobody needs to delete the one row');

console.log('siteFacts selfcheck OK (an empty row says what the shop said, every fact reaches its sentence and the build, admin-only writes)');
