// `node src/utils/phoneLabSpeaksIndonesian.selfcheck.mjs`
//
// The phone Studio's lab side — raw materials, formulas, batches, costing, validation — came over from
// another app in English and was half-translated afterwards. Dekito works it from his phone, and on
// 2026-11-08 the same card read "Edit Stock" beside "Batch disimpan" beside "Update Stock & Price". All
// of it was put into Indonesian that day (606 English candidates in those files down to 0 that are not
// console lines, stored data or loanwords).
//
// The subject is read off the router: every /mobile/ route under those five areas, the screen it mounts,
// and every file those screens import, however deep. It is NOT the rest of the phone Studio — the
// commerce side keeps loanwords on purpose (Orders, Fulfillment, Vouchers) — so the walk stops at the
// shop's own modules, and it skips the PDF/CSV exports, which are documents with their own language.
//
// A JSX file is read for what it puts on screen: text between tags, a spoken attribute (placeholder,
// title, aria-label, label, …), and a toast. A plain .js module never renders, but it hands the screens
// their words: the PACE engine's axis names and warnings, the score bands, the validation errors and the
// `throw new Error(...)` a page shows as `toast.error(error.message)`. Those were left out until
// 2026-11-09 and the formula detail page was still telling Dekito "Bridge quality is weak" under a
// "Papan PACE" heading. A module is read for those shapes: a label/title/message/helper/description/
// reason property, an Error, a pushed validation error, and a toast.
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
  return ['', '.jsx', '.js', '/index.jsx', '/index.js'].map((ext) => base + ext)
    .find((file) => /\.jsx?$/.test(file) && existsSync(file)) || null;
};
// Where the walk stops. The bespoke template pulls in the order service, a finished batch pulls in the
// product catalogue, and from there the storefront's own copy (data/, i18n/) — none of it is the lab.
const SHOP = /\/(?:data|i18n)\/|\/services\/(?:order|customer|voucher|productCatalog|productImageStorage|journalPosts\w*)Service\.js$|\/utils\/(?:bespokeOrder|voucherValidation)\.js$|Exports?\.js$/;
const files = new Set(screens);
for (const file of files) {
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const next = resolveImport(file, spec);
    // components/ui is the shadcn kit — no words of its own.
    if (next && !next.includes('/components/ui/') && !next.endsWith('App.jsx') && !SHOP.test(next)) files.add(next);
  }
}
const jsx = [...files].filter((file) => file.endsWith('.jsx'));
const modules = [...files].filter((file) => file.endsWith('.js'));
assert.ok(jsx.length >= 30, `only ${jsx.length} components reached from the lab screens — the walk is not following imports`);
assert.ok(modules.length >= 60, `only ${modules.length} modules reached from the lab screens — the walk is not following .js imports`);
for (const engine of ['utils/formulaWorkbookSimulation.js', 'utils/paceScoreBands.js', 'utils/formulaCalculations.js']) {
  assert.ok(files.has(join(src, engine)), `${engine} is no longer reached — the walk lost the PACE engine and would pass anything it says`);
}

// Words that only English uses. Loanwords this Studio keeps on purpose — batch, formula, QC, HPP, IFRA,
// supplier, workbook, Edit, Detail, Mode, Total, Status — are absent by design.
const ENGLISH = /\b(?:must|opening|heart|drydown|diffusion|tenacity|harmony|smoothness|bridge|strong|healthy|weak|guidance|ingredient|merge|review|bottle|labor|packaging|the|and|with|your|this|that|from|into|for|of|is|are|no|not|yet|save|saving|cancel|delete|add|new|search|loading|failed|update|create|choose|select|open|close|back|show|hide|stock|price|material|materials|notes|empty|required|optional|archive|archived|restore|summary|ready|needs|cleanup|draft|unknown|filter|clear|remove|import|export|download|copy|more|less|retry|again|something|wrong|success|deleted|saved|updated|created)\b/i;

const spoken = (source) => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  return [
    ...[...code.matchAll(/>\s*([A-Za-z][^<>{}\n]*?)\s*</g)].map((m) => m[1]),
    ...[...code.matchAll(/\b(?:placeholder|title|aria-label|label|description|subtitle|helper|eyebrow|alt)=["']([^"']+)["']/g)].map((m) => m[1]),
    ...[...code.matchAll(/\btoast(?:\.\w+)?\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
  ];
};

// A module's words, in the shapes that reach a screen. `name:` is left out on purpose: in a module it is
// almost always an identifier the database matches on (a category is called "Queen of the ORIENT").
const QUOTED = String.raw`(['"\`])((?:(?!\1)[^\\\n]|\\.)*)\1`;
const FALLBACK = String.raw`(?:[\w.?]+\s*(?:\|\||\?\?)\s*)*`;
const MODULE_SHAPES = [
  String.raw`\b(?:label|title|message|helper|description|reason|actionLabel|summary)\s*:\s*` + FALLBACK,
  String.raw`new Error\(\s*` + FALLBACK,
  String.raw`errors\.push\(\s*`,
  String.raw`\btoast(?:\.\w+)?\(\s*` + FALLBACK,
].map((shape) => new RegExp(shape + QUOTED, 'g'));
const said = (source) => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  return MODULE_SHAPES.flatMap((shape) => [...code.matchAll(shape)].map((m) => m[2]));
};

const english = [];
let checked = 0;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const text of file.endsWith('.jsx') ? spoken(source) : said(source)) {
    checked += 1;
    // An interpolation is data, and a reference source keeps its own name.
    const words = text.replace(/\$\{[^}]*\}/g, ' ').replace(/The Good Scents Company|Perfumer's World|ScenTree|Queen of the ORIENT/gi, ' ');
    if (ENGLISH.test(words)) english.push(`${file.slice(src.length + 1)}  "${text}"`);
  }
}
assert.ok(checked >= 500, `only ${checked} spoken strings read — the extraction is broken, and this would pass anything`);
assert.deepEqual(english, [],
  'these phone lab screens speak English to Dekito again. Put them into Indonesian with the words the rest '
  + `of the lab uses (bahan baku, pengenceran, pelarut, HPP, stok, harga):\n  ${english.join('\n  ')}`);

// A status badge given no words of its own prints the status. It printed the STORED value, title-cased —
// "Draft", "Ready For Batch", "Converted To Product" — under filter chips that said "Draf" and "Siap batch",
// and no text check could see it because the words only exist once the page runs. So the badge must go
// through the labels, and a lab screen may only hand it a bare status the labels know.
const badge = readFileSync(join(src, 'components/mobile-ui/MobileStatusBadge.jsx'), 'utf8');
assert.match(badge, /children \|\| STATUS_LABELS\[/,
  'MobileStatusBadge prints the stored status again ("Ready For Batch") instead of its Indonesian label');
const { FORMULA_STATUSES, BATCH_STATUSES } = await import('./constants.js');
const labelled = new Set([...FORMULA_STATUSES, ...BATCH_STATUSES].map(({ value }) => value));
for (const file of jsx) {
  for (const [tag, status] of readFileSync(file, 'utf8').matchAll(/<MobileStatusBadge\b[^>]*?\bstatus="([^"]+)"[^>]*?\/>/g)) {
    assert.ok(labelled.has(status), `${file.slice(src.length + 1)}: ${tag} has no words and no label, so the phone shows "${status}" as it is stored`);
  }
}

// Translating an error must not cost the retry behind it. DashboardPage retries a loader whose error looks
// like a dropped connection, and it used to read that off the service's own English wrapper ("Failed to
// fetch raw material summary"). The wrapper is Indonesian now, so the network's words travel as `cause`.
const materialsService = readFileSync(join(src, 'services/rawMaterialsService.js'), 'utf8');
for (const wrapper of ['Gagal mengambil ringkasan bahan baku', 'Gagal mengambil ringkasan acuan bahan baku']) {
  assert.ok(materialsService.includes(`new Error('${wrapper}', { cause: error })`),
    `rawMaterialsService throws "${wrapper}" without the network error as its cause, so the dashboard stops retrying a dropped connection`);
}
assert.match(readFileSync(join(src, 'pages/DashboardPage.jsx'), 'utf8'), /isTransientNetworkError[\s\S]{0,240}error\?\.cause\?\.message/,
  'DashboardPage judges a dropped connection from the wrapper alone, and the wrapper no longer says "failed to fetch"');

console.log(`phoneLabSpeaksIndonesian selfcheck OK (${screens.size} screens, ${jsx.length} components + ${modules.length} modules, ${checked} spoken strings, none in English)`);
