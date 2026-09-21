/**
 * The shape a customer code has to have, in one place, because the database enforces it and two callers
 * did not agree about it.
 *
 * storefront_customers carries `check (customer_code ~ '^SOLI[0-9]{5}$')`. The browser's own checkout has
 * always dropped anything that did not match; /api/orders/create passed whatever was typed straight to
 * the upsert. A real buyer typed SOLIO932 — the letter O where a zero belongs, and four characters
 * instead of five — and Postgres refused the row. Her checkout died at the last step, with the raw
 * constraint error and her own name, phone and address printed on the page.
 *
 * A code nobody recognises is not worth failing an order over: it is an optional field for returning
 * buyers. So it becomes null, the order is recorded, and the checkout tells her the code was not used.
 */
export const CUSTOMER_CODE_PATTERN = /^SOLI[0-9]{5}$/;

export const normalizeCustomerCode = (value = '') => String(value ?? '').trim().toUpperCase();

/** The code, or null when it is not one. Never throws: an unusable code must not cost an order. */
export const asCustomerCode = (value = '') => {
  const code = normalizeCustomerCode(value);
  return CUSTOMER_CODE_PATTERN.test(code) ? code : null;
};

export default asCustomerCode;
