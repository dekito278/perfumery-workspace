// The secret in /pay/<token>.
//
// The order NUMBER cannot be the secret. DKT-MPGB5BF0 is printed on every invoice and quoted in every
// WhatsApp thread, and it is short enough to walk: a page keyed on it would hand a stranger the amount
// due on anybody's order. So the link carries its own random value and the order number stays public.
//
// 160 bits, base32 without the letters that get misread aloud or in a screenshot — no I, L, O, U. The
// brief asks for at least 128; this is the next whole multiple of five bits that clears it, which is
// what base32 counts in.
//
// Import-free so the guard runs the arithmetic. The randomness is injected, so the guard can feed it a
// known sequence instead of hoping.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 symbols, no I/L/O/U
export const PAYMENT_TOKEN_LENGTH = 32;              // 32 x 5 bits = 160
export const PAYMENT_TOKEN_MIN_BITS = 128;

/** Characters needed to carry at least `bits`, in this alphabet. */
export const tokenCharsFor = (bits) => Math.ceil(bits / 5);

/**
 * @param randomBytes  (n) => Uint8Array — crypto.getRandomValues in the browser, injected here so a
 *   guard can assert the mapping rather than the distribution. Math.random is NEVER acceptable: this
 *   value is the only thing standing between a stranger and another buyer's order.
 */
export const createPaymentToken = (randomBytes) => {
  if (typeof randomBytes !== 'function') throw new Error('createPaymentToken needs a random source');
  const bytes = randomBytes(PAYMENT_TOKEN_LENGTH);
  let token = '';
  for (let index = 0; index < PAYMENT_TOKEN_LENGTH; index += 1) {
    // One byte per character, taken modulo 32. The bias that introduces is 256/32 = 8 exactly, so there
    // is none: every symbol is reachable from exactly eight byte values.
    token += ALPHABET[Number(bytes[index]) % ALPHABET.length];
  }
  return token;
};

/** The browser's source. Kept here so no caller reaches for Math.random by habit. */
export const browserRandomBytes = (length) => {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * Is this string shaped like one of our tokens?
 *
 * Used before a lookup, so a URL full of punctuation never reaches the database, and so an obviously
 * wrong link gets the same answer as a wrong-but-plausible one.
 */
export const isPaymentToken = (value) => (
  typeof value === 'string'
  && value.length === PAYMENT_TOKEN_LENGTH
  && [...value].every((character) => ALPHABET.includes(character))
);
