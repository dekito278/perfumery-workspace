// `node src/utils/phoneLabSpeaksIndonesian.selfcheck.mjs`
//
// The phone Studio's lab side — raw materials, formulas, batches, costing, validation — came over from
// another app in English and was half-translated afterwards. Dekito works it from his phone, and on
// 2026-11-08 the same card read "Edit Stock" beside "Batch disimpan" beside "Update Stock & Price". All
// of it was put into Indonesian that day (606 English candidates in those files down to 0 that are not
// console lines, stored data or loanwords).
//
// The subject is read off the router: every /mobile/ route under those five areas, the screen it mounts,
// and every component file those screens import, however deep. It is NOT the rest of the phone Studio —
// the commerce side keeps loanwords on purpose (Orders, Fulfillment, Vouchers) — and it is not hooks,
// services or PDF exports: what is checked is what a JSX file puts on screen, in four shapes:
//   text between tags, a spoken attribute (placeholder, title, aria-label, label, …), and a toast.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appImports, routeBlocks } from './buyerSurfaces.mjs';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(src, 'App.jsx'), 'utf8');
const imports = appImports(app);
const LAB = /^\/mobile\/(?:raw-material|formulas|batches|validation|production-costing|categories)/;

const screens = new Set();
for (const block of routeBlocks(app)) {
  const path = (block.match(/path="([^"]+)"/) || [])[1];
  if (!path || !LAB.test(path) || /element=\{\s*<Navigate/.test(block)) continue;
  for (const [, name] of block.matchAll(/<(\w+)[\s/>]/g)) {
    if (imports.has(name) && imports.get(name).startsWith('pages/')) screens.add(join(src, imports.get(name)));
  }
}
assert.ok(screens.size >= 12, `only ${screens.size} lab screens resolved from App.jsx — the parse is broken, not the router`);

const resolveImport = (from, spec) => {
  const base = spec.startsWith('@/') ? join(src, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  return ['.jsx', '/index.jsx', ''].map((ext) => base + ext).find((file) => file.endsWith('.jsx') && existsSync(file)) || null;
};
const files = new Set(screens);
for (const file of files) {
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const next = resolveImport(file, spec);
    // components/ui is the shadcn kit — no words of its own.
    if (next && !next.includes('/components/ui/') && !next.endsWith('App.jsx')) files.add(next);
  }
}
assert.ok(files.size >= 30, `only ${files.size} files reached from the lab screens — the walk is not following imports`);

// Words that only English uses. Loanwords this Studio keeps on purpose — batch, formula, QC, HPP, IFRA,
// supplier, workbook, Edit, Detail, Mode, Total, Status — are absent by design.
const ENGLISH = /\b(?:the|and|with|your|this|that|from|into|for|of|is|are|no|not|yet|save|saving|cancel|delete|add|new|search|loading|failed|update|create|choose|select|open|close|back|show|hide|stock|price|material|materials|notes|empty|required|optional|archive|archived|restore|summary|ready|needs|cleanup|draft|unknown|filter|clear|remove|import|export|download|copy|more|less|retry|again|something|wrong|success|deleted|saved|updated|created)\b/i;

const spoken = (source) => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  return [
    ...[...code.matchAll(/>\s*([A-Za-z][^<>{}\n]*?)\s*</g)].map((m) => m[1]),
    ...[...code.matchAll(/\b(?:placeholder|title|aria-label|label|description|subtitle|helper|eyebrow|alt)=["']([^"']+)["']/g)].map((m) => m[1]),
    ...[...code.matchAll(/\btoast(?:\.\w+)?\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
  ];
};

const english = [];
let checked = 0;
for (const file of files) {
  for (const text of spoken(readFileSync(file, 'utf8'))) {
    checked += 1;
    // An interpolation is data, and a reference source keeps its own name.
    const words = text.replace(/\$\{[^}]*\}/g, ' ').replace(/The Good Scents Company|Perfumer's World|ScenTree/g, ' ');
    if (ENGLISH.test(words)) english.push(`${file.slice(src.length + 1)}  "${text}"`);
  }
}
assert.ok(checked >= 500, `only ${checked} spoken strings read — the extraction is broken, and this would pass anything`);
assert.deepEqual(english, [],
  'these phone lab screens speak English to Dekito again. Put them into Indonesian with the words the rest '
  + `of the lab uses (bahan baku, pengenceran, pelarut, HPP, stok, harga):\n  ${english.join('\n  ')}`);

console.log(`phoneLabSpeaksIndonesian selfcheck OK (${screens.size} screens, ${files.size} files, ${checked} spoken strings, none in English)`);
