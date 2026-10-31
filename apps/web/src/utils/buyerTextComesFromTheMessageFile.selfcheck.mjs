// `node src/utils/buyerTextComesFromTheMessageFile.selfcheck.mjs`
//
// The shop has two languages, and the strings a SCREEN READER announces were leaking in both directions:
//
//   BackToTop            aria-label="Kembali ke atas"        Indonesian, in the English shop too
//   ProductGallery x5    aria-label="Previous product image" English, in the Indonesian shop too
//   MobileProductDetail  aria-label="Product action"         same
//   MobileCommerceLayout aria-label="Solivagant owner access"
//
// The last one was its own problem. That wordmark is the OWNER's way in -- three taps opens Studio -- and
// the label announced that hidden affordance to every buyer who uses a screen reader. It says SOLIVAGANT
// now: the brand needs no translation, and the gesture goes back to being quiet.
//
// storefrontMessages.selfcheck.mjs could not catch any of it. That guard scans a hand-written list of
// Indonesian PHRASES, so a leak in English is invisible to it, and so is an Indonesian phrase nobody
// thought to add. This one reads a DIRECTORY instead -- components/storefront is buyer-facing by
// construction, so there is no list to fall behind -- and asks a different question: does every string a
// screen reader reads come from the message file?
//
// Scope is deliberately narrow and stated: this directory plus the mobile commerce layout. Buyer PAGES
// are not swept here, because no rule separates them from Studio pages by name -- MobileCustomersPage is
// Studio. Widening it means naming them, and a named list is the thing this guard exists to avoid.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { buyerSurfaces } from './buyerSurfaces.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

// Strings a screen reader or a hint field reads out, plus the ones a component renders as visible text
// when a caller hands them over as a prop. Not className, not href, not data-*. The list is measured, not
// guessed: across every buyer-reachable file these are the only text-bearing props that are ever given a
// literal, and `eyebrow` joined it because PaymentPage labelled its header "Secure" in English.
const SPOKEN_PROPS = /\b(aria-label|alt|title|subtitle|placeholder|eyebrow|\w*[Ll]abel)="([^"{}]{2,})"/g;
// And the same prop written as a TEMPLATE LITERAL, which the scan above cannot see because there is no
// double quote in it. Found on the live phone product page: the gallery's dots and thumbnails announced
// `Show product image ${index + 1}` and `Select product image ${index + 1}` — English, in the Indonesian
// shop, in a file this guard already swept. Only a template carrying WORDS counts; `${slug}-${id}` and
// the like are keys and ids, not speech.
const SPOKEN_TEMPLATES = /\b(aria-label|alt|title|subtitle|placeholder|eyebrow|\w*[Ll]abel)=\{`([^`]*[A-Za-z]{3,}[^`]*)`\}/g;
// The same question asked of a prop DEFAULT. A default is invisible to the scan above, which is how
// aria-label="Clear search" survived inside a search bar the shop and Studio share.
const SPOKEN_PROP_NAME = /^(?:aria-label|alt|title|subtitle|placeholder|eyebrow)$|[Ll]abel$/;

// Each exemption carries its reason, because an allowlist without one becomes a dumping ground.
// Public, but not the buyer's: reached only by someone who tried a protected route and was bounced to
// sign in. One reader, who speaks Indonesian — the same reason Studio stays out of MESSAGES.
const OWNER_DOOR = new Set(['LoginPage', 'MobileLoginPage', 'ResetPasswordPage']);

// Mounted in the buyer shell but gated on isAdmin inside, so a buyer never sees the words.
// storefrontMessages.selfcheck.mjs owns that rule and asserts each gate still exists; duplicating the
// assertion here would mean two places to update when a gate moves.
const SELF_GATED = new Set(['PwaUpdatePrompt', 'ConfirmHost', 'Toaster']);

const ALLOWED = new Map([
  // 'SOLIVAGANT', 'Solivagant' and 'Kembali ke dashboard Studio' were exempt here until 2026-10-31: the
  // first and last sat in the retired phone storefront's layout, the second on the old desktop logo. None
  // is written into a spoken prop any more, and an exemption nothing uses is a hole kept open for later.
  ['081234567890', 'an Indonesian phone-number example on a checkout that is domestic-only; not prose'],
  ['SOLI09232', 'an order-code example — a code format, the same characters in either language'],
  ['123456', 'a six-digit code example'],
]);

// The file set comes from buyerSurfaces.mjs, which three guards now share. Every trap that cost a leak
// is recorded there once: the lazyRoute convention, the route block that must end at the next <Route,
// and the fact that the routed file is not the screen.
const { files, routed, depthOf, resolve: resolveComponent, appSource } = buyerSurfaces({
  src,
  exclude: new Set([...OWNER_DOOR, ...SELF_GATED]),
});
assert.ok(routed.length >= 20,
  `only ${routed.length} public pages resolved from the route table — the derivation is broken, not the `
  + 'shop. The lazyRoute trap produces exactly this symptom');
for (const name of ['InternationalCartPage']) {
  assert.ok(routed.some((file) => file.endsWith(`${name}.jsx`)),
    `${name} is routed for the English shop but fell out of the sweep — it is nested inside another `
    + 'element, which is exactly what a route block cut at its first "/>" loses');
}
// The phone storefront retired on 2026-10-31, and with it the three-level path these proofs used to name
// (MobileCommerceTabsPage -> MobileArticlesPage -> MobileSearchBar). The same two traps are still proved,
// on what is left: a screen reached only by the import walk, and a file three steps down.
assert.ok(files.some((file) => file.endsWith('ImmersiveProductPage.jsx')),
  'the immersive story page is not in the sweep — no route mounts it; the product page RETURNS it for a '
  + 'product with a story, so only the import walk can find it');
// Nothing in the buyer graph sits three steps down any more (measured: the deepest is two), so the proof
// is that the walk goes past the routed file at all — which is what a one-level sweep could not do.
assert.ok(depthOf('ImmersiveProductPage') >= 2 && depthOf('JournalMarkdownContent') >= 2,
  'the stand-in story page and the article body are not reached past the routed file, so the walk is no '
  + 'longer following imports');
assert.ok(files.length >= 60,
  `only ${files.length} buyer files found — this guard's file set is broken, not the shop`);

const leaks = [];
const seen = new Set();
for (const file of files) {
  const source = strip(readFileSync(file, 'utf8'));
  for (const match of source.matchAll(SPOKEN_PROPS)) {
    const [, prop, value] = match;
    seen.add(value.trim());
    if (ALLOWED.has(value.trim())) continue;
    leaks.push(`${file.replace(`${src}/`, '')}  ${prop}="${value.trim()}"`);
  }
  for (const match of source.matchAll(SPOKEN_TEMPLATES)) {
    const [, prop, value] = match;
    // A template made only of interpolations and punctuation is an id, not a sentence. What is left
    // after the ${...} holes are removed has to contain a word before this complains.
    const spoken = value.replace(/\$\{[^}]*\}/g, ' ').trim();
    if (!/[A-Za-z]{3,}/.test(spoken)) continue;
    leaks.push(`${file.replace(`${src}/`, '')}  ${prop}={\`${value.trim()}\`}`);
  }
}
assert.deepEqual(leaks, [],
  'a string a screen reader reads is written straight into a buyer-facing file instead of coming from the '
  + `message file, so it is wrong in one of the two shops:\n  ${leaks.join('\n  ')}`);

// --- A default is a string too ----------------------------------------------------------------------
// MobileSearchBar hard-coded aria-label="Clear search", and no caller could fix it: Studio renders that
// bar too, so the string cannot simply be translated. The repair is a prop whose default stays Studio's
// — which moves the string somewhere the attribute scan above cannot see it. So the rule is: a shared
// control may keep a spoken default, but every buyer-facing caller has to override it.
const openingTag = (text, from) => {
  let depth = 0;
  let quote = null;
  for (let index = from; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    } else if (char === '>' && depth === 0) {
      return text.slice(from, index + 1);
    }
  }
  return text.slice(from);
};
// `'aria-label': ariaLabel = 'Mobile actions'` is one prop with two names; the JSX one is what a caller
// writes, and reading the alias instead reported all six action bars as unfixed when all six pass it.
const spokenDefaults = new Map();
for (const file of files) {
  const text = strip(readFileSync(file, 'utf8'));
  for (const match of text.matchAll(/(?:'([^']+)'\s*:\s*\w+|\b(\w+))\s*=\s*'([^']{2,})'\s*(?=,|\n\s*\})/g)) {
    const prop = match[1] || match[2];
    if (!SPOKEN_PROP_NAME.test(prop)) continue;
    if (!spokenDefaults.has(file)) spokenDefaults.set(file, []);
    spokenDefaults.get(file).push({ prop, value: match[3] });
  }
}
const defaultedProps = [...spokenDefaults.values()].flat().map((entry) => entry.prop);
const declaredDefaults = new Set([...spokenDefaults.values()].flat().map((entry) => entry.value));
// clearLabel (MobileSearchBar) and backLabel (MobileTopBar) left the buyer scope with the phone storefront
// on 2026-10-31. The spinner's quoted 'aria-label' default is the one still in scope, and it is the harder
// case for the regex: a quoted key renamed on destructure.
for (const prop of ['aria-label']) {
  assert.ok(defaultedProps.includes(prop),
    `the default scan never found ${prop}, which is declared with a string default in a file in scope — `
    + 'it has stopped reading defaults, so the check below is passing on nothing');
}

const defaultLeaks = [];
for (const file of files) {
  const text = strip(readFileSync(file, 'utf8'));
  // Every name an import clause brings in, default AND named: the ui primitives arrive as
  // `import { Spinner } from ...`, and a default-import-only pattern left this rule silent for all of
  // them — removing the storefront spinner's aria-hidden walked straight past it.
  const rendered = new Map();
  for (const match of text.matchAll(/import\s+([^;]*?)\s+from\s+'@\/([^']+)'/g)) {
    const target = resolveComponent(match[2]);
    if (!target || !spokenDefaults.has(target)) continue;
    for (const name of match[1].match(/[A-Z]\w+/g) || []) rendered.set(name, target);
  }
  for (const [name, target] of rendered) {
    for (const match of text.matchAll(new RegExp(`<${name}(?=[\\s/>])`, 'g'))) {
      const tag = openingTag(text, match.index);
      // aria-hidden settles it too: a control removed from the accessibility tree says nothing in any
      // language, which is the right answer for a spinner sitting beside a translated loading line.
      if (/(?:^|\s)aria-hidden\s*=/.test(tag)) continue;
      for (const { prop, value } of spokenDefaults.get(target)) {
        if (new RegExp(`(?:^|\\s)${prop}\\s*=`).test(tag)) continue;
        // The allowlist answers defaults as well as attributes, and for the same reason: the brand name
        // is the same word in both shops, so a caller has nothing to override.
        if (ALLOWED.has(value)) continue;
        defaultLeaks.push(`${file.replace(`${src}/`, '')}  <${name}> leaves ${prop} at "${value}"`);
      }
    }
  }
}
assert.deepEqual(defaultLeaks, [],
  'a buyer-facing screen renders a shared control without overriding a spoken prop, so the control falls '
  + `back to the one language its default is written in:\n  ${defaultLeaks.join('\n  ')}`);

// --- The scan proves itself ---------------------------------------------------------------------------
// If SPOKEN_PROPS stopped matching, the leak assertion above would pass on a shop full of leaks. So the
// proof runs THROUGH the same regex: the strings the allowlist exempts are real literals in these files,
// so the scan must have seen them. Checking the raw file text instead proves nothing about the regex —
// which is exactly how a sabotaged pattern walked past the first version of this file.
const MUST_BE_SEEN = ['081234567890', 'SOLI09232'];
for (const value of MUST_BE_SEEN) {
  assert.ok(ALLOWED.has(value), `${value} must stay on the allowlist with its reason`);
  assert.ok(seen.has(value),
    `the scan never saw "${value}", which is written into a file in scope — SPOKEN_PROPS has stopped `
    + 'matching, so the leak check above is passing on nothing');
}

// --- The keys the fixed labels now use must exist in BOTH shops --------------------------------------
// A missing key renders the key itself, which is worse than either language.
// a11y.productAction, a11y.back, a11y.clearSearch and pay.secureEyebrow left with the phone storefront
// (2026-10-31); storefrontMessages refuses a key nothing reads, so they are gone from the file too.
const PAIRED_KEYS = [
  'a11y.backToTop', 'a11y.galleryPrevImage', 'a11y.galleryNextImage',
  'a11y.galleryCloseZoom', 'a11y.galleryPrev', 'a11y.galleryNext',
  'a11y.breadcrumb', 'bsp.contactPlaceholder',
  'a11y.galleryShowImage', 'a11y.gallerySelectImage', 'a11y.galleryZoom',
];
for (const key of PAIRED_KEYS) {
  for (const shop of ['id', 'en']) {
    assert.ok(MESSAGES[shop]?.[key], `${key} is missing from the ${shop} shop`);
  }
  assert.notEqual(MESSAGES.id[key], MESSAGES.en[key],
    `${key} reads the same in both shops — one of them has not been translated`);
}

// --- A sentence written straight into the JSX, that the message file already translates ---------------
// Everything above reads PROPS. A string written as a text CHILD — `<div>{code} diterapkan</div>` — is
// invisible to that scan, and four were sitting in the shop:
//
//   MobileBespokePage   "{code} diterapkan"   the English bespoke form said it in Indonesian
//   MobileCartPage      "{n} item"            the English cart said "2 item"
//   MobileCheckoutPage  "{n} item"            same
//   MobileArticlesPage  "Journal"             the INDONESIAN journal badge said JOURNAL, not JURNAL
//
// Every one of the four had a key already sitting in the message file, translated, unused. So the
// subject is derived from the message file rather than from a list of phrases: a text child that
// matches a message WHOSE TWO SHOPS DISAGREE has to come from t(), because that is exactly the string
// that leaks. A child matching a message that reads the same in both — "Total", "Voucher" — cannot leak
// and is left alone, which also keeps this from dragging a cart into an invoice's namespace to satisfy
// a rule.
const normalise = (text) => text.replace(/\{[^}]*\}/g, '{}').replace(/\s+/g, ' ').trim().toLowerCase();
const translatedDifferently = new Map();
for (const [key, indonesian] of Object.entries(MESSAGES.id)) {
  const english = MESSAGES.en[key];
  if (typeof indonesian !== 'string' || typeof english !== 'string') continue;
  if (normalise(indonesian) === normalise(english)) continue;
  for (const value of [indonesian, english]) {
    const text = normalise(value);
    if (text.length > 2) translatedDifferently.set(text, key);
  }
}
assert.ok(translatedDifferently.size > 1000,
  `only ${translatedDifferently.size} messages differ between the shops — the message file is not being `
  + 'read, and this check would then pass anything');

// A text child, expression children and all: `>{code} diterapkan<`. Anything with JavaScript in it is a
// ternary or an arrow the brace-matching walked into, not a sentence.
let childrenChecked = 0;
for (const file of files) {
  const source = strip(readFileSync(file, 'utf8'));
  for (const match of source.matchAll(/>((?:[^<>]|\{[^{}]*\})+)</g)) {
    const raw = match[1];
    if (!/[A-Za-z]{3}/.test(raw)) continue;
    if (/=>|;|\breturn\b/.test(raw)) continue;
    childrenChecked += 1;
    const key = translatedDifferently.get(normalise(raw));
    if (!key) continue;
    assert.fail(`${basename(file)} writes "${raw.replace(/\s+/g, ' ').trim().slice(0, 60)}" straight into `
      + `the JSX, and the message file already translates it as ${key}. One shop is reading the other `
      + "shop's words");
  }
}
// --- A string in a JSX EXPRESSION, which neither scan above can see ----------------------------------
// The section above reads text CHILDREN. `{v.availability !== 'Available' ? ' (Habis)' : ''}` is not a
// child, it is a literal inside a ternary — and the desktop product page had exactly that, marking a
// sold-out bottle size "(Habis)" in the English shop, while the phone page and the immersive page both
// said t('pdp.soldOutOption') two lines from the same spot. Three pages, one control, one of them
// speaking for itself.
//
// Matching whole sentences cannot catch it: "(Habis)" is not any message's value. So the subject is the
// message file's own Indonesian VOCABULARY — every word that appears in an Indonesian message and not in
// its English twin, minus every word English uses anywhere (which keeps the loanwords the shop says in
// both languages: member, voucher, bespoke, total).
const idWords = (text) => String(text).toLowerCase().match(/[a-zà-ÿ]{4,}/g) || [];
const indonesianVocabulary = new Set();
for (const [key, indonesian] of Object.entries(MESSAGES.id)) {
  const english = MESSAGES.en[key];
  if (typeof indonesian !== 'string' || typeof english !== 'string') continue;
  const inEnglish = new Set(idWords(english));
  for (const word of idWords(indonesian)) if (!inEnglish.has(word)) indonesianVocabulary.add(word);
}
for (const english of Object.values(MESSAGES.en)) for (const word of idWords(english)) indonesianVocabulary.delete(word);
assert.ok(indonesianVocabulary.size > 300,
  `only ${indonesianVocabulary.size} Indonesian words were derived from the message file — the derivation `
  + 'broke, and this check would then pass anything');
assert.ok(indonesianVocabulary.has('habis'), 'the vocabulary holds the word that was found hardcoded');
assert.ok(!indonesianVocabulary.has('member') && !indonesianVocabulary.has('voucher'),
  'a word the shop says in both languages is not Indonesian for this purpose');

// THE OWNER'S DOOR IS NOT A BUYER SURFACE. These three are reachable by URL, so buyerSurfaces finds
// them, but they are the Studio sign-in — Indonesian-only is Dekito's decision, not an oversight, and
// translating them was explicitly out of scope. Every other file on the list must speak from the
// message file.
const OWNERS_DOOR = new Set(['LoginPage.jsx', 'MobileLoginPage.jsx', 'ResetPasswordPage.jsx']);

// AND SO IS ANYTHING BEHIND isAdmin. The phone layout's floating Studio link is labelled "Kembali ke
// dashboard Studio" and the PWA update prompt is written in Indonesian throughout — both correct, both
// rendered only for Dekito. That exemption is derived from the GATE in the code, not from a list of
// files: a layout can hold buyer chrome and an owner's button in the same file, and a file-level skip
// would blind this scan to the buyer half.
const adminOnlyRanges = (source) => {
  const ranges = [];
  for (const match of source.matchAll(/\{\s*isAdmin\s*(?:\?|&&)/g)) {
    let depth = 0;
    for (let i = match.index; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) { ranges.push([match.index, i]); break; }
      }
    }
  }
  return ranges;
};
// There is deliberately no whole-component form of this: PwaUpdatePrompt returns null unless isAdmin,
// and SELF_GATED at the top of this file already keeps it out of `files`. A second derivation for it
// measured zero hits, so it is not written here.
let literalsChecked = 0;
for (const file of files) {
  if (OWNERS_DOOR.has(basename(file))) continue;
  // og:type is "website", twitter:card is "summary_large_image", og:locale is "id_ID": Open Graph
  // ENUMS, fixed by the protocol, not sentences anyone reads. "website" lands in the vocabulary above
  // because an Indonesian message happens to use the word and no English one does — so these tags come
  // out before the scan, by the attribute that makes them enums, not by whitelisting the word.
  const source = strip(readFileSync(file, 'utf8'))
    .replace(/<meta\s+(?:property|name)="(?:og:type|og:locale|twitter:card)"[^>]*\/>/g, '');
  const adminOnly = adminOnlyRanges(source);
  for (const match of source.matchAll(/'((?:[^'\\\n]|\\.){2,120})'|"((?:[^"\\\n]|\\.){2,120})"/g)) {
    if (adminOnly.some(([from, to]) => match.index > from && match.index < to)) continue;
    const literal = match[1] ?? match[2];
    // An IDENTIFIER is not a sentence. `key: 'aroma'` names a bespoke step whose visible label is
    // t('bsp.stepScent') two lines below it, and `'website'` is an og:type. In this codebase a bare
    // lowercase word with no space and no punctuation is always code — a string a buyer reads is
    // capitalised, spaced or punctuated. " (Habis)" is all three, which is why it is caught.
    if (/^[a-z][a-z0-9]*$/.test(literal.trim())) continue;
    // A SPOKEN DEFAULT is already governed, by the section above: a shared control may keep a Studio
    // default as long as every buyer-facing caller overrides it, and MobileTopBar's backLabel="Kembali"
    // is exactly that — the one buyer page that renders it passes t('a11y.back'). Flagging it here would
    // contradict an assertion in this same file, which is worse than missing it.
    if (declaredDefaults.has(literal)) continue;
    literalsChecked += 1;
    const indonesian = idWords(literal).filter((word) => indonesianVocabulary.has(word));
    if (!indonesian.length) continue;
    const line = source.slice(0, match.index).split('\n').length;
    assert.fail(`${basename(file)}:${line} writes the Indonesian word${indonesian.length > 1 ? 's' : ''} `
      + `${indonesian.join(', ')} into the code as "${literal.trim().slice(0, 48)}" — the English shop `
      + 'renders this file too, so it has to come from the message file');
  }
}

// --- And the HOOKS, which no scan in this file could see --------------------------------------------
// buyerSurfaces follows imports from pages, components and layouts. It does NOT follow hooks/ — so every
// string inside a hook was invisible to all three scans above, and the hooks are where the toasts live.
// useSignOut said toast.success('Berhasil keluar') under a button labelled t('cust.signOut'): the English
// customer portal offered "Sign out" and then confirmed it in Indonesian.
//
// Most hook strings are CORRECT, though, and the exemption has to be sound rather than convenient:
// useCheckoutFlow holds 32 Indonesian sentences and every one belongs there, because /checkout and
// /mobile/checkout are wrapped in <DomesticOnly> and an international visitor is redirected away before
// the hook ever runs. A route gate is absolute, so that is the only proof accepted here.
//
// Two things this derivation deliberately does NOT accept:
//   - A PAGE that merely mentions isInternational. CustomerPortalPage reads it five times and is still
//     where the sign-out leak lived, because the toast sits outside every one of those branches.
//   - An import of some OTHER name from the module. CustomerPortalPage imports seedCheckoutDraft out of
//     useCheckoutFlow.js, which is a pure function that says nothing; following the module rather than
//     the `use*` binding reported all 32 checkout strings as reachable from the portal.
// A gate INSIDE a page (bespokeTakesPayment) is invisible here on purpose: it cannot be proved from
// App.jsx, so a hook reached that way must speak from the message file like everything else.
const routeGated = new Set();
for (const match of appSource.matchAll(/<DomesticOnly>\s*<(\w+)/g)) routeGated.add(match[1]);
for (const match of appSource.matchAll(/domestic=\{<(\w+)/g)) routeGated.add(match[1]);
// The self-proof must not name a page whose gate is itself the subject: naming CheckoutPage here meant
// that REMOVING its <DomesticOnly> failed this line instead of the per-hook check below, reporting "the
// scan stopped reading App.jsx" for a change that left the scan working perfectly. So it proves the two
// SHAPES — the wrapper and the ByShop prop — on whatever still uses them.
assert.ok([...appSource.matchAll(/<DomesticOnly>\s*<\w+/g)].length >= 1,
  'no <DomesticOnly><Page> pair left in App.jsx for the wrapper pattern to match — the scan has gone '
  + 'blind and every hook would look domestic');
assert.ok([...appSource.matchAll(/domestic=\{<\w+/g)].length >= 1,
  'no domestic={<Page …>} prop left in App.jsx for the ByShop pattern to match — same blindness, and the '
  + 'cart hooks would stop being recognised as domestic');

const hookReach = new Map();
for (const file of files) {
  const source = strip(readFileSync(file, 'utf8'));
  const page = basename(file, '.jsx');
  for (const match of source.matchAll(/import\s*(?:\{([^}]*)\}|(use[A-Z]\w*))\s*from\s*'@\/(hooks\/[^']+)'/g)) {
    const names = (match[1] || match[2] || '').split(',').map((name) => name.trim().split(/\s+as\s+/)[0]);
    if (!names.some((name) => /^use[A-Z]/.test(name))) continue;
    const hook = join(src, match[3].replace(/\.js$/, ''));
    if (!hookReach.has(hook)) hookReach.set(hook, new Set());
    hookReach.get(hook).add(page);
  }
}
assert.ok(hookReach.size >= 15, `only ${hookReach.size} hooks were traced from buyer surfaces`);

let hookLiterals = 0;
let domesticHooks = 0;
for (const [hook, pages] of hookReach) {
  const path = existsSync(`${hook}.js`) ? `${hook}.js` : `${hook}.jsx`;
  if (!existsSync(path)) continue;
  if ([...pages].every((page) => routeGated.has(page))) { domesticHooks += 1; continue; }
  const source = strip(readFileSync(path, 'utf8'));
  for (const match of source.matchAll(/'((?:[^'\\\n]|\\.){2,160})'|"((?:[^"\\\n]|\\.){2,160})"/g)) {
    const literal = match[1] ?? match[2];
    if (/^[a-z][a-z0-9]*$/.test(literal.trim())) continue;
    hookLiterals += 1;
    const indonesian = idWords(literal).filter((word) => indonesianVocabulary.has(word));
    if (!indonesian.length) continue;
    const line = source.slice(0, match.index).split('\n').length;
    assert.fail(`${basename(path)}:${line} speaks Indonesian — "${literal.trim().slice(0, 44)}" — and is `
      + `reached from ${[...pages].filter((page) => !routeGated.has(page)).join(', ')}, whose route is not `
      + 'DomesticOnly, so the English shop runs it too');
  }
}
assert.ok(domesticHooks >= 1,
  'no hook qualified as domestic-only, so the route-gate exemption is doing nothing and useCheckoutFlow '
  + 'would be failing this check');

// --- Every buyer page's own description, from the message file ---------------------------------------
// A meta description is the one sentence a search result and a shared link show, and it is the easiest
// string in the shop to hardcode because nothing on screen ever reveals it. Fourteen buyer pages read
// theirs through t(). Three did not, and they disagreed with each other: the desktop home page described
// itself in Indonesian, the desktop catalogue in English, and the phone catalogue in Indonesian — so
// whichever shop a visitor was in, some page answered in the other language.
// THE SCAN PROVES ITSELF FIRST. A count floor cannot defend this one: narrowing the pattern so it only
// matches a short content still matches all fourteen `content={t('...')}` tags and keeps the count up,
// while skipping exactly the thing being looked for — a long sentence written in. So the pattern is run
// against a hardcoded description as long as the one that was actually found, and against a t() one.
const DESCRIPTION = /<meta\s+name="description"\s+content=(.{0,200}?)\/>/gs;
const findsDescription = (markup) => [...markup.matchAll(new RegExp(DESCRIPTION.source, 'gs'))].map((m) => m[1].trim());
assert.deepEqual(
  findsDescription('<meta name="description" content="SOLIVAGANT adalah atelier parfum artisan oleh Dekito '
    + '— merakit karya olfaktori yang tenang dari raw material, kenangan, dan ritual pribadi." />'),
  ['"SOLIVAGANT adalah atelier parfum artisan oleh Dekito — merakit karya olfaktori yang tenang dari raw '
    + 'material, kenangan, dan ritual pribadi."'],
  'the description pattern must still see a long hardcoded sentence — that is the whole subject');
assert.deepEqual(findsDescription("<meta name=\"description\" content={t('home.meta')} />"), ["{t('home.meta')}"],
  'and a translated one, so the check below is comparing like with like');

let describedPages = 0;
for (const file of files) {
  if (OWNERS_DOOR.has(basename(file))) continue;
  const source = strip(readFileSync(file, 'utf8'));
  for (const match of source.matchAll(new RegExp(DESCRIPTION.source, 'gs'))) {
    const content = match[1].trim();
    describedPages += 1;
    assert.ok(!/^["']/.test(content),
      `${basename(file)} hardcodes its meta description — ${content.slice(0, 60)}. One of the two shops `
      + 'will be described in the other shop\'s language');
  }
}
// Floor lowered from 14 when the phone storefront retired (2026-10-31): five phone pages and two phone
// branches (the article view and the member portal) each carried their own description. Measured: 11.
assert.ok(describedPages >= 11,
  `only ${describedPages} buyer pages were checked for a description — the sweep used to find 17, so it `
  + 'has gone blind');

// --- And the wordmark must not advertise the owner's door --------------------------------------------
// The owner tap lives on the shared header's wordmark since the phone storefront retired (2026-10-31).
const layout = readFileSync(join(src, 'components', 'storefront', 'PublicHeader.jsx'), 'utf8');
assert.ok(!/aria-label="[^"]*owner access"/i.test(layout),
  'the brand wordmark announces the owner entrance again — three taps on it opens Studio, and saying so '
  + 'in its label tells every screen-reader buyer about a door meant to be quiet');

console.log(`buyerTextComesFromTheMessageFile selfcheck OK (${files.length} buyer-facing files, every `
  + `spoken string from the message file, ${spokenDefaults.size} shared controls with a spoken default, `
  + `${PAIRED_KEYS.length} keys paired across both shops, ${childrenChecked} text children checked against `
  + `${translatedDifferently.size} messages the two shops disagree on, ${literalsChecked} string literals `
  + `against ${indonesianVocabulary.size} Indonesian words, ${describedPages} page descriptions, `
  + `${hookLiterals} literals in ${hookReach.size - domesticHooks} hooks the English shop can reach)`);
