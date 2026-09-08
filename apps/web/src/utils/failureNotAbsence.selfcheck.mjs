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

console.log(`failureNotAbsence selfcheck OK (${MUST_SEPARATE.length} screens tell "failed" apart from "not there")`);
