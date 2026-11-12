// `node src/utils/enterAppliesCode.selfcheck.mjs`
//
// A text field with its own apply button (voucher, member code) must apply on Enter. Inside the checkout or
// bespoke <form>, Enter otherwise SUBMITS THE ORDER with the code typed and never applied; in the cart it did
// nothing. Found 12 Nov 2026. The rule is swept over every storefront page and component, not just the three
// known fields, so a fourth code field cannot be added without it.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { onEnter } from './onEnter.js';

// The helper, run.
let applied = 0; let prevented = 0;
const key = (k, composing = false) => ({ key: k, nativeEvent: { isComposing: composing }, preventDefault: () => { prevented += 1; } });
onEnter(() => { applied += 1; })(key('Enter'));
assert.equal(applied, 1, 'Enter applies'); assert.equal(prevented, 1, 'and stops the form submitting');
onEnter(() => { applied += 1; })(key('a'));
onEnter(() => { applied += 1; })(key('Enter', true));
assert.equal(applied, 1, 'other keys and an IME composition do nothing'); assert.equal(prevented, 1);

// The sweep: an <input .../> followed directly by a type="button" whose onClick applies something.
const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.jsx')) files.push(path);
  }
};
for (const dir of ['pages', join('components', 'storefront')]) walk(join(src, dir));

let found = 0;
const missing = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<input\b[\s\S]*?\/>\s*<button\s+type="button"[^>]*onClick=\{([^}]+)\}/g)) {
    if (!/apply|submit|redeem/i.test(match[1])) continue;
    found += 1;
    if (!/onKeyDown=/.test(match[0].slice(0, match[0].indexOf('/>')))) missing.push(`${file.slice(src.length + 1)} → ${match[1]}`);
  }
}
assert.ok(found >= 3, `the sweep must see the cart, checkout and bespoke voucher fields (saw ${found})`);
assert.deepEqual(missing, [], 'a code field with its own apply button must apply on Enter (onKeyDown={onEnter(...)})');
console.log(`enterAppliesCode: ${found} code field(s) apply on Enter`);
