// `node src/utils/noPromiseOfACheckoutAbroad.selfcheck.mjs`
//
// Twelfth visitor audit, 15 Nov 2026. Since #663 a buyer abroad orders on WhatsApp, and since #595 nobody is
// handed a SOLI code after ordering — but three pages still described the old way:
//  - the account page (both shops): "Kode ini diberikan setelah checkout pertama" — a code no one gets now;
//  - the English tracking page: "Your order number is on the payment page" — a page these buyers never see;
//  - the English payment page: "once your order is placed, how to pay appears here".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { id, en } = MESSAGES;

assert.doesNotMatch(id['cust.codeGivenKeep'], /diberikan setelah checkout/);
assert.doesNotMatch(en['cust.codeGivenKeep'], /after your first checkout/);
for (const lang of [id, en]) assert.match(lang['cust.codeGivenKeep'], /Google/, 'a new buyer is told what to do instead');

assert.doesNotMatch(en['track.whereNumber'], /payment page/);
assert.match(en['track.whereNumber'], /WhatsApp/);
assert.doesNotMatch(en['pay.noSessionBody'], /how to pay appears here/);
assert.match(en['pay.noSessionBody'], /WhatsApp/);
assert.match(en['cust.heroBody'], /WhatsApp/);

const tracking = readFileSync(join(root, 'pages', 'PublicTrackingPage.jsx'), 'utf8');
assert.match(tracking, /\{foundNothing \|\| isInternational \? <AskAtelierButton/, 'the English tracking page offers the chat before a failed lookup');
// The footer's email field sends the request on WhatsApp; it says so before the tap.
assert.match(readFileSync(join(root, 'components', 'storefront', 'StorefrontFooter.jsx'), 'utf8'), /t\('nav\.subscribeHow'\)/);
for (const lang of [id, en]) assert.match(lang['nav.subscribeHow'], /WhatsApp/);
console.log('noPromiseOfACheckoutAbroad selfcheck OK (no code nobody gets, no page nobody sees)');
