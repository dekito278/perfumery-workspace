export const blurNumberInputOnWheel = (event) => {
  event.currentTarget.blur();
};

// Indonesian number entry: "," is the decimal separator and "." groups thousands, so "150.000" means
// 150 thousand, not 150. Reading every "." as a decimal point published products at Rp 150 and understated
// every material cost (audit round 7). One dot followed by exactly three digits is therefore a grouping
// separator — except after a leading "0", where "0.750" is a real decimal (gram fields rely on that).
const applyIndonesianSeparators = (raw) => {
  const text = String(raw ?? '');
  if (text.includes(',')) {
    return text.replace(/\./g, '').replace(',', '.');
  }
  const dots = (text.match(/\./g) || []).length;
  if (dots > 1) {
    return text.replace(/\./g, '');
  }
  if (dots === 1 && /^[^.]*[1-9][^.]*\.\d{3}$/.test(text)) {
    return text.replace('.', '');
  }
  return text;
};

export const normalizeLocalizedDecimalInput = (value, options = {}) => {
  const { autoDecimalAfterLeadingZero = false } = options;
  const text = applyIndonesianSeparators(value);
  let normalized = '';
  let hasDecimal = false;

  for (const character of text) {
    if (/\d/.test(character)) {
      normalized += character;
      continue;
    }

    if (character === '.' && !hasDecimal) {
      normalized += '.';
      hasDecimal = true;
    }
  }

  if (normalized.startsWith('.')) {
    normalized = `0${normalized}`;
  }

  if (autoDecimalAfterLeadingZero && /^0\d+$/.test(normalized)) {
    normalized = `0.${normalized.slice(1)}`;
  }

  return normalized;
};

export const parseLocalizedNumber = (value, fallback = 0) => {
  const normalized = normalizeLocalizedDecimalInput(value);
  if (!normalized || normalized === '.') {
    return fallback;
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
};
