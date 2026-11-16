// `node src/utils/returnsPolicyIsWritten.selfcheck.mjs`
//
// Dekito agreed the shop's returns and refund policy on 16 Nov 2026 (the fresh buyer audit found "Help &
// policies" had none). These are its numbers; changing one is a decision, so it has to change here too.
//   - damaged / wrong / short: report within 2×24 hours with an unboxing video -> resend or full refund
//   - change of mind: sealed bottle within 7 days, return shipping on the buyer; opened = no return
//   - cancel: free before paying; paid but not shipped = full refund
//   - bespoke: refundable until the brief is agreed, not once blending starts
//   - abroad: duties on the recipient; refused at customs = no shipping refund
//   - refund paid within 3 working days of approval
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';

const { id, en } = MESSAGES;
assert.match(id['help.problemAsk'], /2×24 jam/); assert.match(en['help.problemAsk'], /48 hours/);
for (const lang of [id, en]) assert.match(lang['help.problemAsk'], /video/);
assert.match(id['help.returnsChangeMind'], /segelnya masih utuh[\s\S]*7 hari[\s\S]*tidak bisa dikembalikan/);
assert.match(en['help.returnsChangeMind'], /seal intact[\s\S]*7 days[\s\S]*cannot be returned/);
assert.match(id['help.returnsBespoke'], /sampai brief kita sepakati[\s\S]*tidak bisa dibatalkan atau di-refund/);
assert.match(id['help.returnsRefund'], /3 hari kerja/); assert.match(en['help.returnsRefund'], /3 working days/);
assert.match(en['help.returnsAbroad'], /customs/);

const help = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'pages', 'HelpPage.jsx'), 'utf8');
assert.match(help, /<Section id="help-returns" title=\{t\('help\.returnsTitle'\)\}>/);
assert.match(help, /\{isInternational \? <p className="m-0">\{t\('help\.returnsAbroad'\)\}<\/p> : null\}/, 'the customs rule is for the shop that ships abroad');
console.log('returnsPolicyIsWritten selfcheck OK (2×24h damage claims, 7-day sealed returns, bespoke, customs, 3 working days)');
