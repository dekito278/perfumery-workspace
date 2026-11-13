// `node src/utils/formControlsVisible.selfcheck.mjs`
//
// Visitor audit, 13 Nov 2026: the bespoke page's REQUIRED pre-order box ("Saya memahami bespoke perfume adalah
// pre-order…") could not be seen on a phone, so a buyer was refused for not ticking a box they could not
// find. The phone stylesheet reset every input to `appearance: none` for iOS text fields, and a checkbox or
// radio with its native look removed and nothing drawn instead is simply not there.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const styles = join(dirname(fileURLToPath(import.meta.url)), '..', 'styles');
for (const file of ['mobile.css', 'naskah.css', 'storefront.css']) {
  const css = readFileSync(join(styles, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*appearance:\s*none[^{}]*)\}/g)) {
    const selectors = rule[1].split(',').map((part) => part.trim());
    for (const selector of selectors) {
      assert.ok(!/(^|[\s>+~])input(?![\w-]|\[type=|:not\(\[type="checkbox"\]\))/.test(selector) || /:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)/.test(selector),
        `${file}: "${selector}" strips the native look from every input — checkboxes and radios included — and draws nothing instead`);
    }
  }
}
console.log('formControlsVisible selfcheck OK (no stylesheet erases checkboxes or radios)');
