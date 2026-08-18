# Audit round 7 — progress ledger

Report: https://claude.ai/code/artifact/98a900f1-088f-4c8d-98e7-6c86418adb6f
54 verified findings + the mobile UI items (A2–A5, B, C, D) from the 2026-08-19 UI pass.

Rule for every batch: fix the root cause in the shared helper, never patch each caller.
Migrations are written but **never applied** here — each one carries a MANUAL APPLY header.

| Batch | Scope | Status |
|---|---|---|
| 1 | Kritis — anon order INSERT, customer PII lookup | done |
| 2 | Tinggi — RPC anon grants, doku/status guards, payment page, proof review, number parsing, cart links, batch stock | done |
| 3a | Sedang — server, uang, stok | done |
| 3b | Sedang — UX customer, divergensi desktop↔mobile | done |
| 4a | Rendah — API, timezone, divergensi kecil | done |
| 4b | Rendah — cart, copy Indonesia, QRIS, brief-intent | todo |
| 5 | UI mobile A2–A5, B1–B3, C1–C2, D1–D2 | todo |

## Batch 1 — done

- **#1 anon can insert any order** — `authoritativeOrdersEnabled()` now defaults ON (opt out with
  `VITE_AUTHORITATIVE_ORDERS=false`), and both silent fallbacks are gone: `useCheckoutFlow.submitOrder`
  and `orderService.createBespokeRequest` no longer swallow an endpoint failure and re-insert a
  client-priced order. A broken endpoint now fails the checkout loudly instead of quietly reopening the
  tampering path.
  **Still needs you:** apply `docs/server-side-drafts/07_orders_anon_insert_revoke.sql` in the Supabase
  SQL editor — but only after one real catalog order AND one real bespoke order have gone through
  `POST /api/orders/create` with a 200 in the Vercel logs. That revoke is what actually closes the hole;
  the code change only stops us from routing around it. Deliberately left out of `supabase/migrations/`
  so a routine `db push` cannot apply it early and kill live checkout.
- **#2 customer PII lookup** — new `supabase/migrations/20260819120000_customer_lookup_pii_lockdown.sql`
  (MANUAL APPLY): `storefront_lookup_customer` now returns only code + name + shipping area (no id, no
  contact, no address, no notes), and `storefront_account_payload(uuid)` is revoked from anon and
  authenticated — it stays reachable from the security-definer wrappers that own the auth check.
  Frontend: the bespoke prefill keeps whatever the buyer already typed instead of blanking contact and
  address. Checkout prefill is unaffected — it uses `storefront_customer_checkout_lookup`, which is
  already gated behind the security answer.

## Batch 2 — done (10 severity-tinggi)

- **restore_inventory anon-callable** — `supabase/migrations/20260819121000_restore_inventory_requires_admin.sql`
  (MANUAL APPLY). The RPC is renamed to `..._unchecked` and a thin wrapper takes its name, so the 160-line
  restore body stays defined once and cannot drift. The wrapper allows service-role (cron, DOKU handlers)
  and `is_admin()` only — plain `authenticated` is not enough, because customer Google logins are
  authenticated too.
- **/api/doku/status missing the webhook's guards** — the terminal-state rules now live in
  `src/utils/dokuOrderGuards.js` and both `api/doku/notification.js` and `api/doku/status.js` call them,
  including the amount check the poll never had (it reads DOKU's own reported amount). Covered by
  `dokuOrderGuards.selfcheck.mjs`.
- **Paid buyer shown a live payment iframe** — extracted `PaymentSuccessPanel` in `PaymentPage.jsx` and
  short-circuited `PaymentFrame` on `paymentStatus === 'paid'`, the same way `QrisPanel` already did. The
  QRIS panel now reuses that component instead of its own copy of the markup.
- **Mobile order delete had no confirmation** — the confirm moved into `useOrders.deleteOne`, so desktop
  and mobile inherit it from one place; the desktop page dropped its now-duplicated `window.confirm`, and
  the mobile button gained the missing try/catch + error toast.
- **Approving a proof on a closed order** — new exported `isOrderClosedForPayment` in `orderService.js`;
  `reviewOrderPaymentProof` now refuses the approval outright instead of writing `payment_status='paid'`
  and then having the follow-up guard read its own write. `updateOrderPaymentStatus` uses the same helper.
- **Rejecting a proof handed the order to the expiry sweep** — the rejection patch now extends
  `payment_expires_at` by `PAYMENT_RESERVATION_TTL_HOURS`, which both the client guard and the cron read,
  so the buyer actually gets the window the rejection message promises.
- **"150.000" parsed as 150** — `numberInputs.js` now applies Indonesian separator rules in one helper
  every caller already routes through (comma = decimal, a lone dot before exactly three digits = grouping,
  except after a leading zero so gram fields keep their decimals). Covered by `numberInputs.selfcheck.mjs`.
- **Cart lines linked to /not-found** — `CartPage` links use `item.productSlug || item.slug`.
- **Publishing a batch deducted raw materials twice** — `is_stock_deducted` is no longer written from the
  client at all (`batchesService.toDatabasePayload`). `deduct_batch_material_stock` owns that flag: it sets
  it and refuses to deduct while it is true. Any save built from stale React state used to clear it; now
  none can, on desktop or mobile.

Checks run: `npm run lint`, all three `*.selfcheck.mjs`, `npm run build`.

## Batch 3a — done (10 severity-sedang: server, uang, stok)

- **Voucher release RPC anon-callable** and **payment-proof submit unguarded** —
  `supabase/migrations/20260819122000_voucher_release_and_payment_proof_hardening.sql` (MANUAL APPLY).
  Release goes behind the same wrapper pattern as the inventory restore (service-role or `is_admin()`);
  recording usage stays anon, because buyers do that at checkout. Proof submission now requires the file
  path to sit under the order's own folder, refuses to overwrite an approved proof, and returns only the
  fields the buyer's own payment page renders instead of the whole order row.
  **Known gap left open on purpose:** proof submission still has no ownership check, so a valid order
  number is enough to attach a file. Closing it needs the security answer in the buyer flow — a UI
  decision, documented in the migration header.
- **Bespoke orders bypassed voucher restrictions** — `getVoucherEligibleSubtotal` returned the *full*
  subtotal when a restricted voucher had no item list to check. It now returns 0: a product/category
  voucher with nothing to match is not a whole-order voucher. Covered by `voucherValidation.selfcheck.mjs`.
- **Customer-side order writes were RLS no-ops reporting success** — `/api/doku/checkout` now persists
  `payment_url`, `payment_reference`, `payment_session_id` and `payment_expires_at` with the service-role
  key it already holds. That is what the reservation sweep reads, so abandoned DOKU checkouts finally
  free their stock on time.
- **Silent refusal on "mark paid"** — `updateOrderPaymentStatus` throws instead of returning quietly, so
  the `toast.success` that every call site fires after the await no longer lies.
- **Bulk mark-paid relabelled manual transfers as DOKU** — `useOrders.updatePaymentStatus` passes the
  order's own provider, matching what OrderDetailPage already did.
- **Zombie orders when the stock deduct fails** — `createOrder` cancels the row it just inserted before
  rethrowing, mirroring `api/orders/create.js`.
- **Product edit reverted stock** — `saveCustomProduct` now carries the row's real `updated_at` (it used
  to stamp "now" on every normalize) and uses it as an optimistic lock. A stale save is refused with
  "muat ulang halaman" instead of writing the pre-order variants back over sold stock, and that conflict
  is never swallowed by the local-draft fallback.
- **Batch re-publish minted a second product** — both desktop and mobile now match the already-published
  product by `savedBatch.product_id` first, falling back to the old parameter hash only for batches
  published before that column was stored.
- **Reservation sweep ran daily against 60-minute payment windows** — cron moved to `*/15 * * * *`.
  **Check your Vercel plan:** Hobby allows one cron run per day. If the deploy rejects the schedule, keep
  it daily and trigger `/api/orders/expire-reservations` from the DOKU status refresh instead.

Checks run: `npm run lint`, four `*.selfcheck.mjs`, `npm run build`.

## Batch 3b — done (11 severity-sedang: UX customer + divergensi)

- **Mobile order actions failed silently** — the status/payment selects called the throwing hook bare, so
  a refusal ("order belum lunas", "order sudah dibatalkan") became an unhandled rejection and the select
  just snapped back. Both now go through `changePaymentStatus` / `changeOrderStatus` with a toast.
- **Mobile order detail could not change payment status at all** — added the handler and controls, and
  `getNextOrderStatusForPayment` moved into `orderWorkflow.js`; it existed once in OrderDetailPage, once
  inline in `useOrders`, and nowhere on mobile.
- **Shipping label truncated multi-line addresses** — note parsing moved into `src/utils/orderNotes.js`,
  which reads a value up to the next known key instead of taking one line. It replaces three copies (the
  label PDF plus both order-detail pages). Covered by `orderNotes.selfcheck.mjs`.
- **Shipped/delivered timestamps drifted 7 hours per save** — `toDatetimeLocal` now formats in local time,
  so the datetime-local input and the stored UTC value round-trip.
- **Quantity changes did not re-price shipping** — a `useEffect` on the parcel weight clears the selected
  rate, forcing a re-quote before the order can be submitted.
- **PaymentPage could render another order's session** — both fallbacks apply the `isSessionForOrder`
  guard that already existed but was only consulted in the early-return branch.
- **Mobile catalog said "No fragrance matches" while loading** — skeletons while the first fetch runs, and
  a distinct "katalog belum bisa dimuat / coba lagi" state when the fetch failed, matching CatalogPage.
- **Mobile journal editor discarded unsaved work** — ported the desktop dirty snapshot, the Back confirm
  and the beforeunload guard.
- **Portal reorder charged the old prices** — reorder lines are re-resolved against the live catalog and
  the draft total is derived from the repriced lines instead of the historical `order.subtotal`.
- **Mobile formula editor could not record a dilution solvent** — the dilution sheet now has a solvent
  select (from the same `type === 'solvent'` list the desktop row uses) and refuses to apply a dilution
  without one, so diluted materials stop being read back as neat.

Still open from this area, moved to batch 4: mobile formula editor does not run the shared
`validateFormulaItems` before submit.

Checks run: `npm run lint`, five `*.selfcheck.mjs`, `npm run build`.

## Batch 4a — done (14 severity-rendah)

- **Shipping fell back to the cheapest rate** — `/api/orders/create` now refuses when the courier and
  service the buyer picked are no longer quotable, instead of quietly charging a different courier.
- **An invalid voucher was dropped server-side** — the endpoint returns 422 with the reason so checkout
  can re-price, rather than charging more than the total the buyer confirmed.
- **QRIS minted a QR for a paid order** — `qris.js` returns 409 on a paid order, mirroring `checkout.js`.
- **Gateway internals echoed to the browser** — order-insert, DOKU checkout and QRIS failures log the raw
  upstream payload server-side and return only a message.
- **Timezone** — new `src/utils/localDay.js` (`shopToday`, `shopEndOfDay`). Six default production and
  validation dates stopped using the UTC calendar day (between 00:00 and 07:00 WIB they were stamped
  yesterday), and a date-only voucher expiry is now pinned to `+07:00` so the browser and the server agree
  on the same instant. Covered by `localDay.selfcheck.mjs`.
- **WhatsApp handoff for email contacts** — `getWhatsAppNotificationUrl` is now
  `getNotificationHandoffUrl` and falls back to the mailto URL when the contact is an email. One function,
  16 call sites fixed; no more empty wa.me window under a "message sent" toast.
- **Formula rows keyed by index** — both desktop modals carry a `row_key`, so removing a row no longer
  leaves the open dilution panel behind on the neighbouring material.
- **Mobile "Salin" wrote "undefined"** — `buildOrderCopyText` in `orderNotes.js` is shared by both order
  lists, and the mobile copy now handles a clipboard rejection.
- **Mobile product form orphaned images** — it runs the same post-save reconciliation as desktop.
- **Printing a resi from mobile left the order in the paid queue** — mobile order detail moves the order to
  `packing`, like the desktop page.
- **Raw material saves could revert a batch deduction** — `updateRawMaterial` no longer writes
  `stock_quantity` back from its snapshot unless the caller explicitly passed it.
- **Checkout copy** — the three English strings are Indonesian, and the DOKU redirect carries `?order=` so
  a lost tab can find its way back to the payment page.

Checks run: `npm run lint`, six `*.selfcheck.mjs`, `npm run build`.
