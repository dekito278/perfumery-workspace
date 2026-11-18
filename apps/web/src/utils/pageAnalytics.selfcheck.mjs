// `node src/utils/pageAnalytics.selfcheck.mjs`
//
// Page-view counting (18 Nov 2026) counts buyer pages only, and never carries an order number, invoice,
// payment token, query string or hash into the report. The Help page says it happens.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { analyticsUrl } from './pageAnalytics.js';

const O = 'https://www.solivagantscent.com';
const cases = [
  ['/', `${O}/`],
  ['/en', `${O}/en`],
  ['/en/', `${O}/en`],
  ['/catalog/samhain?utm=x#notes', `${O}/catalog/samhain`],
  ['/en/catalog/samhain', `${O}/en/catalog/samhain`],
  ['/help', `${O}/help`],
  ['/track/SOL-20261117-ABCD', `${O}/track/:order`],
  ['/track-order/SOL-1', `${O}/track-order/:order`],
  ['/customer/invoice/SOL-20261117-ABCD', `${O}/customer/invoice/:order`],
  ['/payment?order=SOL-1&token=abc', `${O}/payment`],
  ['/pay/abc123', `${O}/pay/:token`],
  ['/studio/orders/SOL-1', null],
  ['/mobile/studio/customers', null],
  ['/login', null],
  ['/dashboard', null],
  ['/batches/abc', null],
  ['/raw-materials', null],
];
for (const [path, want] of cases) assert.equal(analyticsUrl(O + path), want, path);
assert.equal(analyticsUrl('not a url'), null);

const src = join(dirname(fileURLToPath(import.meta.url)), '..');
const util = readFileSync(join(src, 'utils', 'pageAnalytics.js'), 'utf8');
assert.match(util, /PRODUCTION_HOSTS\.has\(window\.location\.hostname\)/, 'previews and localhost must not count');
assert.match(util, /window\.va\('beforeSend'/, 'every event passes through analyticsUrl before it leaves');
assert.match(util, /script\.src = '\/_vercel\/insights\/script\.js'/, 'same-origin script, allowed by the CSP');
assert.match(readFileSync(join(src, 'main.jsx'), 'utf8'), /\ninstallPageAnalytics\(\);\n/);

const { MESSAGES } = await import('../i18n/messages.js');
assert.match(MESSAGES.id['help.privacy'], /tanpa cookie/);
assert.match(MESSAGES.en['help.privacy'], /no cookies/);
console.log('pageAnalytics selfcheck OK (buyer pages only, no order numbers, said on the Help page)');
