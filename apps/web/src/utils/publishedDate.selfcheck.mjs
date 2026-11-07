// `node src/utils/publishedDate.selfcheck.mjs`
//
// The published date an editor shows and saves. Run in Jakarta's time zone, where the off-by-one lives:
// 2026-10-04T20:00:00Z is 5 October at 03:00 WIB, and the shop prints 5 October.
process.env.TZ = 'Asia/Jakarta';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fromDateInputValue, toDateInputValue } from './publishedDate.js';

const stamped = '2026-10-04T20:00:00.000Z';
assert.equal(toDateInputValue(stamped), '2026-10-05', 'the box shows the day the reader sees, not the UTC day');
assert.equal(fromDateInputValue('2026-10-05', stamped), stamped, 'an untouched day keeps the exact timestamp');
assert.equal(toDateInputValue(fromDateInputValue('2026-09-01', stamped)), '2026-09-01', 'a picked day stays that day');
assert.equal(fromDateInputValue('', stamped), stamped, 'an emptied box does not clear a published date');
assert.equal(fromDateInputValue('bukan tanggal', null), null);
assert.equal(toDateInputValue(null), '');

// The save writes every column, so an editor whose state lacks published_at would send null and the
// database would stamp NOW on every save — the article's date moving forward each time it is touched.
const src = dirname(fileURLToPath(import.meta.url)).replace(/\/utils$/, '');
const service = readFileSync(join(src, 'services', 'journalPostsSupabaseService.js'), 'utf8');
assert.match(service, /published_at: postData\.published_at \|\| null,/,
  'the save must carry the published date it was given, a draft included — unpublishing must not erase it');
for (const editor of [['pages', 'JournalEditorPage.jsx'], ['pages', 'mobile', 'MobileJournalEditorPage.jsx']]) {
  const source = readFileSync(join(src, ...editor), 'utf8');
  assert.match(source, /published_at: post\.published_at \|\| null/, `${editor.join('/')} loads the article without its date`);
  assert.match(source, /fromDateInputValue\(event\.target\.value, formState\.published_at\)/,
    `${editor.join('/')} has no way to correct the published date`);
}

console.log('publishedDate selfcheck OK (the day shown is the day the reader sees, and saving never moves it)');
