// RaySpeed Asia — the carrier Dekito actually ships with.
//
// WHY THIS FILE EXISTS. Everything international in this app was quoting the LTU Express sheet, which is
// a formal DG-compliant forwarder: it asks for an MSDS for perfume and prices accordingly. Dekito does
// not use it. He ships RaySpeed, and the gap is not a rounding error — Rp 1.188.000 against Rp 90.000
// for the same kilo to Malaysia. Every international quote this app produced was roughly ten times the
// price he would be billed.
//
// PROVENANCE. Each rate below was read off RaySpeed's own price simulator on 19 September 2026, origin
// Jakarta, service Reguler, 1 kg, box 15×15×15 cm. Nothing here is estimated or interpolated from
// another number: a country with no measured rate is not quoted at all.

export const RAYSPEED_MEASURED_ON = '2026-09-19';

/** IDR for the first kilo, measured. */
export const RAYSPEED_RATE_PER_KG = {
  // Read as "Malaysia East" — Sabah/Sarawak, which is normally the DEARER half of Malaysia, so the
  // peninsula is this price or less. Quoting the dearer half is the safe direction to be wrong in.
  MY: 90000,
  US: 670500,
};

/**
 * Countries RaySpeed advertises its own destination page for, but whose rate has not been measured yet.
 *
 * Kept apart from the rates on purpose. For these the app must say "not measured — type it in" rather
 * than fall back to the LTU sheet, because falling back would quote Singapore at Rp 890.000 when the
 * real figure is almost certainly closer to Malaysia's Rp 90.000. A blank the owner fills in is honest;
 * a confident wrong number is not.
 */
export const RAYSPEED_SERVED_UNMEASURED = ['SG', 'TW', 'HK', 'BN', 'JP', 'AU'];

/**
 * Germany came back "Harga Tidak Tersedia" from the same simulator, and Europe appears nowhere among
 * RaySpeed's destination pages. So Europe still belongs to LTU — whose sheet is not wrong, just
 * expensive and MSDS-bound. That is a real constraint on the business, not a bug to fix in code.
 */
export const RAYSPEED_KNOWN_UNSERVED = ['DE'];

export const rayspeedRateFor = (countryCode) => (
  RAYSPEED_RATE_PER_KG[String(countryCode || '').trim().toUpperCase()] ?? null
);

export const rayspeedServes = (countryCode) => {
  const code = String(countryCode || '').trim().toUpperCase();
  return Boolean(RAYSPEED_RATE_PER_KG[code]) || RAYSPEED_SERVED_UNMEASURED.includes(code);
};
