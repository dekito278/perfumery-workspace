// `node src/utils/iconOnlyButtonHasAName.selfcheck.mjs`
//
// A button whose only content is an icon has to say what it does.
//
// Fourteen of the app's fifteen already did — the gallery arrows, the lightbox close, the mobile top-bar
// controls. The fifteenth was the little (i) beside each PACE metric in the workbook simulation panel:
// screen readers announced "button" and nothing else, so the one control that explains a score was the
// one control with no name.
//
// Named with the metric it explains. That word is already on screen beside it, so it adds no new copy to
// a Studio panel in either language.
//
// TWO WRONG DETECTORS CAME FIRST, and the first one is why this file defines "icon-only" so narrowly:
//
//   1. Stripping `{...}` out of the children to read the text flagged 22 buttons — because a translated
//      label IS an expression. `{t('bsp.apply')}` read as empty, so the voucher button, the submit
//      button and the destination search all looked nameless. Twenty-one false positives.
//   2. The fix is to require the children to be ONLY self-closing capitalised elements and whitespace,
//      with no braces at all: a brace might render text, and every t() label lives in one.
//
// A guard that cries wolf is worse than none, so the narrow definition is deliberate: it will miss a
// button that wraps its icon in a div, and it will never accuse one that has a label.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const strip = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(join(src, dir), { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) { walk(rel); continue; }
    if (/\.jsx$/.test(entry.name) && !/selfcheck/.test(entry.name)) files.push(rel);
  }
};
walk('');
assert.ok(files.length >= 150, `expected to sweep the screens; found ${files.length}`);

// Children that are only self-closing capitalised elements and whitespace. No braces: see the header.
const ICON_ONLY = /^(?:\s*<[A-Z]\w*(?:\s[^>]*)?\/>\s*)+$/;
const HAS_A_NAME = /aria-label|aria-labelledby|title=/;

const named = [];
const nameless = [];
for (const rel of files) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  for (const match of source.matchAll(/<button\b([\s\S]{0,500}?)>([\s\S]{0,260}?)<\/button>/g)) {
    const [whole, attributes, children] = match;
    if (!ICON_ONLY.test(children)) continue;
    const entry = `${rel}: ${whole.replace(/\s+/g, ' ').slice(0, 76)}`;
    (HAS_A_NAME.test(attributes) ? named : nameless).push(entry);
  }
}

console.log(`  icon-only buttons: ${named.length + nameless.length}`);
assert.ok(named.length >= 12,
  `expected the app's icon-only buttons to be found; got ${named.length}. Either they stopped being `
  + 'icon-only, or this sweep no longer sees them.');
assert.deepEqual(nameless, [],
  'these are an icon and nothing else, so assistive tech announces "button" with no idea what it does:\n  '
  + nameless.join('\n  '));

// And the name must not be a placeholder. An empty or whitespace label is the same silence, announced.
const empty = [];
for (const rel of files) {
  const source = strip(readFileSync(join(src, rel), 'utf8'));
  for (const match of source.matchAll(/aria-label=(?:"(\s*)"|\{\s*''\s*\}|\{\s*""\s*\})/g)) {
    empty.push(`${rel}: ${match[0]}`);
  }
}
assert.deepEqual(empty, [],
  'these carry an empty accessible name, which reads as an unlabelled control with extra steps:\n  '
  + empty.join('\n  '));

console.log(`iconOnlyButtonHasAName selfcheck OK (${named.length} icon-only buttons, every one named)`);
