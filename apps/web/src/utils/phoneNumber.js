export const normalizeWhatsAppPhoneNumber = (value = '') => {
  const rawValue = String(value || '').trim();
  if (!rawValue || rawValue.includes('@')) return '';

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
