// `node src/utils/opacitySteps.selfcheck.mjs`
//
// Fourth visitor audit, 13 Nov 2026: "Perbesar foto" opened the big photo straight over the page — text,
// prices and arrows showing through — because `bg-black/92` is not on Tailwind's opacity scale and so
// compiled to nothing. The same silent miss hid the dividers on Help and About (`border-ng-bone/12`).
// A colour with `/<step>` only works when the step is on the scale: the default one, or the steps
// tailwind.config.js adds. This sweep reads every such class in src and fails on a step that would vanish.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const config = readFileSync(join(src, '..', 'tailwind.config.js'), 'utf8');

const DEFAULT_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
const extended = config.match(/opacity:\s*\{([^}]*)\}/);
assert.ok(extended, 'tailwind.config.js extends the opacity scale');
const steps = new Set([...DEFAULT_STEPS, ...[...extended[1].matchAll(/(\d+):/g)].map((m) => Number(m[1]))]);

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(jsx|js)$/.test(name) && !name.endsWith('.selfcheck.mjs')) files.push(path);
  }
};
walk(src);

const CLASS = /(?<![\w/-])(?:[a-z0-9-]+:)*((?:bg|text|border|ring|from|to|via|shadow|outline|fill|stroke|divide|placeholder|decoration|accent|caret)-([a-z][a-z0-9-]*)\/(\d+))(?![\w[])/g;
const missing = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const [, cls, colour, step] of text.matchAll(CLASS)) {
    if (colour === 'current') missing.push(`${cls} (currentColor takes no opacity) in ${file.slice(src.length + 1)}`);
    else if (!steps.has(Number(step))) missing.push(`${cls} in ${file.slice(src.length + 1)}`);
  }
}
assert.deepEqual(missing, [], 'a colour step that compiles to nothing');

const gallery = readFileSync(join(src, 'components', 'storefront', 'ProductGallery.jsx'), 'utf8');
assert.match(gallery, /aria-modal="true"[\s\S]{0,200}className="fixed inset-0 z-\[9999\][^"]*bg-black\/92"/, 'the photo zoom has its dark backdrop');

console.log(`opacitySteps selfcheck OK (${files.length} files; every colour/step class is on the scale)`);
