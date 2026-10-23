// `node src/utils/aSavedArticleIsNotDirty.selfcheck.mjs`
//
// After a successful save, the journal editor must stop claiming the article is unsaved.
//
// `isDirty` compares the live form against `savedSnapshot`. Loading an article sets that snapshot;
// saving one did not. So a saved article stayed "dirty" forever: leaving the page raised the browser's
// "Leave site?" dialog, and "Kembali ke Journal" asked whether to discard changes that were already in
// the database. Writing five articles in a row, it fired after every single save.
//
// That is worse than noise. A warning that is wrong every time trains the person to click through it,
// and the one time it is right — a real unsaved draft — it gets clicked through too.
//
// The subject is read from the component, not pasted here, so renaming the state or restructuring the
// handler fails this rather than silently escaping it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const editor = join(here, '..', 'pages', 'JournalEditorPage.jsx');
const source = readFileSync(editor, 'utf8');

// --- 1. The mechanism still exists and still works the way this guard assumes -----------------------
const dirtyLine = source.split('\n').find((line) => line.includes('const isDirty'));
assert.ok(dirtyLine, 'the editor no longer has an isDirty flag — this guard is checking a thing that is gone');
assert.ok(dirtyLine.includes('savedSnapshot'),
  `isDirty is computed from something other than savedSnapshot now: ${dirtyLine.trim()}`);
assert.match(source, /addEventListener\('beforeunload'/,
  'nothing warns on leaving any more, so there is no false warning to prevent and this guard is stale');

/** The body of the brace-delimited block that starts at `from`, balanced rather than regexed. */
const blockFrom = (text, from) => {
  const open = text.indexOf('{', from);
  assert.notEqual(open, -1, 'no block found where one was expected');
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error('unbalanced braces while reading the block');
};

// --- 2. The success path clears the flag -----------------------------------------------------------
// Counted, not listed: whichever call actually persists the article is the one found here, so a handler
// renamed from createJournalPost to something else still has to satisfy this.
const persists = [...source.matchAll(/await\s+(create|update)JournalPost\s*\(/g)];
assert.ok(persists.length >= 1, 'nothing in the editor saves an article any more');

const tryStart = source.lastIndexOf('try', persists[0].index);
assert.notEqual(tryStart, -1, 'the save is not inside a try block, so success and failure cannot be told apart');
const tryBody = blockFrom(source, tryStart);
assert.match(tryBody, /setSavedSnapshot\s*\(/,
  'a successful save does not update savedSnapshot, so the editor goes on believing the article is '
  + 'unsaved: every later navigation asks to discard changes that are already in the database');

// It must be the CURRENT form that becomes the new baseline. Snapshotting anything else leaves the
// comparison mismatched and the warning fires exactly as before.
assert.match(tryBody, /setSavedSnapshot\s*\(\s*JSON\.stringify\s*\(\s*formState\s*\)\s*\)/,
  'the new baseline must be the form as just saved — snapshotting anything else leaves isDirty true');

// --- 3. And the failure path does NOT ---------------------------------------------------------------
// A failed save must keep the warning, or the one case where the person genuinely has unsaved work —
// the save that did not land — is the case that silently stops warning them.
const catchStart = source.indexOf('catch', tryStart + tryBody.length);
assert.notEqual(catchStart, -1, 'the save has no catch block');
const catchBody = blockFrom(source, catchStart);
assert.ok(!/setSavedSnapshot\s*\(/.test(catchBody),
  'a FAILED save clears the unsaved-changes flag. That is the one moment the warning matters: the '
  + 'article is not in the database and the person is about to walk away from it');

console.log('aSavedArticleIsNotDirty selfcheck OK (save clears the flag, failure keeps it)');
