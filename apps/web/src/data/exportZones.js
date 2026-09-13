// LTU Express "Zona Express Export Rate" — every destination country mapped to a zone 1-8.
// Transcribed from the carrier's own sheet: use their zones, never invent regional groupings, because
// their zone is what they bill against. A homemade "Asia" bucket that disagrees with this table is a
// silent loss on every shipment.
//
// Keys are ISO 3166-1 alpha-2 as printed on the sheet.
export const EXPORT_ZONE_BY_COUNTRY = {
  AF: 8, AL: 8, DZ: 8, AS: 8, AD: 7, AO: 8, AI: 8, AG: 8, AR: 8, AM: 8,
  AW: 8, AU: 4, AT: 7, AZ: 8, BS: 8, BH: 6, BD: 6, BB: 8, BY: 8, BE: 7,
  BZ: 8, BJ: 8, BM: 8, BT: 8, BO: 8, XB: 8, BA: 8, BW: 8, BR: 8, BN: 2,
  BG: 7, BF: 8, BI: 8, KH: 2, CM: 8, CA: 5, IC: 8, CV: 8, KY: 8, CF: 8,
  TD: 8, CL: 8, CO: 8, KM: 8, CG: 8, CD: 8, CK: 8, CR: 8, CI: 8, HR: 7,
  CU: 8, XC: 8, CY: 7, CZ: 7, DK: 7, DJ: 8, DM: 8,
  DO: 8, EC: 8, EG: 8, SV: 8, ER: 8, EE: 7, SZ: 8, ET: 8, FK: 8, FO: 8,
  FJ: 8, FI: 7, FR: 7, GF: 8, GA: 8, GM: 8, GE: 8, DE: 7, GH: 8, GI: 8,
  GR: 7, GL: 8, GD: 8, GP: 8, GU: 8, GT: 8, GG: 8, GN: 8, GW: 8, GQ: 8,
  GY: 8, HT: 8, HN: 8, HK: 2, HU: 7, IS: 8, IN: 6, IR: 8, IQ: 8, IE: 7,
  IL: 8, IT: 7, JM: 8, JP: 3, JE: 8, JO: 6, KZ: 8, KE: 8, KI: 8, KR: 4,
  KP: 8, KV: 8, KW: 6, KG: 8, LA: 2, LV: 7, LB: 8, LS: 8, LR: 8,
  LY: 8, LI: 7, LT: 7, LU: 7, MO: 2, MG: 8, MW: 8, MY: 2, MV: 6, ML: 8,
  MT: 7, MP: 8, MH: 8, MQ: 8, MR: 8, MU: 8, YT: 8, MX: 5, FM: 8, MD: 8,
  MC: 7, MN: 8, ME: 8, MS: 8, MA: 8, MZ: 8, MM: 2, NA: 8, NR: 8, NP: 6,
  NL: 7, XN: 8, NC: 8, NZ: 4, NI: 8, NE: 8, NG: 8, NU: 8, MK: 8, NO: 7,
  OM: 6, PK: 6, PW: 8, PA: 8, PG: 4, PY: 8, PE: 8, PH: 2, PL: 7, PT: 7,
  PR: 8, QA: 6, RE: 8, RO: 7, RU: 8, RW: 8, SH: 8, WS: 8,
  SM: 7, ST: 8, SA: 6, SN: 8, RS: 8, SC: 8, SL: 8, SG: 1, SK: 7, SI: 7,
  SB: 8, SO: 8, XS: 8, ZA: 7, SS: 8, ES: 7, LK: 6, XY: 8, XE: 8, KN: 8,
  LC: 8, XM: 8, VC: 8, SD: 8, SR: 8, SE: 7, CH: 7, SY: 8, PF: 8, TW: 4,
  TJ: 8, TZ: 8, TH: 2, TL: 1, TG: 8, TO: 8, TT: 8, TN: 8, TR: 7, TM: 8,
  TC: 8, TV: 8, US: 5, UG: 8, UA: 8, AE: 6, GB: 7, UY: 8, UZ: 8, VU: 8,
  VA: 7, VE: 8, VN: 2, VG: 8, VI: 8, YE: 8, ZM: 8, ZW: 8,

  // The sheet lists China twice — "China (CN) *1" as zone 3 and "China (CN) *2" as zone 4 — and the
  // footnote that separates them is not legible on the copy we were given. Billed at the dearer of the
  // two until that is confirmed: quoting zone 3 and being charged zone 4 is a loss on every parcel.
  CN: 4,
};

export const EXPORT_ZONES = [1, 2, 3, 4, 5, 6, 7, 8];
