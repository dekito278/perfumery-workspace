// `node src/utils/telegramBotIsLocked.selfcheck.mjs`
//
// The Telegram bot can write to the shop. These are the locks on it.
//
// Dekito was told what a writing bot costs — the endpoints hold SUPABASE_SERVICE_ROLE_KEY and bypass
// every RLS rule, while Studio protects the same writes behind a login AND the TOTP factor he set up
// on 6 September — and he chose it. So the decision is his and this file does not relitigate it. What
// it does is make sure the locks that made it acceptable cannot quietly come off.
//
// Every assertion here has a specific way of being wrong behind it. They are not style rules.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowedChatIdFrom, authorise, confirmationToken, isWritingCommand, parseCommand } from './telegramCommands.js';

const here = dirname(fileURLToPath(import.meta.url));
const endpoint = readFileSync(join(here, '..', '..', 'api', 'telegram', 'webhook.js'), 'utf8');

// --- 1. Fail closed. Missing configuration is never "no check" ---------------------------------------
// The way this goes wrong is dull and fatal: the endpoint deploys, the env var is set an hour later,
// and for that hour anyone who guesses the URL owns the shop.
assert.equal(authorise({ chatId: '1', allowedChatId: '1' }).ok, false,
  'with no secret configured the gate opens — the endpoint is public from the moment it deploys');
assert.equal(authorise({ secretHeader: 's', expectedSecret: 's', chatId: '1' }).ok, false,
  'with no allowlist configured any chat commands the shop');
assert.equal(authorise({ secretHeader: '', expectedSecret: '', chatId: '', allowedChatId: '' }).ok, false,
  'everything empty must refuse, not match');

// --- 2. Both halves of the lock, independently ---------------------------------------------------------
const good = { secretHeader: 'rahasia', expectedSecret: 'rahasia', chatId: '42', allowedChatId: '42' };
assert.equal(authorise(good).ok, true, 'the owner cannot get in at all');
assert.equal(authorise({ ...good, secretHeader: 'salah' }).ok, false,
  'a caller without Telegram\'s secret header gets through — anyone who learns the URL can post to it');
assert.equal(authorise({ ...good, chatId: '43' }).ok, false,
  'a different chat commands the shop. The secret proves it came from Telegram, NOT that it came from '
  + 'Dekito — both halves are needed, and this is the half that stops anyone else who finds the bot');

// --- 3. The allowlist cannot be widened by malformed config --------------------------------------------
// ORDER_ALERT_EXTRA is hand-edited JSON. A typo must disable the bot, never open it.
assert.equal(allowedChatIdFrom('{"chat_id":"42"}'), '42');
assert.equal(allowedChatIdFrom('{"chat_id":42}'), '42', 'a number is as valid as a string here');
assert.equal(allowedChatIdFrom('bukan json'), '', 'unparseable config must yield no allowlist, not a wildcard');
assert.equal(allowedChatIdFrom('{}'), '', 'a missing chat_id must yield no allowlist');
assert.equal(allowedChatIdFrom('{"chat_id":"*"}'), '', 'a wildcard is not a chat id');
assert.equal(allowedChatIdFrom('{"chat_id":" 42 "}'), '42');

// --- 4. Writing commands are confirmed, and the token is tied to WHAT is being done --------------------
// A token that did not depend on the arguments would let a confirmation for "/stok x 1" execute
// "/stok x 1000" — the sender would have confirmed a different sentence from the one that ran.
for (const command of ['stok', 'produk', 'artikel']) {
  assert.ok(isWritingCommand(command), `${command} writes but is not treated as a writing command`);
}
assert.ok(!isWritingCommand('order'), 'a read command must not demand confirmation');
assert.notEqual(confirmationToken('stok', ['x', '1']), confirmationToken('stok', ['x', '1000']),
  'the token does not depend on the arguments, so a confirmation can be replayed against a different number');
assert.notEqual(confirmationToken('stok', ['x', '1']), confirmationToken('produk', ['x', '1']),
  'the token does not depend on the command');
assert.equal(confirmationToken('stok', ['x', '1']), confirmationToken('stok', ['X', '1']),
  'case alone must not change the token, or echoing it back becomes a guessing game');

// --- 5. The endpoint actually uses all of it -----------------------------------------------------------
assert.match(endpoint, /x-telegram-bot-api-secret-token/,
  'the endpoint never reads Telegram\'s secret header');
assert.match(endpoint, /TELEGRAM_WEBHOOK_SECRET/, 'the expected secret is never read from the environment');
assert.match(endpoint, /allowedChatIdFrom\(process\.env\.ORDER_ALERT_EXTRA\)/,
  'the allowlist no longer comes from the alert config, so it may not be the owner\'s chat at all');
assert.match(endpoint, /if \(!gate\.ok\) return ok\(res\)/,
  'the gate result is computed but not obeyed');

// --- 6. Stock still moves only through the RPC ----------------------------------------------------------
// The whole reason a set-stock RPC exists. A bot that assigned the column directly would be audit round
// 7 again: a number decided before an order deducted stock, written after it.
assert.match(endpoint, /rpc\/storefront_set_stock/, 'the bot no longer changes stock through the RPC');
// The VALUE, not the key. The first version of this rule matched the parameter name, so replacing the
// row version with null — which switches the RPC's whole guard off, since it treats null as "do not
// check" — still passed. A sabotage run caught it going green on exactly the change it exists to stop.
assert.match(endpoint, /p_expected_updated_at:\s*target\.updated_at/,
  'the bot calls the RPC without the row version it READ. The RPC treats a null expectation as "write '
  + 'anyway", so a stock change landing mid-order would silently overwrite the deduction instead of '
  + 'being refused');
assert.ok(!/storefront_products\?[^']*\bstock=/.test(endpoint),
  'the endpoint writes the stock column directly somewhere');

// --- 7. New things are drafts -------------------------------------------------------------------------
// A product conjured from one chat word has no price and no variants; if it were visible it would be
// orderable at whatever the empty columns default to.
assert.match(endpoint, /catalog_visible: false/,
  'a product created from a chat message is immediately visible to buyers, with no price set');
assert.match(endpoint, /status: 'draft'/, 'an article created from a chat message publishes itself');

// --- 8. Telegram is always answered 200 ----------------------------------------------------------------
// A non-200 makes Telegram retry the same update for hours. One rejected message would become a flood,
// and a refusal must be reported to the sender rather than to the transport.
assert.ok(!/statusCode = (4|5)\d\d/.test(endpoint), 'the endpoint answers Telegram with an error status');

// --- 9. The grammar survives Telegram's own quirks -------------------------------------------------------
assert.deepEqual(parseCommand('/stok aquilaria 12'), { command: 'stok', args: ['aquilaria', '12'], body: '' });
assert.equal(parseCommand('/stok@solivagant_bot x').command, 'stok',
  'Telegram appends @botname in groups; without stripping it every command misses');
assert.equal(parseCommand('bukan perintah').command, '', 'ordinary chat must not be read as a command');
assert.equal(parseCommand('/artikel Judul\n\nIsi panjang').body, 'Isi panjang',
  'the article body is the lines after the first');

console.log('telegramBotIsLocked selfcheck OK (fails closed, both halves of the gate, confirmations bound to their arguments, stock only by RPC, new things are drafts)');
