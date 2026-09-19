// Quoting an international parcel against the carrier's own sheet: country decides the zone, weight
// decides the bracket. No API — the rate card is a table, and the table is the price we will be billed.
import { EXPORT_FLAT_PER_KG, EXPORT_ODA_FEE, EXPORT_PACKAGE_RATES } from '@/data/exportRates.js';
import { EXPORT_ZONE_BY_COUNTRY } from '@/data/exportZones.js';
import { rayspeedRateFor, rayspeedServes } from '@/data/rayspeedRates.js';

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

/**
 * What this parcel actually costs to send, from the carrier that will actually send it.
 *
 * Three answers, and the middle one is the point:
 *
 *   carrier 'rayspeed', measured true  — a rate read off RaySpeed's own simulator. Quote it.
 *   carrier 'rayspeed', measured false — RaySpeed goes there, but nobody has measured the rate. Quote
 *                                        NOTHING and ask for a number. Falling back to the LTU sheet
 *                                        here would put Rp 890.000 on a Singapore parcel that almost
 *                                        certainly costs about Rp 90.000, and a confident wrong number
 *                                        is worse than a blank.
 *   carrier 'ltu'                      — RaySpeed does not go there (Europe). The LTU sheet is not
 *                                        wrong, it is just expensive and asks for an MSDS.
 *
 * Above one kilo the RaySpeed figure is an ESTIMATE and says so: only the 1 kg point was measured, and
 * one measured point does not describe a curve. Four 30 ml bottles come to exactly one kilo, which is
 * most of what this shop actually ships.
 */
export const quoteInternationalShipping = ({ countryCode, weightGram, outsideDeliveryArea = false } = {}) => {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!isExportDestination(code)) return null;

  if (rayspeedServes(code)) {
    const perKg = rayspeedRateFor(code);
    if (!perKg) {
      return { carrier: 'rayspeed', measured: false, estimated: false, chargeableKg: null, total: null };
    }
    const kg = Math.max(Number(weightGram) || 0, 1) / 1000;
    const chargeableKg = Math.max(1, Math.ceil(kg));
    return {
      carrier: 'rayspeed',
      measured: true,
      estimated: chargeableKg > 1,
      chargeableKg,
      total: perKg * chargeableKg,
    };
  }

  const ltu = quoteExportShipping({ countryCode: code, weightGram, outsideDeliveryArea });
  return ltu ? { ...ltu, carrier: 'ltu', measured: true, estimated: false } : null;
};
