// `node src/utils/studioAsksBeforeItBreaks.selfcheck.mjs`
//
// Studio audit from the owner's side, 15 Nov 2026 (read from the code: Studio is behind a login).
//  - Cancelling an order was one dropdown slip on four screens, and it releases stock and voucher at once.
//  - Bulk "WA follow-up" copied every selected buyer's message as one block and opened the FIRST buyer's
//    chat: pasting it sent the others' names, items and totals to that one person.
//  - "Reset" on the phone's bespoke settings wiped all five option lists, photos and prices, in one tap.
//  - Since /pay retired, export orders' messages printed "Pay here: " with nothing after it, and the
//    payment-reminder buttons sat disabled for every bank-transfer order.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

assert.match(read('utils', 'confirmAction.js'), /export const confirmStatusChange = async \(status\) => \(\s*status !== 'cancelled' \|\| confirmAction\(/);
for (const [file, handler] of [
  [['pages', 'OrderDetailPage.jsx'], 'const updateStatus = async (status) => {'],
  [['pages', 'mobile', 'MobileOrderDetailPage.jsx'], 'const handleStatusChange = async (status) => {'],
  [['pages', 'OrdersPage.jsx'], 'const updateStatusAndNotify = async (order, status) => {'],
  [['pages', 'mobile', 'MobileOrdersPage.jsx'], 'const changeOrderStatus = async (order, status) => {'],
]) {
  assert.ok(read(...file).includes(`${handler}\n    if (!await confirmStatusChange(status)) return;`), `${file.join('/')} cancels without asking`);
}

for (const file of [['pages', 'OrdersPage.jsx'], ['pages', 'mobile', 'MobileOrdersPage.jsx'], ['pages', 'ShipmentsPage.jsx']]) {
  const source = read(...file);
  assert.match(source, /openFollowUpsOneByOne\(messages\);/, `${file.join('/')} bulk WA is not one chat per buyer`);
  assert.doesNotMatch(source, /join\('\\n\\n---\\n\\n'\)/, `${file.join('/')} copies everyone's messages as one block again`);
}
const queue = read('utils', 'whatsAppFollowUps.js');
assert.doesNotMatch(queue, /navigator\.clipboard/, 'the follow-up queue puts nothing on the clipboard');
assert.match(queue, /action: \{ label: 'Buka berikutnya'/);

assert.match(read('pages', 'mobile', 'MobileBespokeSettingsPage.jsx'), /const handleReset = async \(\) => \{[\s\S]{0,400}confirmAction\(\{\s*title: 'Kembalikan semua opsi bespoke ke bawaan\?'/);

const templates = read('services', 'notificationTemplateService.js');
assert.match(templates, /unpaid\(order\) && getPaymentLinkUrl\(order\) \? `Link bayar:/);
assert.match(templates, /unpaid\(order\) && getPaymentLinkUrl\(order\) \? `Pay here:/);
assert.match(templates, /Status pembayaran: \$\{PAYMENT_STATUS_ID\[order\.paymentStatus\]/, 'buyers read the label, not "pending"');
assert.doesNotMatch(read('pages', 'OrderDetailPage.jsx'), /`Customer code: \$\{order\.customerCode\}`/, 'the reminder hands out a SOLI code again');

console.log('studioAsksBeforeItBreaks selfcheck OK (cancel asks, one chat per buyer, reset asks, no empty pay line)');
