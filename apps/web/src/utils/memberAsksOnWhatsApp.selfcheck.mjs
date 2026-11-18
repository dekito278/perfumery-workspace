// `node src/utils/memberAsksOnWhatsApp.selfcheck.mjs`
//
// Dekito, 18 Nov 2026: a new buyer has no member code, so "Cara jadi member" opens a WhatsApp chat with
// "Halo, saya mau jadi member" typed, he replies with a code, and the account page takes it (Google
// sign-in + code). Every "how to become a member" door in the Indonesian shop goes through MemberAskLink.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MESSAGES } from '../i18n/messages.js';
import { whyDirectReasons } from '../data/whyDirect.js';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(src, ...parts), 'utf8');

for (const parts of [['components', 'storefront', 'PriceNote.jsx'], ['pages', 'HelpPage.jsx'], ['pages', 'CartPage.jsx'], ['components', 'storefront', 'WhyBuyDirect.jsx'], ['components', 'storefront', 'MemberCodePanel.jsx']]) {
  const text = read(...parts);
  assert.match(text, /<MemberAskLink\b/, `${parts.at(-1)} offers the WhatsApp way to ask for a code`);
  assert.doesNotMatch(text, /<Link to="\/customer"[^>]*>\{t\('(price\.howToMember|why\.member\.cta)'\)\}/, `${parts.at(-1)} still sends "Cara jadi member" to the sign-in page`);
}

const member = (region) => whyDirectReasons(region).find((reason) => reason.key === 'member');
assert.equal(member('id').askMember, true, 'the home card asks on WhatsApp in the Indonesian shop');
assert.equal(member('en').askMember, false, 'abroad there is no member price, so no member chat');

assert.match(read('components', 'storefront', 'MemberCodePanel.jsx'), /\{!isMember \? \(\s*<MemberAskLink labelKey="member\.askCode"/, 'a member is not asked to ask for a code');
assert.match(MESSAGES.id['member.howBody'], /WhatsApp/);
assert.match(MESSAGES.id['member.howBody'], /kode pelanggan/, 'the old code is called "kode pelanggan" (one name)');
assert.doesNotMatch(MESSAGES.id['member.howBody'], /kode SOLI/);
for (const language of ['id', 'en']) {
  assert.ok(MESSAGES[language]['member.waDraft'] && MESSAGES[language]['member.askCode'], `${language} keys are paired`);
}
console.log('memberAsksOnWhatsApp selfcheck OK (every member door asks on WhatsApp; abroad untouched)');
