// Quoting an international parcel against the carrier's own sheet: country decides the zone, weight
// decides the bracket. No API — the rate card is a table, and the table is the price we will be billed.
//
// ONE CARRIER. From 19 Sep to 6 Oct 2026 a second rate table lived beside this one (RaySpeed Asia,
// measured on their simulator) and eight near-Asia destinations were quoted from it instead — about a
// seventh of the DHL price to Malaysia. Dekito ships DHL; he said so on 6 Oct, and the sheet the whole
// price rule is built on is his. The second table is gone, and `carrierNamedIsCarrierUsed.selfcheck.mjs`
// holds the rule that made it dangerous: the carrier a screen NAMES is the carrier its quote CAME from,
// so a second sheet cannot be added here without the screen saying which parcels it covers.
import { EXPORT_FLAT_PER_KG, EXPORT_ODA_FEE, EXPORT_PACKAGE_RATES } from '@/data/exportRates.js';
import { EXPORT_ZONE_BY_COUNTRY } from '@/data/exportZones.js';

export const HOME_COUNTRY = 'ID';

export const isExportDestination = (countryCode) => {
  const code = String(countryCode || '').trim().toUpperCase();
  return Boolean(code) && code !== HOME_COUNTRY;
};

export const getExportZone = (countryCode) => (
  EXPORT_ZONE_BY_COUNTRY[String(countryCode || '').trim().toUpperCase()] ?? null
);

// Carriers bill the bracket, not the gram: 300 g and 500 g both cost the 0.5 kg price.
const bracketFor = (weightKg) => EXPORT_PACKAGE_RATES.find(([kg]) => weightKg <= kg) || null;

const columnFor = (zone) => zone; // [kg, z1, z2, …] — the zone number is the column index.

/**
 * @returns null when the destination is unknown or domestic; otherwise
 *   { zone, chargeableKg, baseCost, odaFee, total, overThirtyKg }
 * Costs are IDR. `odaFee` is only included when the caller says the address needs it — the sheet charges
 * it "apabila ada", and only the carrier knows.
 */
export const quoteExportShipping = ({ countryCode, weightGram, outsideDeliveryArea = false } = {}) => {
  const zone = getExportZone(countryCode);
  if (!zone || !isExportDestination(countryCode)) return null;

  const weightKg = Math.max(Number(weightGram) || 0, 1) / 1000;
  const column = columnFor(zone);

  let baseCost;
  let chargeableKg;
  let overThirtyKg = false;

  const bracket = bracketFor(weightKg);
  if (bracket) {
    chargeableKg = bracket[0];
    // The sheet has at least one bracket that prints dearer than a heavier one. Never quote a buyer more
    // than the next parcel size up would cost them.
    baseCost = Math.min(...EXPORT_PACKAGE_RATES
      .filter(([kg]) => kg >= chargeableKg)
      .map((row) => row[column]));
  } else {
    // Past 30 kg the sheet switches to a flat price per kilo, rounded up to the whole kilo.
    overThirtyKg = true;
    chargeableKg = Math.ceil(weightKg);
    const band = EXPORT_FLAT_PER_KG.find(([min, max]) => chargeableKg >= min && chargeableKg <= max);
    if (!band) return null;
    baseCost = band[column + 1] * chargeableKg;
  }

  const odaFee = outsideDeliveryArea ? EXPORT_ODA_FEE : 0;
  return { zone, chargeableKg, baseCost, odaFee, total: baseCost + odaFee, overThirtyKg };
};
