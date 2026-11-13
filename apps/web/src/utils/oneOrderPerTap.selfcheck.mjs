// `node src/utils/oneOrderPerTap.selfcheck.mjs`
//
// Ninth visitor audit, 13 Nov 2026: three quick taps on "Buat Pesanan" sent three order requests within
// 2 ms. Every form guarded itself with `if (saving) return` — but `saving` is React state, and state is
// the value from the LAST render: every tap that lands before the re-render reads false and goes through.
// The disabled button has the same gap. Only the server's stock and voucher checks stood between a quick
// double tap and two pending orders for one buyer.
//
// The rule, on every form a buyer places an order with: a ref is set synchronously before the request
// starts, checked first, and cleared only when the request has finished (or failed, so a retry works).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

const forms = [
  ['hooks/useCheckoutFlow.js', 'submitOrder'],
  ['pages/BespokePage.jsx', 'submitRequest'],
  ['components/storefront/InternationalOrderForm.jsx', 'submit'],
];

for (const [file, fn] of forms) {
  const source = read(...file.split('/'));
  assert.match(source, /const submittingRef = useRef\(false\);/, `${file}: no synchronous in-flight ref`);
  const start = source.indexOf(`const ${fn} = async (`);
  assert.ok(start > -1, `${file}: ${fn} not found`);
  const body = source.slice(start, source.indexOf('\n  };\n', start));
  const check = body.search(/if \((?:saving \|\| )?submittingRef\.current\) return;/);
  const set = body.indexOf('submittingRef.current = true;');
  const request = body.indexOf('setSaving(true);');
  assert.ok(check > -1, `${file}: ${fn} does not check the ref before anything else happens`);
  assert.ok(set > check && set < request, `${file}: the ref must be set before the request starts, in the same tick`);
  // Nothing awaited between the check and the set: an await there reopens the window.
  assert.ok(!/\bawait\b/.test(body.slice(check, set)), `${file}: an await between the check and the set lets a second tap in`);
  assert.match(body, /submittingRef\.current = false;/, `${file}: the ref is never released — a failed order could not be retried`);
}

console.log(`oneOrderPerTap selfcheck OK (${forms.length} order forms send one request per order, however fast the taps)`);
