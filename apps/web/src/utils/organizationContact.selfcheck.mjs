// `node src/utils/organizationContact.selfcheck.mjs`
//
// The shop's WhatsApp number lives in ONE place, VITE_STOREFRONT_WHATSAPP_NUMBER, and every button reads it.
// The Organization block search engines read had it typed into seo.js, so a number changed in Vercel would
// have moved every button and left the old one in search results (2026-11-03).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOrganizationJsonLd } from './seo.js';

assert.equal(buildOrganizationJsonLd('https://shop.test', '0812 0000 0000').contactPoint.telephone, '+6281200000000',
  'the contact point carries the configured number, written the way every button writes it');
assert.equal(buildOrganizationJsonLd('https://shop.test', '').contactPoint, undefined,
  'no number configured: no contact point that names nothing');
assert.doesNotMatch(readFileSync(new URL('./seo.js', import.meta.url), 'utf8'), /\d{9,}/,
  'no phone number typed into seo.js');

console.log('organizationContact selfcheck OK (the search-result phone is the configured one, or none)');
