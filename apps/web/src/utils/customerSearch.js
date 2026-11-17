// Find a buyer by name, WhatsApp number or old SOLI code (Studio audit, 15 Nov 2026: the customer list had no
// search on either screen, while the phone's nav promised "Cari kode customer"). A phone number matches
// however it was typed: 0812…, +62 812…, 62812… and spaces or dashes are one number.
const lower = (value) => String(value || '').toLowerCase();
const digits = (value) => String(value || '').replace(/\D+/g, '');
const localPhone = (value) => {
  const d = digits(value);
  if (d.startsWith('62')) return d.slice(2);
  if (d.startsWith('0')) return d.slice(1);
  return d;
};

export const matchesCustomer = (customer = {}, query = '') => {
  const q = lower(query).trim();
  if (!q) return true;
  if ([customer.customerName, customer.customerCode, customer.contact].some((field) => lower(field).includes(q))) return true;
  const qPhone = localPhone(q);
  return qPhone.length >= 4 && localPhone(customer.contact).includes(qPhone);
};

export const searchCustomers = (customers = [], query = '') => (
  (Array.isArray(customers) ? customers : []).filter((customer) => matchesCustomer(customer, query))
);

export default searchCustomers;
