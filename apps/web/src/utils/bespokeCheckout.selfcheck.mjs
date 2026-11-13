// `node src/utils/bespokeCheckout.selfcheck.mjs`
//
// Second visitor audit, 13 Nov 2026: the bespoke checkout was an older form than the main one — a SOLI code
// field the main checkout dropped (#595), "Email / WhatsApp" in one box, "TOTAL TRANSFER" under a DOKU
// payment, a line describing the interface instead of the order, and a payment form that opened for an
// empty brief (the English WhatsApp button sent "Scent: -").
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(src, 'pages', 'BespokePage.jsx'), 'utf8');

assert.doesNotMatch(page, /t\('bsp\.customerCode'\)|lookupCustomerByCode/, 'no SOLI code field on the bespoke checkout');
assert.match(page, /<input (?:id="bespoke-contact" )?type="tel" inputMode="tel" autoComplete="tel" className="ng-field" value=\{form\.contact\}/, 'the contact is a WhatsApp number');
assert.match(page, /t\(isManualPayment \? 'bsp\.transferTotal' : 'checkout\.total'\)/, '"Total transfer" only when paying by transfer');
assert.match(page, /onClick=\{\(\) => \{ if \(needsScentFirst\(\)\) return; setCheckoutOpen\(true\); \}\}/, 'no payment form for an empty brief');
assert.match(page, /if \(needsScentFirst\(\)\) \{ event\.preventDefault\(\); return; \}\s*if \(!destinationCountry\) \{ event\.preventDefault\(\); toast\.error\(t\('intlQuote\.pickFirst'\)\); \}/,
  'and no WhatsApp brief saying "Scent: -" or going to no country (third audit: the brief never said where)');
assert.match(page, /destination: destinationCountry \? countryNameFor\(destinationCountry, 'en'\) : ''/, 'the brief names the destination');
assert.match(page, /\{countryGroups\('en'\)\.map/, 'from the country list — not the area-search results that share the old name');
for (const language of ['id', 'en']) assert.match(MESSAGES[language]['bsp.waOrderDraft'], /\{destination\}/, `${language}: the brief has a destination line`);
for (const language of ['id', 'en']) {
  assert.match(MESSAGES[language]['bsp.contact'], /WhatsApp/, `${language}: the field is named for WhatsApp`);
  assert.doesNotMatch(MESSAGES[language]['bsp.contactSectionBody'], /desain|design is chosen/i, `${language}: the lead describes the order, not the interface`);
}
// Sixth visitor audit, 13 Nov 2026: the brief was lost on reload or Back, and the scent chips appended
// duplicates with no sign of what was already chosen.
assert.match(page, /\.\.\.readBespokeDraft\(referenceSlug\),/, 'the design comes back from the per-tab draft');
assert.match(page, /useEffect\(\(\) => \{ writeBespokeDraft\(form, referenceSlug\); \}, \[form, referenceSlug\]\);/);
assert.match(page, /const NOT_REMEMBERED = \['preorderAcknowledged', 'customerCode'\];/, 'consent is asked again, not remembered');
assert.equal((page.match(/clearBespokeDraft\(\);\s*navigate\(`\/payment/g) || []).length, 2, 'a placed order clears the draft');
assert.match(page, /const checkoutOpen = location\.hash === '#checkout' && Boolean\(form\.scentDescription\.trim\(\)\);/, 'the checkout step is a place in history, never open on an empty brief');
assert.match(page, /aria-pressed=\{chosen\}/, 'a scent chip shows when it is in the brief');
{
  const body = page.match(/const briefParts = [\s\S]*?\n\};/)[0].replace(/^const /gm, 'var ');
  const run = new Function(`${body}; return { scentDirectionChosen, toggleScentDirection };`)();
  assert.equal(run.toggleScentDirection('Hujan sore, teh melati', 'Woody'), 'Hujan sore, teh melati, Woody');
  assert.equal(run.toggleScentDirection('Hujan sore, teh melati, Woody, Fresh', 'Woody'), 'Hujan sore, teh melati, Fresh', 'a second tap takes it out');
  assert.equal(run.toggleScentDirection('', 'Fresh'), 'Fresh');
  assert.ok(run.scentDirectionChosen('woody, fresh', 'Woody'));
}
// The steps move, and the summary names the moment (sixth audit, 13 Nov 2026).
assert.match(page, /aria-current=\{index === currentStep \? 'step' : undefined\}/, 'the current step is marked');
assert.match(page, /const currentStep = !form\.scentDescription\.trim\(\) \? 0/, 'and follows the brief and the checkout');
assert.match(page, /<dt className="text-ng-dust">\{t\('bsp\.moment'\)\}<\/dt><dd className="m-0 text-right">\{bespokeOccasionLabel\(/, 'the summary names the moment');
console.log('bespokeCheckout selfcheck OK (one contact, the right total, no checkout without a brief)');
