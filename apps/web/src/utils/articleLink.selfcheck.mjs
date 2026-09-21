// `node src/utils/articleLink.selfcheck.mjs`
//
// Walking the shop on a phone, 2026-09-21: the journal tab listed its article and not one card carried an
// href. The desktop journal has always used <Link>; the phone used <button onClick={navigate}>, so on the
// surface Google crawls first — and the surface people actually share from — an article could not be
// long-pressed, copied, opened in a new tab, or followed by a crawler.
//
// The rule: a card that takes a reader to an article is a LINK, on every surface. A tap is not the only
// way people use a link.
process.env.TZ = 'Asia/Jakarta';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (...parts) => stripComments(readFileSync(join(root, ...parts), 'utf8'));

// Both journal surfaces, read as a pair: the asymmetry between them is the bug.
const surfaces = [
  ['pages', 'PublicJournalPage.jsx'],
  ['pages', 'mobile', 'MobileArticlesPage.jsx'],
];

for (const parts of surfaces) {
  const source = read(...parts);
  const name = parts.join('/');

  // --- 1. Every card is an anchor ------------------------------------------------------------------------
  const links = [...source.matchAll(/<Link\s+to=\{[^}]*[Jj]ournalPublicPath|<Link\s+to=\{articlePath\(/g)];
  assert.ok(links.length >= 1, `${name}: no article card is a <Link> — a tap is not the only way people use a link`);

  // --- 2. And nothing navigates to an article by hand ----------------------------------------------------
  // `navigate('/mobile/catalog')` from an empty state is fine: that is an action, not a card.
  assert.doesNotMatch(source, /onClick=\{\(\) => openArticle\(/,
    `${name}: an article card still navigates on click, so it has no href`);
  assert.doesNotMatch(source, /navigate\((?:path|getJournalPublicPath)/,
    `${name}: an article is opened with navigate() instead of being linked`);
}

// --- 3. The phone card keeps what the button carried ------------------------------------------------------
const phone = read('pages', 'mobile', 'MobileArticlesPage.jsx');
assert.match(phone, /import \{ Link, useLocation, useNavigate \} from 'react-router-dom';/,
  'the phone page must import Link');
// Every card, not just the first one: dropping the state from one of the two left the other carrying it,
// and a single match said yes.
const phoneCards = [...phone.matchAll(/<Link\s+to=\{articlePath\([^)]*\)\}([^>]*)>/g)];
assert.ok(phoneCards.length >= 2, `expected the featured card and the list card, found ${phoneCards.length}`);
for (const [tag, attributes] of phoneCards) {
  assert.match(attributes, /state=\{fromState\}/,
    `the "back" state the button passed must survive the change to a link — ${tag.slice(0, 60)}`);
}
assert.match(phone, /const articlePath = \(post\) => getJournalPublicPath\(post, \{ mobile: true \}\) \|\| '';/,
  'and the phone still links to the phone route, not the desktop one');

console.log('articleLink selfcheck OK (an article card is a link on both surfaces)');
