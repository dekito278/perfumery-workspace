export const normalizeWhatsAppPhoneNumber = (value = '') => {
  // An email is never a phone number, but a contact can hold BOTH: an order from the English cart stores
  // "name@example.com · +1 415 555 0132". Refusing anything with an '@' in it threw the number away with
  // the address, so Studio opened WhatsApp with no recipient. The address is removed, the rest is read.
  const rawValue = String(value || '').replace(/[^\s@·,;/]+@[^\s@·,;/]+/g, ' ').trim();
  if (!rawValue) return '';

  let digits = rawValue.replace(/[^0-9]/g, '');
  if (!digits) return '';

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }

  if (digits.startsWith('8')) {
    return `62${digits}`;
  }

  if (digits.startsWith('620')) {
    return `62${digits.slice(3)}`;
  }

  return digits;
};

export const hasValidWhatsAppPhoneNumber = (value = '') => {
  const phone = normalizeWhatsAppPhoneNumber(value);
  return phone.length >= 10 && phone.length <= 15;
};
