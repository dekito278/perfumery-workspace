// `node src/utils/tierPricingAuthority.selfcheck.mjs`
//
// A customer code is printed on every invoice. If the order endpoint resolved a buyer's tier from the
// code in the payload, anyone who has ever seen a reseller's invoice could buy at reseller prices. The
// tier has to come from the buyer's own access token and nothing else, and the absence of a token has to
// mean retail rather than an error or a guess.
//
// The endpoint cannot be imported here — it pulls in Supabase and runs on request — so this holds its
// source to the shape, the way the migration guard does.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const endpoint = readFileSync(join(webRoot, 'api', 'orders', 'create.js'), 'utf8');
const orderService = readFileSync(join(webRoot, 'src', 'services', 'orderService.js'), 'utf8');

const resolver = endpoint.slice(endpoint.indexOf('const resolveBuyer'), endpoint.indexOf('// --- authoritative price recompute'));
assert.ok(resolver, 'the endpoint no longer resolves a buyer tier');

// Identity comes from the token, and only the token.
assert.match(resolver, /req\.headers\?\.authorization/, 'the tier must be read from the Authorization header');
// The anonymous answer is a named constant now, because the resolver returns an identity as well as a
// tier and both halves have to be safe: retail prices, and NO account — which a per-account voucher
// refuses rather than waves through. Assert the invariant, not the spelling.
assert.match(endpoint, /const ANONYMOUS_BUYER = \{ tier: 'retail', authUserId: null \}/,
  'the anonymous buyer must be retail with no account');
assert.match(resolver, /if \(!token\) return ANONYMOUS_BUYER;/, 'no token is anonymous, not an error and not a guess');
assert.match(resolver, /auth\/v1\/user/, 'the token has to be verified with Supabase, not merely decoded');
assert.doesNotMatch(resolver, /customer_code|customerCode|input\./,
  'the tier must never be resolved from the customer code — it is printed on every invoice');

// Every failure path lands on retail. A thrown error must not become a free reseller discount, nor a
// crash that blocks an honest order.
assert.equal((resolver.match(/return ANONYMOUS_BUYER;/g) || []).length, 5,
  'all five ways this can fail land on retail: no token, no env, the check rejecting the token, a '
  + 'response with no user id, and anything thrown');
assert.match(resolver, /rows\?\.\[0\]\?\.tier === 'reseller' \? 'reseller' : 'member'/,
  'only a row an admin wrote makes a reseller; being signed in at all makes a member');

// The resolved tier is what prices the order.
assert.match(endpoint, /const buyer = await resolveBuyer\(req\);\s*\n\s*const buyerTier = buyer\.tier;/,
  'the recompute must be fed the tier this endpoint resolved itself');
assert.match(endpoint, /priceCatalogItems\(input\.items \|\| \[\], buyerTier\)/,
  'the recompute must be given the resolved tier, or it silently prices everything at retail');

// One rule for which price applies, shared with the storefront.
assert.match(endpoint, /from '\.\.\/\.\.\/src\/utils\/tierPrice\.js'/,
  'the endpoint must use the shared price rule rather than reimplementing it — that is how the '
  + 'availability and og:image bugs happened');
assert.match(endpoint, /overseas: false/,
  'overseas sales are quoted by hand and entered in Studio; this endpoint must not price them');

// A missing migration must not break ordering.
assert.match(endpoint, /const sbSelectOptional/, 'the tier price read must tolerate the table not existing yet');
assert.match(endpoint, /storefront_product_prices\?product_id=eq/, 'tier prices are read per product');

// The browser attaches the token at the one place every order goes through.
assert.match(orderService, /Authorization: `Bearer \$\{accessToken\}`/,
  'postAuthoritativeOrder must attach the session token');
assert.match(orderService, /supabase\.auth\.getSession\(\)/);

console.log('tierPricingAuthority selfcheck OK (the token decides the tier; every other path is retail)');
