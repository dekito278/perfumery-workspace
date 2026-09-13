// `node src/utils/exportShipping.selfcheck.mjs`
//
// Values checked against the carrier's printed sheet (LTU Express, EXPORT RATE EXPRESS 2026, efektif
// 5 Feb 2026). If the sheet is reissued, these numbers are what tell us the table was not updated with it.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const shim = join(here, `.exportShipping.selfcheck.${process.pid}.mjs`);
writeFileSync(shim, readFileSync(join(here, 'exportShipping.js'), 'utf8')
  .replace(/from '@\/data\//g, "from '../data/"));
const {
  EXPORT_ZONE_BY_COUNTRY, getExportZone, isExportDestination, quoteExportShipping,
} = { ...await import(shim), ...await import('../data/exportZones.js') };
unlinkSync(shim);

// --- zones, straight off the sheet -------------------------------------------------------------------
for (const [country, zone] of Object.entries({
  SG: 1, TL: 1, MY: 2, TH: 2, VN: 2, HK: 2, JP: 3, AU: 4, NZ: 4, TW: 4,
  US: 5, CA: 5, MX: 5, IN: 6, AE: 6, SA: 6, GB: 7, DE: 7, FR: 7, ZA: 7, BR: 8, NG: 8,
})) {
  assert.equal(getExportZone(country), zone, `${country} must be zone ${zone}`);
}
assert.equal(Object.keys(EXPORT_ZONE_BY_COUNTRY).length, 233, 'the sheet lists 233 destinations');
assert.equal(getExportZone('id'), null, 'Indonesia is not in the zone table at all');
assert.equal(getExportZone('ZZ'), null, 'an unknown country must return null, never a guessed zone');
assert.equal(isExportDestination('ID'), false);
assert.equal(isExportDestination('MY'), true);

// --- brackets ----------------------------------------------------------------------------------------
// One 30 g... one 300 g bottle is billed at 0.5 kg, the smallest bracket there is.
assert.equal(quoteExportShipping({ countryCode: 'MY', weightGram: 300 }).chargeableKg, 0.5);
assert.equal(quoteExportShipping({ countryCode: 'MY', weightGram: 300 }).total, 909000,
  'Malaysia, 0.5 kg, is Rp 909.000 on the sheet');
// Three bottles = 900 g, which is billed at 1.0 kg.
assert.equal(quoteExportShipping({ countryCode: 'SG', weightGram: 900 }).chargeableKg, 1);
assert.equal(quoteExportShipping({ countryCode: 'SG', weightGram: 900 }).total, 1092000);
// Exactly on a bracket edge stays in that bracket rather than rounding up to the next.
assert.equal(quoteExportShipping({ countryCode: 'US', weightGram: 2000 }).chargeableKg, 2);
assert.equal(quoteExportShipping({ countryCode: 'US', weightGram: 2000 }).total, 2396000);
assert.equal(quoteExportShipping({ countryCode: 'GB', weightGram: 500 }).total, 1580000);

// --- the printed anomaly -----------------------------------------------------------------------------
// Zone 1 at 5.0 kg prints as Rp 5.470.000 while 5.5 kg prints as Rp 2.704.000. A buyer must never be
// quoted more for a lighter parcel than a heavier one costs.
const fiveKg = quoteExportShipping({ countryCode: 'SG', weightGram: 5000 });
const fiveAndHalf = quoteExportShipping({ countryCode: 'SG', weightGram: 5500 });
assert.ok(fiveKg.total <= fiveAndHalf.total,
  `5 kg to zone 1 quoted ${fiveKg.total} while 5.5 kg quotes ${fiveAndHalf.total}`);
assert.equal(fiveKg.total, 2704000, 'it should fall back to the cheapest heavier bracket');

// --- past the table ----------------------------------------------------------------------------------
const bulk = quoteExportShipping({ countryCode: 'MY', weightGram: 40000 });
assert.ok(bulk.overThirtyKg, 'over 30 kg switches to the flat per-kg band');
assert.equal(bulk.chargeableKg, 40);
assert.equal(bulk.total, 473000 * 40, 'zone 2, 31-70 kg band, is Rp 473.000 per kg');

// --- the extras the sheet does not include -----------------------------------------------------------
const plain = quoteExportShipping({ countryCode: 'MY', weightGram: 300 });
const remote = quoteExportShipping({ countryCode: 'MY', weightGram: 300, outsideDeliveryArea: true });
assert.equal(remote.total - plain.total, 390000, 'the ODA fee is Rp 390.000 and only when asked for');
assert.equal(plain.odaFee, 0, 'ODA is never assumed — only the carrier knows if an address needs it');

// --- domestic and nonsense ---------------------------------------------------------------------------
assert.equal(quoteExportShipping({ countryCode: 'ID', weightGram: 300 }), null,
  'domestic orders keep going through RajaOngkir, not this table');
assert.equal(quoteExportShipping({ countryCode: 'ZZ', weightGram: 300 }), null);
assert.equal(quoteExportShipping({}), null);

console.log('exportShipping selfcheck OK (233 destinations, 8 zones, brackets and flat bands match the sheet)');
