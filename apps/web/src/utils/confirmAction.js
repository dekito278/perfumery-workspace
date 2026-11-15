// A confirmation the app draws itself, with window.confirm as the floor.
//
// window.confirm is synchronous, which is why this codebase still has eighteen of them: replacing one
// means the caller has to await. It is also a browser chrome dialog — on a phone it reads as something
// the page did not produce, and it cannot say which button is the destructive one.
//
// The floor matters more than the dialog. If no host is mounted — an error boundary swallowed it, a
// route renders outside the app tree, a test mounts a page bare — this falls back to window.confirm
// rather than returning true. A destructive action must never proceed because a dialog failed to
// appear, and that is the one way this abstraction could be worse than what it replaces.

let host = null;

/** Called by ConfirmHost. Returns an unsubscribe that only clears itself, never a newer host. */
export const registerConfirmHost = (ask) => {
  host = ask;
  return () => { if (host === ask) host = null; };
};

/**
 * @param options a message string, or { message, title, confirmText, cancelText, destructive }
 * @returns Promise<boolean> — false for cancel, escape, clicking away, or the host disappearing
 */
export const confirmAction = async (options) => {
  const request = typeof options === 'string' ? { message: options } : (options || {});
  const message = String(request.message || '');
  if (!host) {
    return typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(message)
      // No window at all (SSR, prerender): refusing is the safe answer, since nobody is there to agree.
      : false;
  }
  return host({ ...request, message });
};

/**
 * Cancelling an order is one dropdown pick away on four Studio screens, and it releases the stock and the
 * voucher and closes the payment at once (orderService.updateOrderStatus). Studio audit, 15 Nov 2026: a
 * slip of the thumb did all of that with no question. Every other status goes through untouched.
 */
export const confirmStatusChange = async (status) => (
  status !== 'cancelled' || confirmAction({
    title: 'Batalkan order ini?',
    message: 'Stok dan voucher dikembalikan, dan pembeli tidak bisa membayar order ini lagi.',
    confirmText: 'Batalkan order',
    destructive: true,
  })
);
