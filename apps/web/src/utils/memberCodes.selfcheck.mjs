// `node src/utils/memberCodes.selfcheck.mjs`
//
// Member codes (Dekito, 10 Nov 2026). Signing in no longer makes an account a member. A member code does
// (one per community, each with its own percentage, set in Studio), and so does a paid order here.
// Accounts that existed before the switch stay members, and resellers are unchanged.
//
// Money, so the arithmetic is RUN, not read. Then the rule is checked where it lives (one SQL function,
// read by both the storefront and the order endpoint), the wiring on both sides, and the copy. Copy matters
// because a page that still says "masuk dengan Google untuk harga member" now promises something the
// checkout will not charge.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveTierPrice } from './tierPrice.js';
import { applyTierPrices } from './tierPricedCatalog.js';
import { MAX_MEMBER_CODE_PERCENT, memberCodeProblem, normalizeMemberCode } from './memberCode.js';
import { MESSAGES } from '../i18n/messages.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(src, '..', '..', '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');
const migration = readFileSync(join(repo, 'supabase', 'migrations', '20261110120000_member_codes.sql'), 'utf8');

// --- 1. The price, run --------------------------------------------------------------------------------
const line = (tierPrices, extra = {}) => resolveTierPrice({ retailPrice: 479000, tierPrices, tier: 'member', ...extra });
assert.equal(line({ member: 429000 }, { memberPercent: 15 }), 407000,
  'a 15% code beats the product member price: 479.000 − 15% = 407.150, rounded DOWN to 407.000');
assert.equal(line({ member: 429000 }, { memberPercent: 5 }), 455000,
  'a code pays EXACTLY its percentage, even above the product member price (Dekito, 12 Nov 2026: per community, chosen by Dekito)');
assert.equal(line({ member: 429000 }, { memberPercent: 10 }), 431000,
  'a 10% community pays 479.000 − 10% = 431.000, not the product member price');
assert.equal(line({}, { memberPercent: 10 }), 431000, 'a code works on a product with no member price at all');
assert.equal(line({ member: 429000 }), 429000, 'a member without a code pays the product member price, as before');
assert.equal(line({ member: 429000 }, { memberPercent: null }), 429000);
assert.equal(line({ member: 429000 }, { tier: 'retail', memberPercent: 15 }), 479000,
  'a code percentage on a RETAIL buyer means nothing — the tier is the server\'s answer, not the percentage');
assert.equal(line({ reseller: 380000, member: 429000 }, { tier: 'reseller', memberPercent: 15 }), 380000,
  'a reseller keeps their own price; codes do not stack on it');
assert.equal(line({ overseas: 1260000, member: 429000 }, { overseas: true, memberPercent: 15 }), 1260000,
  'abroad the price is the export price, whatever code the buyer holds');
assert.equal(resolveTierPrice({ retailPrice: 359000, tierPrices: { retail: 479000 }, tier: 'member', memberPercent: 10 }), 431000,
  'the percentage comes off the retail price IN FORCE — the scheduled one once it has arrived, not the old variant price');
assert.equal(line({ member: 429000 }, { memberPercent: 95 }), 429000,
  'a percentage outside what memberPriceFromRetail accepts is ignored, never turned into a near-free bottle');

// The storefront rewrite applies a code even where no tier row exists, and leaves retail visitors alone.
const catalog = [{ slug: 'la-rose', priceNumber: 569000, variants: [{ id: '30-ml', priceNumber: 569000 }] }];
const asMember = applyTierPrices(catalog, 'member', {}, String, 10);
assert.equal(asMember[0].variants[0].priceNumber, 512000, 'a code member sees retail − 10% with no tier rows at all');
assert.equal(asMember[0].priceNumber, 512000, 'and the card follows its first variant');
assert.equal(applyTierPrices(catalog, 'retail', {}, String, 10), catalog,
  'a retail visitor with nothing to apply gets the very same array back');

// --- 2. The code's shape, said in Studio before the database refuses it --------------------------------
const sqlCodeShape = migration.match(/code ~ '([^']+)'/)?.[1];
assert.ok(sqlCodeShape, 'the migration must constrain the code shape');
const memberCodeSource = read('utils', 'memberCode.js');
assert.ok(memberCodeSource.includes(`/${sqlCodeShape}/`), 'Studio must check the code with the same pattern the table enforces');
const sqlMax = Number(migration.match(/discount_percent > 0 and discount_percent <= (\d+)/)?.[1]);
assert.equal(sqlMax, MAX_MEMBER_CODE_PERCENT, 'Studio and the table must agree on the largest percentage');
assert.equal(normalizeMemberCode(' jfc 2026 '), 'JFC2026', 'codes are stored upper-case and without spaces');
assert.equal(memberCodeProblem({ name: 'Jakarta Fragrance Club', code: 'jfc2026', percent: 10 }), '');
assert.match(memberCodeProblem({ name: '', code: 'JFC2026', percent: 10 }), /Nama/);
assert.match(memberCodeProblem({ name: 'JFC', code: 'J', percent: 10 }), /Kode/);
assert.match(memberCodeProblem({ name: 'JFC', code: 'JFC2026', percent: 0 }), /lebih dari 0/);
assert.match(memberCodeProblem({ name: 'JFC', code: 'JFC2026', percent: 51 }), /paling besar/,
  '51 is far more likely to be a mistyped 15 than a decision');

// --- 3. The rule, where it lives ------------------------------------------------------------------------
const fnBody = (name) => {
  const at = migration.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(at, -1, `the migration must define ${name}`);
  return migration.slice(at, migration.indexOf('$$;', at));
};
const status = fnBody('storefront_member_status');
for (const [needle, why] of [
  ["when p_auth_user_id is null then 'retail'", 'no account is retail'],
  ["customer.tier = 'reseller') then 'reseller'", 'a reseller is still decided by the row an admin wrote'],
  ['from account', 'a redeemed code (or a legacy account) makes a member'],
  ["o.payment_status = 'paid'", 'a PAID order here makes a member — an unpaid one does not'],
  ["else 'retail'", 'and everyone else who signs in is retail'],
]) assert.ok(status.includes(needle), `storefront_member_status: ${why}`);
assert.match(migration, /revoke all on function public\.storefront_member_status\(uuid\) from public, anon, authenticated;/,
  'anyone\'s status is not for anyone to ask — only the order endpoint passes an id');
assert.match(migration, /grant execute on function public\.storefront_member_status\(uuid\) to service_role;/);
assert.match(fnBody('storefront_my_price_tier'), /from public\.storefront_member_status\(auth\.uid\(\)\)/,
  'the function storefront_prices_for_me calls must delegate to the one rule');
const redeem = fnBody('storefront_redeem_member_code');
assert.doesNotMatch(redeem, /\braise\b/i,
  'the redeem function must answer with a word, not raise — a raise rolls back the logged wrong guess and the rate limit never counts');
assert.ok(redeem.indexOf('insert into public.storefront_member_code_attempts') < redeem.indexOf("'unknown'::text"),
  'a wrong code is logged before it is answered');
assert.match(redeem, /recent_failures >= 10/, 'ten wrong tries an hour per account');
assert.match(redeem, /k\.active/, 'a switched-off code cannot be redeemed');
assert.match(migration, /revoke all on function public\.storefront_redeem_member_code\(text\) from public, anon;/,
  'only a signed-in account can redeem');
assert.match(migration, /insert into public\.storefront_member_accounts \(auth_user_id, source\)\s*select u\.id, 'legacy' from auth\.users u\s*on conflict \(auth_user_id\) do nothing;/,
  'every account that already exists keeps the member price it has today');
assert.match(migration, /create policy "storefront member codes admin all" on public\.storefront_member_codes\s*for all using \(public\.is_admin\(\)\)/,
  'the codes are admin-only to read — a list a buyer could fetch is a list of discounts to try');
assert.doesNotMatch(migration, /storefront_member_codes[\s\S]{0,80}to anon/, 'and nothing grants them to anon');

// --- 4. Both readers ask it ------------------------------------------------------------------------------
const service = read('services', 'tierPricingService.js');
assert.match(service, /rpc\('storefront_my_member_status'\)/, 'the storefront asks the member rule for its own session');
assert.match(service, /rpc\('storefront_my_price_tier'\)/, 'and falls back to the old function until the migration runs');
const hook = read('hooks', 'useStorefrontProducts.js');
assert.match(hook, /applyTierPrices\(products, tier, index, formatRupiah, memberPercent\)/,
  'the catalogue a buyer sees must be priced with their code percentage');
assert.match(hook, /export const refreshTierPrices/, 'a redeemed code has to be able to reload prices in the same session');
const panel = read('components', 'storefront', 'MemberCodePanel.jsx');
assert.match(panel, /result === 'ok'\) \{\s*\/\/[^\n]*\n\s*await refreshTierPrices\(\);/,
  'after a code is accepted the prices on screen must follow, or the cart shows retail to a new member');
assert.match(panel, /if \(isInternational \|\| !codesReady/, 'the field stays away abroad and before the migration');
assert.doesNotMatch(panel, /<form\b/, 'the panel sits inside the checkout form: a nested form would make "Pakai" submit the order');
assert.match(panel, /event\.key !== 'Enter'[\s\S]{0,80}event\.preventDefault\(\);/, 'and Enter in the field must not submit the order form either');
const endpoint = readFileSync(join(src, '..', 'api', 'orders', 'create.js'), 'utf8');
assert.match(endpoint, /sbRpc\('storefront_member_status', \{ p_auth_user_id: verified \}\)/,
  'the order endpoint charges by the same rule, for the identity it verified');

// --- 5. Studio: one editor, both layouts, both menus ------------------------------------------------------
const app = read('App.jsx');
assert.match(app, /<Route path="\/studio\/member-codes"[\s\S]{0,120}<MemberCodesPage \/>/, 'the desktop page is routed');
assert.match(app, /<Route path="\/mobile\/studio\/member-codes"[\s\S]{0,120}<MobileMemberCodesPage \/>/, 'and the phone page');
assert.match(read('utils', 'deviceRouting.js'), /\/studio\\\/member-codes\$\/, '\/mobile\/studio\/member-codes'/,
  'a phone opening the desktop address lands on the phone page');
assert.match(read('components', 'AppShell.jsx'), /path: '\/studio\/member-codes', label: 'Kode member'/, 'the desktop menu lists it');
assert.match(read('components', 'mobile', 'MobileBottomNavigation.jsx'), /path: '\/mobile\/studio\/member-codes', label: 'Kode member'/,
  'and the phone menu');
for (const page of [['pages', 'MemberCodesPage.jsx'], ['pages', 'mobile', 'MobileMemberCodesPage.jsx']]) {
  assert.match(read(...page), /<MemberCodesEditor \/>/, `${page.at(-1)} renders the one shared editor`);
}

// --- 6. No storefront sentence still promises the price for signing in ---------------------------------
// The rule, not a list of keys: an Indonesian message that tells the buyer to sign in AND names the member
// price must also say what actually opens it. The English shop never offers the member price at all.
for (const [key, text] of Object.entries(MESSAGES.id)) {
  if (/Masuk dengan Google/i.test(text) && /harga member/i.test(text)) {
    assert.match(text, /kode member/i, `id.${key} promises the member price for signing in: "${text}"`);
  }
}
for (const raw of [read('utils', 'voucherValidation.js'), endpoint]) {
  assert.doesNotMatch(raw, /sekalian dapat harga member/, 'a voucher refusal still promises the member price for signing in');
}

console.log('memberCodes selfcheck OK (a code\'s percentage prices the line, never above the member price; one rule, both readers)');
