// `node src/utils/routeSplitting.selfcheck.mjs`
//
// Every route in App.jsx goes through lazyRoute() except a short list of storefront pages a first-time
// visitor actually lands on. A page imported statically instead lands in the entry chunk, so every
// customer downloads it — and it also skips the stale-chunk recovery lazyRoute wraps around each import,
// which is what keeps a deploy mid-session from stranding someone on a missing chunk.
//
// This exists because the wardrobe tagging pages were added with plain imports and shipped that way:
// two studio-only pages riding along in every shopper's bundle. Nothing else noticed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(here, '..', 'App.jsx'), 'utf8');

// Storefront pages a visitor can land on cold. Everything else must be lazy. Adding a name here is a
// deliberate decision to put that page in every customer's first download.
const EAGER_ALLOWED = new Set([
  'HomePage',
  'CatalogPage',
  'PublicProductDetailPage',
  'BespokePage',
  'CartPage',
  'CheckoutPage',
  'PublicTrackingPage',
  'PublicJournalPage',
  'NotFoundPage',
]);

const eager = [...app.matchAll(/^import (\w*Page) from '@\/pages\/[^']+';$/gm)].map((m) => m[1]);
assert.ok(eager.length, 'no static page imports found at all — has App.jsx changed shape?');

const unexpected = eager.filter((name) => !EAGER_ALLOWED.has(name));
assert.deepEqual(
  unexpected,
  [],
  `these pages are imported statically, so they ship inside the entry chunk to every visitor and skip `
  + `lazyRoute's stale-chunk recovery:\n  ${unexpected.join('\n  ')}\n`
  + "Wrap them as `const X = lazyRoute(() => import('@/pages/X.jsx'));`, or add the name to EAGER_ALLOWED "
  + 'if a cold visitor really does land on that page.',
);

// The reverse drift: an allowlisted page quietly made lazy is fine, but an allowlist entry for a page that
// no longer exists hides the next offender behind a stale name.
const stale = [...EAGER_ALLOWED].filter((name) => !app.includes(`${name} `) && !app.includes(`<${name}`));
assert.deepEqual(stale, [], `EAGER_ALLOWED names pages App.jsx no longer uses:\n  ${stale.join('\n  ')}`);

const lazyCount = [...app.matchAll(/lazyRoute\(\(\) => import\(/g)].length;
assert.ok(lazyCount > 50, `only ${lazyCount} lazy routes found — expected the studio to stay code-split`);

console.log(`routeSplitting selfcheck OK (${eager.length} eager storefront pages, ${lazyCount} lazy routes)`);
