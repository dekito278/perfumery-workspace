// `node src/utils/studioLabSpeaksIndonesian.selfcheck.mjs` (named phoneLabSpeaksIndonesian until 2026-11-10)
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
//
// The DESKTOP lab pages joined on 2026-11-10 (Dekito: "ikut saran kamu"). Until then the phone and the
// desktop shared the engine but not the screens, so translating the engine left the desktop formula page
// reading Indonesian axis names inside English panels — 400 English candidates over 49 files. The routes
// are the same five areas with or without /mobile/, plus the desktop lab dashboard.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appImports, routeBlocks } from './buyerSurfaces.mjs';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(src, 'App.jsx'), 'utf8');
const imports = appImports(app);
const LAB = /^\/(?:mobile\/)?(?:dashboard|raw-material|formulas|batches|validation|production-costing|categories)/;

const screens = new Set();
for (const block of routeBlocks(app)) {
  const path = (block.match(/path="([^"]+)"/) || [])[1];
  if (!path || !LAB.test(path) || /element=\{\s*<Navigate/.test(block)) continue;
  for (const [, name] of block.matchAll(/<(\w+)[\s/>]/g)) {
    if (imports.has(name) && imports.get(name).startsWith('pages/')) screens.add(join(src, imports.get(name)));
  }
}
assert.ok(screens.size >= 24, `only ${screens.size} lab screens resolved from App.jsx — the parse is broken, not the router`);

const resolveImport = (from, spec) => {
  const base = spec.startsWith('@/') ? join(src, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  return ['', '.jsx', '.js', '/index.jsx', '/index.js'].map((ext) => base + ext)
    .find((file) => /\.jsx?$/.test(file) && existsSync(file)) || null;
};
// Where the walk stops. The bespoke template pulls in the order service, a finished batch pulls in the
// product catalogue, and from there the storefront's own copy (data/, i18n/) — none of it is the lab.
// contexts/AuthContext.jsx is app-wide (the buyer portal signs in through it too) and its few words sit
// behind Supabase's own English error.message, so the walk stops there as well.
const SHOP = /\/(?:data|i18n)\/|\/contexts\/AuthContext\.jsx$|\/services\/(?:order|customer|voucher|productCatalog|productImageStorage|journalPosts\w*)Service\.js$|\/utils\/(?:bespokeOrder|voucherValidation)\.js$|Exports?\.js$/;
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
assert.ok(jsx.length >= 100, `only ${jsx.length} components reached from the lab screens — the walk is not following imports`);
assert.ok(modules.length >= 80, `only ${modules.length} modules reached from the lab screens — the walk is not following .js imports`);
for (const engine of ['utils/formulaWorkbookSimulation.js', 'utils/paceScoreBands.js', 'utils/formulaCalculations.js',
  'utils/formulaPaceRecommendations.js', 'utils/validation.js', 'pages/FormulaDetailPage.jsx', 'pages/BatchProductionPage.jsx']) {
  assert.ok(files.has(join(src, engine)), `${engine} is no longer reached — the walk lost the PACE engine and would pass anything it says`);
}

// Words that only English uses. Loanwords this Studio keeps on purpose — batch, formula, QC, HPP, IFRA,
// supplier, workbook, Edit, Detail, Mode, Total, Status — are absent by design.
const ENGLISH = /\b(?:must|opening|heart|drydown|diffusion|tenacity|harmony|smoothness|bridge|strong|healthy|weak|guidance|ingredient|merge|review|bottle|labor|packaging|the|and|with|your|this|that|from|into|for|of|is|are|no|not|yet|save|saving|cancel|delete|add|new|search|loading|failed|update|create|choose|select|open|close|back|show|hide|stock|price|material|materials|notes|empty|required|optional|archive|archived|restore|summary|ready|needs|cleanup|draft|unknown|filter|clear|remove|import|export|download|copy|more|less|retry|again|something|wrong|success|deleted|saved|updated|created|production|overview|details|settings|history|quantity|amount|category|type|date|cost|solvent|dilution|raw|pending|active|inactive|view|list|page|showing|next|previous|items|rows|row|all|none|other|by|at|on|in|to|or|an|it|be|was|has|have|will|can|should|which|when|then|than|use|used|using|value|values|name|names|calculate|recalculated|current|factor|across|scale|note|untitled|loaded|title|action|actions|confirm|confirmed|apply|applied|submit|send|sent|done|error|errors|warning|warnings|yes|please|only|each|every|without|about|after|before|between|also|still|here|there|these|those|what|where|who|how|why|if|else|out|up|down|off|over|under|first|last|level|high|low|middle|linked|unlinked|matched|source|sources|reference|profile|profiles|weight|percentage|concentration|blend|family|families|impact|lifetime|odour|odor|scent|smell|sample|samples|run|start|stop|pause|play|step|steps|recommended|quote|bulk|selling|buying|purchase|supplier\s+name|usage|limit|limits|maximum|average)\b/i;

// The text either side of every {…}, nested ones included.
const unbrace = (text) => { let out = text; while (/\{[^{}]*\}/.test(out)) out = out.replace(/\{[^{}]*\}/g, ' '); return out.replace(/[{}]/g, ' '); };
const spoken = (source) => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  return [
    // `(?<!=)`: the > of an arrow function is not the end of a tag.
    ...[...code.matchAll(/(?<!=)>\s*([A-Za-z][^<>{}\n]*?)\s*</g)].map((m) => m[1]),
    // Text broken by an interpolation ("Scale {x} to a new target total"): the words around the braces.
    ...[...code.matchAll(/(?<!=)>\s*([A-Za-z][^<>\n]*\{[^<>\n]*?)\s*</g)].map((m) => unbrace(m[1])),
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

// Words a screen or module hands over without any of the shapes above, found in English after the desktop
// pages were translated (2026-11-10): a JSX ternary (`compact ? 'Clear filters' : 'Clear'`), a returned
// message (`return \`${fieldName} is required\``), a fallback (`name || 'Unknown material'`) and a default
// prop (`cancelText = 'Cancel'`). These positions also carry stored values and class lists, so a literal
// counts only when it reads as words: no class-list token (h-10, sm:inline), no code characters, and a
// single word only when capitalised — 'draft' is a value, 'Draft' is a label.
const Q = (n) => `(['"\`])((?:(?!\\${n})[^\\\\\\n]|\\\\.)*)\\${n}`;
const LOOSE_SHAPES = [
  new RegExp(String.raw`\?\s*` + Q(1) + String.raw`\s*:\s*` + Q(3), 'g'),
  new RegExp(String.raw`\breturn\s+` + Q(1), 'g'),
  new RegExp(String.raw`(?:\|\||\?\?)\s*` + Q(1), 'g'),
  new RegExp(String.raw`\b\w*(?:Text|Label|label|title|message|placeholder|fieldName|eyebrow|description|subtitle|helper)\s*=\s*` + Q(1), 'g'),
];
const readsAsWords = (raw) => {
  const text = raw.replace(/\$\{[^}]*\}/g, ' ').trim();
  return /[A-Za-z]/.test(text) && !/[=<>{}[\]\\|@]|\b[a-z0-9]+[-:/][a-z0-9[]/.test(text)
    && (/\s/.test(text) || /^[A-Z][a-z]/.test(text));
};
// Not screen copy, so left as they are: the reference profile's confidence_reason column; the notes
// template a bespoke order prefills into a formula, saved with it; and the costing scenario and quote names,
// which also title the English costing and quotation PDFs (productionCostingExports.js).
const STORED = new Set([
  'Multiple external sources disagree on one or more normalized fields and need review.',
  'Canonical profile resolved with source priority first, then confidence and method strength.',
  'Reference: ${orderItem.referenceProductName}',
  'Recommended retail',
  'Quote ${index + 1}',
]);
const loose = (source) => {
  const code = source.replace(/^.*\bconsole\.\w+\(.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  return LOOSE_SHAPES.flatMap((shape) => [...code.matchAll(shape)].flatMap((m) => [m[2], m[4]]))
    .filter((text) => text !== undefined && readsAsWords(text));
};

const english = [];
let checked = 0;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const text of [...(file.endsWith('.jsx') ? spoken(source) : said(source)), ...loose(source)]) {
    checked += 1;
    if (STORED.has(text)) continue;
    // An interpolation is data, a reference source keeps its own name, and "No." is Indonesian's own
    // abbreviation for nomor ("No. pesanan").
    const words = text.replace(/\$\{[^}]*\}/g, ' ').replace(/The Good Scents Company|Perfumer's World|ScenTree|Queen of the ORIENT|\bNo\.(?=\s|$)|https?:\/\/\S+/gi, ' ');
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

console.log(`studioLabSpeaksIndonesian selfcheck OK (${screens.size} screens, ${jsx.length} components + ${modules.length} modules, ${checked} spoken strings, none in English)`);
