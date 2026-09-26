// `node src/utils/editorRoundTripsEveryColumn.selfcheck.mjs`
//
// normalizeJournalPostPayload writes every column of a journal post on every save. Not a patch of the
// changed fields — the whole row, with each absent field resolved to null.
//
// So an editor whose state does not hold a column does not leave that column alone: it erases it. The
// phone editor's state had no related_product_slug, and nothing about that was visible. Open an article
// on a phone, fix a typo, save, and the link to the perfume the article is ABOUT was gone. The desktop
// editor holds the field and has a picker for it, so the same article edited on a laptop kept its link.
//
// The phone still has no picker, and that is a missing control rather than a defect — you cannot set the
// link there, but you no longer destroy it by touching anything else. Worth adding; not this fix.
//
// The rule: an editor round-trips every column its save writes. Both halves derived — the columns from
// the payload normaliser that writes them, the editors from the screens that call it — because a list of
// fields kept beside the editor is exactly what went out of step.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');

// --- 1. The save really does write every column, which is the whole premise -------------------------------
const service = readFileSync(join(src, 'services', 'journalPostsSupabaseService.js'), 'utf8');
const start = service.indexOf('const normalizeJournalPostPayload');
const body = service.slice(start, service.indexOf('});', start));
assert.ok(start !== -1 && body, 'the payload normaliser has moved; this guard no longer reads it');

const columns = [...body.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]);
assert.ok(columns.length >= 8,
  `expected the journal post columns, found ${columns.join(', ')} — the scan is broken, not the code`);
assert.ok(columns.includes('related_product_slug'),
  'the column this guard was written for is gone; check the scan before trusting the pass');
// If the save ever became a patch of changed fields only, an editor could safely omit a column and this
// guard would be enforcing something that no longer matters.
assert.doesNotMatch(body, /\.\.\.postData/,
  'the payload no longer names every column explicitly — if it now spreads whatever it was given, the '
  + 'erasure this guard prevents cannot happen and the rule should be rewritten rather than kept');

// --- 2. Every editor that saves through it holds every column ---------------------------------------------
const screens = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.jsx')) screens.push(full);
  }
};
walk(join(src, 'pages'));

const editors = screens.filter((file) => /updateJournalPost\(|createJournalPost\(/.test(readFileSync(file, 'utf8')));
assert.ok(editors.length >= 2,
  `expected both journal editors, found ${editors.length} — the scan is broken, not the code`);
assert.ok(editors.some((file) => file.includes(join('pages', 'mobile'))),
  'no phone editor found, and the phone was the one erasing a column');

// There are two honest ways to round-trip, and demanding only the first was wrong. The phone's article
// page publishes with `{ ...post, status: 'published' }` where `post` came straight from
// getJournalPostById — and toAppRecord spreads the whole database row, so every column is carried
// without the file ever naming one. The first version of this section reported that screen as erasing a
// column it preserves perfectly.
//
// So: a save either NAMES every column, or SPREADS the record it loaded.
for (const file of editors) {
  const where = file.slice(src.length + 1);
  const text = readFileSync(file, 'utf8');

  // Two honest ways to round-trip, and the distinction is which object gets spread.
  //
  // Spreading a row that came from the service carries every column without naming one, because
  // toAppRecord spreads the whole database row. Both phone screens that publish an article do this and
  // are correct; earlier versions of this section reported both as erasing a column they preserve.
  //
  // Spreading a HAND-BUILT editor state carries only what that state holds, which is the defect this
  // guard exists for. So the exemption is refused for exactly the variable built by createEmptyPost or
  // toEditorState.
  const payloads = [...text.matchAll(/(?:update|create)JournalPost\([^,]*,\s*\{([\s\S]{0,400}?)\}\s*\)/g)]
    .map((match) => match[1]);
  const handBuilt = new Set(
    [...text.matchAll(/(?:const|set)\s*\[?(\w+)[^\n]*?(?:createEmptyPost|toEditorState)\(/g)].map((m) => m[1]),
  );
  const spreadsALoadedRow = payloads.some((payload) => {
    const spread = payload.match(/\.\.\.(\w+)/);
    return spread && !handBuilt.has(spread[1]);
  });
  if (spreadsALoadedRow) continue;

  // Looked for in the STATE BUILDERS, not anywhere in the file. Checking the whole file passed a
  // sabotage that deleted the column from toEditorState, because the word still appeared in the save
  // payload twenty lines down — the "this file mentions the word" weakness this repo keeps rediscovering.
  //
  // Balanced braces rather than a regex: createEmptyPost has a block body with a `return {` inside it
  // and toEditorState is a bare `=> ({ … })`, and one regex written for either shape silently matched
  // neither — which made the tightened check pass three sabotages that should have failed.
  const builderBody = (name) => {
    const at = text.indexOf(`const ${name} = `);
    if (at === -1) return '';
    let index = text.indexOf('{', at);
    let depth = 0;
    const from = index;
    while (index < text.length) {
      if (text[index] === '{') depth += 1;
      else if (text[index] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
      index += 1;
    }
    return text.slice(from, index + 1);
  };
  // EACH builder, not the two concatenated. A new post and a loaded post are different objects and both
  // are saved; joining them let a column deleted from toEditorState hide behind the copy still sitting
  // in createEmptyPost, and three sabotages walked straight through.
  const builders = ['createEmptyPost', 'toEditorState']
    .map((name) => [name, builderBody(name)])
    .filter(([, body]) => body.trim());
  assert.ok(builders.length >= 1,
    `${where} has no editor-state builder this guard can read; it may have been renamed`);
  for (const [name, body] of builders) {
    const missing = columns.filter((column) => !body.includes(column));
    assert.deepEqual(missing, [],
      `${where} builds ${name}() without every column the save writes, and the save writes the whole `
      + `row — so each column it does not carry is written as null: ${missing.join(', ')}`);
  }
}

console.log(`editorRoundTripsEveryColumn selfcheck OK (${columns.length} columns written on save, `
  + `${editors.length} editors carrying all of them)`);
