// `node src/utils/deadStylesheet.selfcheck.mjs`
//
// A class in the stylesheet that no element ever carries.
//
// 210 of them had accumulated — 23% of every class in the four style files — and the cost is not the
// bytes. It is that the next person reading `.mobile-home-hero` cannot tell whether it is the phone
// home page or a fossil of the one before it, so they leave it alone, and it outlives everything.
//
// The check is a substring search on purpose. It reports a class as LIVE if its name appears anywhere
// in any non-CSS source file, which is deliberately generous: `product-card` counts as used because
// `product-card__title` mentions it. Generous is the right direction — a false "dead" deletes working
// style, a false "live" only leaves a line behind.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
};

const files = walk(join(web, 'src'));
// src/styles/ only. index.css is the Tailwind entrypoint — its whole job is generating utility classes
// that never appear in a stylesheet, so "is this class used" is the wrong question to ask of it, and a
// scan that tried deleted `.text-balance` out of an @layer utilities block.
const styles = files.filter((f) => f.endsWith('.css') && f.includes(join('src', 'styles')));
assert.ok(styles.length >= 4, 'the hand-written stylesheets are where this guard expects them');

const source = files.filter((f) => !f.endsWith('.css')).map((f) => readFileSync(f, 'utf8')).join('\n')
  + readFileSync(join(web, 'index.html'), 'utf8');

// Added by script at runtime, so they never appear as a className on an element in the source.
const ADDED_AT_RUNTIME = new Set([
  'imm-visible',            // ImmersiveProductPage reveal
  'is-visible',             // the scroll reveal
  'mobile-field-has-error', // form validation
  'pwa-standalone',         // set on <html> when launched from the home screen
  'scroll-reveal',
  'text-revealed',
]);

// The escape hatch has to earn itself. "Script attaches it" is a claim, and a list that takes the claim
// on trust is a list anybody can hide a fossil in — a sabotage did exactly that. So each name here must
// actually appear in a classList call somewhere.
for (const name of ADDED_AT_RUNTIME) {
  assert.match(source, new RegExp(`classList[\\s\\S]{0,80}?['"\`]${name}['"\`]`),
    `${name} is listed as attached at runtime, but no classList call in the app mentions it — either it is a fossil, or the list is out of date`);
}

const dead = [];
for (const file of styles) {
  const css = readFileSync(file, 'utf8');
  for (const match of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
    const name = match[1];
    if (ADDED_AT_RUNTIME.has(name)) continue;
    if (!source.includes(name) && !dead.includes(name)) dead.push(name);
  }
}

assert.deepEqual(dead, [],
  `these classes are styled but never used — delete the rule, or add the class to ADDED_AT_RUNTIME with a reason if script attaches it:\n  ${dead.join('\n  ')}`);

// And the scan has to actually be reading something: an empty source string would make every class
// "dead", while a broken CSS glob would make every class disappear and pass forever.
assert.ok(source.length > 100000, 'the source scan is reading the app');

console.log(`deadStylesheet selfcheck OK (every class in ${styles.length} stylesheets is carried by something)`);
