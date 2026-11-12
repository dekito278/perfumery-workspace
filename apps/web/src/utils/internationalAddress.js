// What an address abroad must carry for DHL to deliver it, in one place: the English cart's form asks for
// it and api/orders/create.js refuses an order without it. Import-free so both, and the guard, can use it.
//
// Audit, 13 Nov 2026: the form had no state/province line and the phone was "optional, for the courier"
// — on a box that says the courier may need it for customs. DHL Express asks for a phone on every
// international waybill, and a US, Canadian or Australian address without its state is the classic
// "address incomplete" hold. A postcode stays optional: Hong Kong, Ireland (partly) and the Gulf states
// have none, and refusing them would refuse a real buyer.
export const REGION_REQUIRED_COUNTRIES = ['US', 'CA', 'AU'];

export const regionRequiredFor = (countryCode = '') => REGION_REQUIRED_COUNTRIES.includes(String(countryCode).trim().toUpperCase());

/** The first field this address is missing, or '' — server and form ask the same question. */
export const missingInternationalField = (fields = {}, countryCode = '') => {
  const required = ['name', 'email', 'phone', 'address', 'city', ...(regionRequiredFor(countryCode) ? ['region'] : [])];
  return required.find((key) => !String(fields[key] || '').trim()) || '';
};

/** The address as the courier label prints it: street, then "postcode city", then region, then country. */
export const composeInternationalAddress = (fields = {}, countryName = '') => [
  fields.address,
  [fields.postcode, fields.city].filter(Boolean).join(' '),
  fields.region,
  countryName,
].map((part) => String(part || '').trim()).filter(Boolean).join('\n');
