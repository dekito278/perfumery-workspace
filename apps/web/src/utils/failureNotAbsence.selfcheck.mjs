// `node src/utils/failureNotAbsence.selfcheck.mjs`
//
// A request that failed knows nothing. These four screens used to answer it anyway, and each answer was
// a confident negative: "Order tidak ditemukan" for a network blip, and — worse — a green "No blocking
// references found. This material is ready to delete" produced by a dependency lookup that had thrown.
// The delete itself re-checks, so nothing was lost, but the panel turned a failure into a guarantee.
//
// PaymentPage already had the shape this borrows: orderFound is null when unsure and false only when the
// order genuinely is not there. A generic scanner is not worth it — most catches that empty a list render
// as an empty list, which is honest, and the scanner flags PaymentPage's correct tri-state too. So this
// guards the surfaces that make a claim.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const srcRoot = dirname(fileURLToPath(import.meta.url)) + '/..';
const read = (rel) => readFileSync(join(srcRoot, rel), 'utf8');

const MUST_SEPARATE = [
  ['pages/OrderDetailPage.jsx', 'loadFailed', 'a load that threw once rendered "Order tidak ditemukan"'],
  ['pages/mobile/MobileOrderDetailPage.jsx', 'loadFailed', 'same screen, mobile'],
  ['pages/RawMaterialDetailPage.jsx', 'deleteDependencyFailed', 'a failed check once read as "ready to delete"'],
  ['hooks/useRawMaterialsPage.js', 'deleteDependencyFailed', 'the list page shares that dialog'],
  ['components/ManualReferenceMatchModal.jsx', 'searchFailed', 'a failed search once read as "no matches"'],
];

for (const [file, flag, why] of MUST_SEPARATE) {
  const source = read(file);
  assert.match(source, new RegExp(`set${flag[0].toUpperCase()}${flag.slice(1)}\\(true\\)`),
    `${file} must record that the request failed — ${why}.`);
  assert.match(source, new RegExp(`set${flag[0].toUpperCase()}${flag.slice(1)}\\(false\\)`),
    `${file} must clear ${flag} when a load starts, or one failure sticks forever.`);
}

// The flag has to reach the screen; recording it and rendering the old certainty changes nothing.
for (const [file, flag] of [
  ['pages/OrderDetailPage.jsx', 'loadFailed'],
  ['pages/mobile/MobileOrderDetailPage.jsx', 'loadFailed'],
  ['components/ManualReferenceMatchModal.jsx', 'searchFailed'],
]) {
  assert.match(read(file), new RegExp(`${flag}\\s*\\?`), `${file} reads ${flag} but never renders it.`);
}
assert.match(read('components/raw-materials/RawMaterialsDeleteDependencySummary.jsx'), /if \(checkFailed\)/,
  'the shared delete dialog must answer a failed lookup before it reaches the green "ready to delete" panel');
assert.match(read('pages/RawMaterialsPage.jsx'), /checkFailed=\{page\.deleteDependencyFailed\}/,
  'the list page must pass the flag into that dialog');

// And the other direction: "not there" must not be dressed up as a failure either.
//
// The tracking page set the red error line to "Order belum ditemukan. Pastikan nomor order atau resi
// sudah benar." on an empty result — the exact two sentences the empty card directly above it was
// already showing as its heading and its body. A buyer who mistyped one digit was told twice, and the
// red made the second telling read like a different, worse problem than the first.
//
// A lookup that SUCCEEDED and found nothing is not an error. setError belongs to the catch.
{
  const page = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'pages', 'PublicTrackingPage.jsx'),
    'utf8',
  );
  const start = page.indexOf('const loadOrder = useCallback');
  assert.notEqual(start, -1, 'the tracking page still loads the order through loadOrder');
  const body = page.slice(start, page.indexOf('}, [t]);', start));
  const tryStart = body.indexOf('try {');
  const catchStart = body.indexOf('} catch (');
  assert.ok(tryStart !== -1 && catchStart > tryStart, 'loadOrder still has a try/catch');

  const tryBlock = body.slice(tryStart, catchStart);
  assert.doesNotMatch(tryBlock, /setError\(/,
    'loadOrder must not set the error line on a lookup that SUCCEEDED and found nothing — the empty '
    + 'card already says so, and the red line repeats it word for word');
  // The catch still speaks, or a real failure goes silent.
  assert.match(body.slice(catchStart), /setError\(publicErrorMessage\(/,
    'a lookup that actually failed must still say so, through publicErrorMessage');
  // And the empty card carries the not-found wording — but only when the lookup actually answered.
  // Three states, like PaymentPage's orderFound: not looked, looked and empty, could not look.
  assert.match(page, /const foundNothing = searched && !failed;/,
    '"we looked and there is nothing" must be told apart from "we could not look"');
  for (const key of ['track.notFoundEyebrow', 'track.notFoundTitle', 'track.checkNumber']) {
    assert.match(page, new RegExp(`foundNothing \\? t\\("${key.replace('.', '\\.')}"\\)`),
      `the card's "${key}" line must be gated on foundNothing, or a failed lookup claims the order does not exist`);
  }
  assert.match(page, /setFailed\(true\);/, 'and a failed lookup has to say so');

  // The service underneath must let a failure BE a failure.
  //
  // It caught everything and fell through to the browser's local copy, so a buyer whose network was
  // down — or whose Supabase call failed for any reason — got null, and the page told them their real
  // order does not exist. The page's own catch could never fire. The local copy is still tried first,
  // because a buyer who ordered on this device deserves an answer; but with nothing local, not knowing
  // is not the same as knowing there is nothing.
  const service = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'services', 'publicTrackingService.js'),
    'utf8',
  );
  const lookup = service.slice(service.indexOf('export const getPublicTrackingOrder'));
  const rescue = lookup.slice(lookup.indexOf('} catch ('));
  assert.match(rescue, /const local = getLocalTrackingOrder\(/, 'a failed lookup still tries the local copy');
  assert.match(rescue, /if \(local\)[\s\S]{0,160}?return local;/, 'and returns it when there is one');
  assert.match(rescue, /throw error;/,
    'but with nothing local it must RETHROW — returning null there tells a buyer on a flaky connection '
    + 'that their real order does not exist, and leaves the page with no failure to report');
}

// --- A body that is not JSON is a broken service, not an empty result --------------------------------
//
// The shipping helper read `await response.json().catch(() => ({}))`. An HTML page became `{}`, and `{}`
// has no destinations and no rates — so an API that was not answering looked exactly like a search that
// found nothing. The buyer sat on "Masih perlu: Area, Ongkir" with no error and no way to finish paying.
//
// Measured on the preview build, where vite serves no API routes:
//   GET /api/shipping/destinations?search=Coblong -> 200, content-type text/html, the SPA shell
// and the checkout showed nothing at all. tools/build.mjs records the same shape on Vercel: a rewrite
// whose destination is missing falls through to the catch-all and answers 200 with index.html.
//
// Tested as behaviour, with fetch stubbed — the point is what comes back, not how the file reads.
{
  const shipping = join(srcRoot, 'services', 'shippingService.js');
  const source = readFileSync(shipping, 'utf8');
  // Comments stripped FIRST. The comment above requestJson quotes the old expression verbatim, so a
  // check reading the raw file fails on the very explanation of the fix — the fifth time a comment has
  // beaten a text guard in this repo.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /response\.json\(\)\.catch\(\(\) => \(\{\}\)\)/,
    'a non-JSON body is being swallowed into an empty object again');

  const shim = join(srcRoot, 'services', `.failureNotAbsence.${process.pid}.mjs`);
  const { writeFileSync, unlinkSync } = await import('node:fs');
  // Multi-line imports too: this file opens with a braced import spanning four lines, and a per-line
  // regex leaves the tail behind — which loads as a bare '@/services' specifier Node cannot resolve.
  writeFileSync(shim, source.replace(/^import\s[\s\S]*?from\s+'[^']+';$/gm, ''));
  const stub = (body, { ok = true, status = 200 } = {}) => {
    globalThis.fetch = async () => ({ ok, status, text: async () => body });
  };
  const { searchShippingDestinations } = await import(shim);

  // 1. The failure that started this: HTML with 200.
  stub('<!doctype html><html lang="id"><head>');
  await assert.rejects(() => searchShippingDestinations('Coblong'), /unavailable/i,
    'an HTML body answered 200 must be a failure the checkout can show, not an empty list');

  // 2. A real empty answer is still empty — the honest negative must survive.
  stub(JSON.stringify({ destinations: [] }));
  assert.deepEqual(await searchShippingDestinations('Coblong'), [],
    'a genuine "nothing found" must not be turned into an error');

  // 3. A real answer still comes through.
  stub(JSON.stringify({ destinations: [{ id: '4916', label: 'CIPAGANTI, COBLONG, BANDUNG' }] }));
  assert.equal((await searchShippingDestinations('Coblong')).length, 1);

  // 4. An empty body is a real answer, not a broken one.
  stub('');
  assert.deepEqual(await searchShippingDestinations('Coblong'), []);

  // 5. And a genuine error status still carries its message.
  stub(JSON.stringify({ message: 'Kurir sedang sibuk' }), { ok: false, status: 503 });
  await assert.rejects(() => searchShippingDestinations('Coblong'), /Kurir sedang sibuk/);

  unlinkSync(shim);
}

console.log(`failureNotAbsence selfcheck OK (${MUST_SEPARATE.length} screens tell "failed" apart from "not there")`);
