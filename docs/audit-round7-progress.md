# Audit round 7 — progress ledger

Report: https://claude.ai/code/artifact/98a900f1-088f-4c8d-98e7-6c86418adb6f
54 verified findings + the mobile UI items (A2–A5, B, C, D) from the 2026-08-19 UI pass.

Rule for every batch: fix the root cause in the shared helper, never patch each caller.
Migrations are written but **never applied** here — each one carries a MANUAL APPLY header.

| Batch | Scope | Status |
|---|---|---|
| 1 | Kritis — anon order INSERT, customer PII lookup | done |
| 2 | Tinggi — RPC anon grants, doku/status guards, payment page, proof review, number parsing, cart links, batch stock | done |
| 3 | Sedang — order/stock/divergence | todo |
| 4 | Rendah | todo |
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
