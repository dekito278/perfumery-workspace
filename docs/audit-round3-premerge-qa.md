# Audit round 3 — Pre-merge QA checklist

Fixes that **could not be auto-verified** (need admin login, real Supabase data, or the DOKU sandbox).
Run these against a staging/preview environment before merging PR #2. ✅ = passed, ✍️ = expected result.

> Already verified live (public, no login): journal category filter matches by category; desktop
> product pages add-to-cart correctly (sold-out regression fixed). No need to re-check those.

## 🔴 Money paths (highest priority)

### 1. Manual-transfer order does NOT auto-cancel after paying (the CRITICAL fix)
- [ ] Place a manual-transfer (BCA/WhatsApp) order on an inventory-tracked product.
- [ ] Upload payment proof (order `paymentProofStatus` → `submitted`).
- [ ] Force the reservation TTL to look expired: set the order's `created_at` to >24h ago in Supabase
      (or wait), then open the customer payment page / studio orders list to trigger the sweep.
- ✍️ Order stays `pending` / not cancelled; stock NOT restored; voucher NOT released.
- [ ] Control case: a manual order with **no** proof (`paymentProofStatus: missing`) and `created_at`
      >24h ago **should** still auto-cancel + restore stock. Confirm that still happens.

### 2. Cancel order restores stock exactly once (no double restock)
- [ ] Take a paid, inventory-deducted order; note the product's current stock.
- [ ] Cancel it from the studio. ✍️ Stock goes up by the ordered qty; order row `inventory_deducted` → false.
- [ ] Trigger another inventory-restoring event (mark payment refunded, or cancel again).
      ✍️ Stock does NOT increase a second time.

### 3. Delete order returns reserved stock + confirms
- [ ] Delete a paid, inventory-deducted order from the studio.
- ✍️ A confirmation dialog appears first; after confirming, the product's stock is restored.

### 4. Payment page does not mint duplicate DOKU invoices
- [ ] Open an unpaid DOKU order's payment page, reload it several times.
- ✍️ The same `payment_url` / invoice is reused (check DOKU dashboard for a single active invoice),
      not a new one per reload.

### 5. Voucher exhausted mid-checkout gives a clear message
- [ ] Set a voucher's remaining quota to 0 while a checkout using it is in progress (or simulate a
      failing `storefront_record_voucher_usage`).
- ✍️ Checkout fails with "Voucher … sudah tidak tersedia … checkout ulang tanpa voucher tersebut"
      (not a generic "failed to save order"); the created order is rolled back.

### 6. Batch production does not double-deduct stock across reload
- [ ] Save a batch with a stock-deducting status; note material stock drops once.
- [ ] Reload the batch page and re-save the same status. ✍️ Material stock does NOT drop again
      (order row `is_stock_deducted` stays true).

## 🔴 Auth / security

### 7. Admin allowlist is fail-closed  ⚠️ DEPLOY-CRITICAL
- [ ] `VITE_ADMIN_EMAILS` is inlined at **build** time. Confirm the **production build** carries it
      (currently `aderizki68@gmail.com,dekito@techteam.id`). A build without it = empty allowlist =
      total studio lockout for everyone (fail-closed).
- [ ] Confirm the owner's **real Google login email** is one of the allowlisted addresses.
- [ ] Confirm self-service signup is **disabled** in Supabase Auth settings (so a stranger can't
      register at all).

### 7b. Cancelled order can no longer be paid
- [ ] Cancel an unpaid/pending DOKU order from the studio, then open its payment page.
- ✍️ No live "pay now" invoice is offered (`payment_status` is now `expired`); a `paid` order that
      you cancel keeps `paid` (refunds are separate).

### 8. Disabling MFA requires a live TOTP code
- [ ] Go to the authenticator page → "Nonaktifkan authenticator".
- ✍️ It now asks for a 6-digit code (not the word DISABLE); a wrong code is rejected; only a correct
      live code unenrolls the factor.

### 9. Changing password requires the current password
- [ ] Use the password-change form with a WRONG current password. ✍️ Rejected ("Password saat ini salah").
- [ ] With the correct current password. ✍️ Succeeds.

### 10. MFA is not bypassable on login (race + revocation)
- [ ] Log in with an MFA-enabled account. ✍️ The studio is never shown before the TOTP step; the URL
      doesn't briefly land on `/studio` before the code prompt.
- [ ] Revoke the session server-side (Supabase → sign out user / rotate). ✍️ The app logs out; it does
      NOT silently restore the old session.

## 🟠 Content / studio

### 11. Journal delete
- [ ] Delete a test article from the studio journal list (desktop and mobile). ✍️ Confirms first, then
      the article disappears from the list and the public `/journal`.

### 12. Story editor — reorder then replace an image
- [ ] Add two image sections, reorder them, then replace one section's image.
      ✍️ Only that section's image changes; the other keeps its own image (no corruption).
- [ ] Delete a section and save. ✍️ Its uploaded file is removed from the `product-stories` bucket.

### 13. Site image format swap
- [ ] Upload a `.jpg` to a slot, then upload a `.webp` to the same slot.
      ✍️ The storefront shows the new WebP (not the old JPG); only one file remains for that key.

### 14. Tracking shows cancelled state
- [ ] Track a cancelled order. ✍️ A "dibatalkan" notice shows; the timeline is not a green
      "Order diterima (saat ini)" in-progress bar.

### 15. Voucher percent cap
- [ ] Save a percent voucher with value 500. ✍️ Stored/displayed as 100%, not 500%.
