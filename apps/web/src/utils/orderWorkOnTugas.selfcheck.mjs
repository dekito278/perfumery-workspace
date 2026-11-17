// `node src/utils/orderWorkOnTugas.selfcheck.mjs`
//
// On the phone Studio the order status picker sat at the bottom of Riwayat and the internal notes under
// Racik (Studio audit, 15 Nov 2026), two taps and a scroll from Tugas, the tab every order opens on.
// Since 17 Nov 2026 both live on Tugas, once each.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(src, 'pages', 'mobile', 'MobileOrderDetailPage.jsx'), 'utf8');

const tugas = page.slice(page.indexOf("{orderSection === 'task' ? <>"), page.indexOf("{orderSection === 'payment' ? <>"));
assert.ok(tugas.length > 100, 'the Tugas block was not found');
assert.match(tugas, /<select id="mobile-order-status" value=\{order\.status\} onChange=\{\(event\) => handleStatusChange/, 'the status picker is on Tugas');
assert.match(tugas, /<textarea\s+id="mobile-internal-notes"\s+value=\{internalNotesDraft\}/, 'the internal notes are on Tugas');
assert.match(tugas, /onClick=\{saveInternalNotes\}/);
assert.equal(page.match(/handleStatusChange\(event\.target\.value\)/g).length, 1, 'the status picker appears once');
assert.equal(page.match(/value=\{internalNotesDraft\}/g).length, 1, 'the notes field appears once');
console.log('orderWorkOnTugas selfcheck OK (status and internal notes on the Tugas tab)');
