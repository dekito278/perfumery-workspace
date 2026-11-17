// `node src/utils/oneCheckoutShape.selfcheck.mjs`
//
// The bespoke checkout asked in a different order and with different controls from the main one (fresh
// buyer audit, 15 Nov 2026): area before courier, payment as a closed dropdown, no Google sign-in. A buyer
// of both learned two forms. Since 17 Nov 2026 they share one shape.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const bespoke = readFileSync(join(src, 'pages', 'BespokePage.jsx'), 'utf8');

assert.ok(bespoke.indexOf('id="bespoke-courier"') < bespoke.indexOf('id="bespoke-area"'), 'the courier is asked before the area, as in the main checkout');
assert.doesNotMatch(bespoke, /<select className="ng-field" value=\{form\.paymentMethod\}/, 'payment is a closed dropdown again');
assert.match(bespoke, /role="radiogroup" aria-label=\{t\('bsp\.payment'\)\}/);
assert.match(bespoke, /aria-checked=\{form\.paymentMethod === method\.id\}/);
assert.match(bespoke, /<div id="bespoke-rates" className="flex flex-col gap-2" role="radiogroup"/);
assert.match(bespoke, /onClick=\{handleGoogleLogin\}[\s\S]{0,300}t\('checkout\.signInPlain'\)/, 'bespoke offers Google sign-in like the main checkout');
// The resume effect reads currentUser, so it must come after the line that declares it (a TDZ crash took
// the whole page down in testing).
assert.ok(bespoke.indexOf('const { currentUser, loginWithGoogle } = useAuth();') < bespoke.indexOf('getItem(RESUME_KEY)'),
  'the return-from-Google effect reads currentUser before it exists');
console.log('oneCheckoutShape selfcheck OK (courier then area, payment cards, Google sign-in on bespoke too)');
