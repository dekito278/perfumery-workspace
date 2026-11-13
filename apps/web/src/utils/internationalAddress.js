// What an address abroad must carry for DHL to deliver it, in one place: the English cart's form asks for
// it and api/orders/create.js refuses an order without it. Import-free so both, and the guard, can use it.
//
// Audit, 13 Nov 2026: the form had no state/province line and the phone was "optional, for the courier"
// — on a box that says the courier may need it for customs. DHL Express asks for a phone on every
// international waybill, and a US, Canadian or Australian address without its state is the classic
// "address incomplete" hold. A postcode is required except where none is in use (NO_POSTCODE_COUNTRIES):
// Hong Kong, the Gulf states and others have none, and refusing them would refuse a real buyer.
export const REGION_REQUIRED_COUNTRIES = ['US', 'CA', 'AU'];

// Countries with no postcode in use (or none DHL can take), from the ones the shop ships to. Everywhere else
// a postcode is required: DHL routes on it, and "optional" let a US, Canadian or German buyer leave it out
// (third visitor audit, 13 Nov 2026). Erring on this list's side refuses nobody; erring off it would.
export const NO_POSTCODE_COUNTRIES = [
  'AE', 'AG', 'AI', 'AO', 'AW', 'BF', 'BH', 'BI', 'BJ', 'BO', 'BS', 'BW', 'BZ', 'CD', 'CF', 'CG', 'CI', 'CK', 'CM',
  'DJ', 'DM', 'ER', 'FJ', 'GA', 'GD', 'GH', 'GM', 'GQ', 'GY', 'HK', 'IE', 'JM', 'KI', 'KM', 'KN', 'KP', 'LB', 'LC',
  'ML', 'MO', 'MR', 'MS', 'MW', 'NR', 'NU', 'OM', 'PA', 'QA', 'RW', 'SB', 'SC', 'SL', 'SO', 'SR', 'ST', 'SY', 'TD',
  'TG', 'TL', 'TO', 'TV', 'UG', 'VU', 'WS', 'YE', 'ZW',
];

export const postcodeRequiredFor = (countryCode = '') => {
  const code = String(countryCode).trim().toUpperCase();
  return Boolean(code) && !NO_POSTCODE_COUNTRIES.includes(code);
};

// Words the buyer's own country uses for the two lines, and its calling code for the phone example.
export const regionLabelKeyFor = (countryCode = '') => ({ US: 'cart.intl.formState', AU: 'cart.intl.formState', CA: 'cart.intl.formProvince' })[String(countryCode).toUpperCase()] || 'cart.intl.formRegion';
export const postcodeLabelKeyFor = (countryCode = '') => (String(countryCode).toUpperCase() === 'US'
  ? 'cart.intl.formZip'
  : (postcodeRequiredFor(countryCode) ? 'cart.intl.formPostcodeRequired' : 'cart.intl.formPostcode'));
const CALLING_CODES = {
  SG: '+65 9123 4567', MY: '+60 12 345 6789', US: '+1 212 555 0100', CA: '+1 416 555 0100', GB: '+44 20 7946 0958',
  AU: '+61 2 9876 5432', NZ: '+64 21 123 4567', DE: '+49 30 123456', FR: '+33 1 23 45 67 89', NL: '+31 20 123 4567',
  JP: '+81 3 1234 5678', KR: '+82 2 123 4567', HK: '+852 9123 4567', TW: '+886 912 345 678', TH: '+66 81 234 5678',
  PH: '+63 917 123 4567', AE: '+971 50 123 4567', SA: '+966 50 123 4567', IN: '+91 98765 43210', CN: '+86 138 0000 0000',
  IT: '+39 06 1234 5678', ES: '+34 612 345 678', CH: '+41 44 123 45 67', BE: '+32 2 123 45 67', SE: '+46 8 123 456 78',
};
export const phoneExampleFor = (countryCode = '') => CALLING_CODES[String(countryCode).toUpperCase()] || '';

// The postcode's shape where it is fixed and well known, so "ABCDE" is not taken as a US ZIP (fifth
// visitor audit, 13 Nov 2026). Countries not listed are checked for presence only. HTML pattern syntax,
// anchored by the browser; compiled with the v flag, so nothing here needs escaping beyond \d.
const POSTCODE_PATTERNS = {
  US: '\\d{5}(-\\d{4})?', CA: '[A-Za-z]\\d[A-Za-z] ?\\d[A-Za-z]\\d', AU: '\\d{4}', NZ: '\\d{4}', JP: '\\d{3}-?\\d{4}',
  SG: '\\d{6}', MY: '\\d{5}', TH: '\\d{5}', PH: '\\d{4}', KR: '\\d{5}', TW: '\\d{3}(\\d{2,3})?', CN: '\\d{6}',
  IN: '\\d{6}', DE: '\\d{5}', FR: '\\d{5}', IT: '\\d{5}', ES: '\\d{5}', NL: '\\d{4} ?[A-Za-z]{2}', BE: '\\d{4}',
  CH: '\\d{4}', AT: '\\d{4}', SE: '\\d{3} ?\\d{2}', NO: '\\d{4}', DK: '\\d{4}', FI: '\\d{5}',
};
export const postcodePatternFor = (countryCode = '') => POSTCODE_PATTERNS[String(countryCode).trim().toUpperCase()];

export const regionRequiredFor = (countryCode = '') => REGION_REQUIRED_COUNTRIES.includes(String(countryCode).trim().toUpperCase());

/** The first field this address is missing, or '' — server and form ask the same question. */
export const missingInternationalField = (fields = {}, countryCode = '') => {
  const required = ['name', 'email', 'phone', 'address', 'city', ...(regionRequiredFor(countryCode) ? ['region'] : []),
    ...(postcodeRequiredFor(countryCode) ? ['postcode'] : [])];
  return required.find((key) => !String(fields[key] || '').trim()) || '';
};

/** The address as the courier label prints it: street, then "postcode city", then region, then country. */
export const composeInternationalAddress = (fields = {}, countryName = '') => [
  fields.address,
  [fields.postcode, fields.city].filter(Boolean).join(' '),
  fields.region,
  countryName,
].map((part) => String(part || '').trim()).filter(Boolean).join('\n');
