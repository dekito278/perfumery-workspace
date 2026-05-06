export const blurNumberInputOnWheel = (event) => {
  event.currentTarget.blur();
};

export const normalizeLocalizedDecimalInput = (value, options = {}) => {
  const { autoDecimalAfterLeadingZero = false } = options;
  const text = String(value ?? '').replace(/,/g, '.');
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
