// The checkout form is kept so a buyer who wanders off — to the catalogue, to check a voucher, or
// because the phone rang — comes back to what they typed. It holds their full name, phone number and
// delivery address, and it lives in localStorage, which never expires on its own.
//
// A completed order clears it. An abandoned one did not: the address stayed on that device forever, so
// the next person to open checkout on a shared phone, a shop computer or a warnet found it filled in.
// `updatedAt` was already being written for exactly this and had never been read.
export const CHECKOUT_DRAFT_STORAGE_KEY = 'dekito.storefront.checkoutDraft.v1';

// Long enough to survive an interrupted session, short enough that it is not a "remember me" the shop
// never offered.
export const CHECKOUT_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const storage = () => (typeof window === 'undefined' ? null : window.localStorage);

export const readCheckoutDraft = (now = Date.now()) => {
  const store = storage();
  if (!store) return {};

  try {
    const rawValue = store.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};
    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) return {};

    // A draft with no timestamp predates this and cannot be aged — treat it as expired rather than
    // keeping someone's address indefinitely.
    const savedAt = Date.parse(parsedValue.updatedAt || '');
    if (!Number.isFinite(savedAt) || now - savedAt > CHECKOUT_DRAFT_MAX_AGE_MS) {
      clearCheckoutDraft();
      return {};
    }

    return parsedValue;
  } catch {
    return {};
  }
};

export const writeCheckoutDraft = (draft) => {
  const store = storage();
  if (!store) return;

  try {
    store.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    // Safari private mode / quota: don't throw on every checkout keystroke.
    console.warn('Failed to persist checkout draft:', error.message || error);
  }
};

export function clearCheckoutDraft() {
  const store = storage();
  if (!store) return;

  try {
    store.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear checkout draft:', error.message || error);
  }
}
