// `node src/utils/nameOnlyWhereItBelongs.selfcheck.mjs`
//
// Dekito, 14 Nov 2026: "nggak usah ada kata Dekito deh, kayak terlalu caper banget". Replacing "atelier"
// had put his name in some forty places — "WhatsApp Dekito", "Chat Dekito", "Catatan Dekito", "dari meja
// kerja Dekito", "Pesanan sedang disiapkan Dekito". The shop speaks as "kami" now. His name stays only
// where it says whose brand this is: the site title and description, About, and the footer line.
import assert from 'node:assert/strict';
import { MESSAGES } from '../i18n/messages.js';

const ALLOWED = new Set(['home.tab', 'home.meta', 'about.tab', 'about.meta', 'about.p1', 'nav.footerTagline']);
const named = [];
for (const [language, table] of Object.entries(MESSAGES)) {
  for (const [key, value] of Object.entries(table)) {
    if (typeof value === 'string' && /Dekito/.test(value) && !ALLOWED.has(key)) named.push(`${language}.${key}: ${value.slice(0, 80)}`);
  }
}
assert.deepEqual(named, [], `the shop names Dekito outside the brand line again:\n  ${named.join('\n  ')}`);
for (const key of ALLOWED) assert.match(MESSAGES.id[key], /Dekito/, `${key} no longer says whose brand this is`);

console.log(`nameOnlyWhereItBelongs selfcheck OK (Dekito named only in ${ALLOWED.size} brand lines per shop)`);
