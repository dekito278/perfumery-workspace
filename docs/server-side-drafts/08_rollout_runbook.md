# Server-side lockdown rollout runbook

Closing the two remaining live criticals from the July 2026 audit:
- **A. Price tampering** — anon can insert orders directly with a client-controlled `subtotal`
  (`storefront_orders` RLS insert is `with check (true)`; client inserts via `orderService.createOrder`).
- **B. Order enumeration** — `storefront_payment_session_lookup` is granted to `anon` and order numbers
  were low-entropy (`DKT-<base36 timestamp>`), so anyone could guess numbers and harvest PII + payment URLs.

Steps only the repo owner can run (DB migrations, env vars, deploy) are marked **[OPS]**.

---

## Already done in code (this branch)

- **Order numbers are now high-entropy**: `DKT-<ts36>-<rand6>` in both `orderService.createOrderNumber`
  and `api/orders/create.js`. New orders can no longer be enumerated by guessing timestamps. (Existing
  orders keep their old low-entropy numbers — a bounded historical set; the ongoing risk was new orders.)
- **`api/orders/create.js` hardened** so it is correct when enabled:
  - Item price recomputed from DB variant/base (already), and now **refuses** when a product has variants
    but the client's size/variantId matches none (was silently charging base `price_number`).
  - **Category enforced from DB** in each resolved line (voucher category-restrictions no longer trust a
    client-sent `category`).
  - **Requires `shipping.destinationId`** whenever the client sends any shipping intent
    (courier/service/destination) — previously an omitted destinationId silently made shipping fee 0.

---

## A. Price-tampering lockdown (phased — do NOT skip the staging test)

The endpoint `api/orders/create.js` recomputes every price server-side. The client is **already wired** to
it (below); the lockdown holds only once anon INSERT is revoked — the flag alone is not enough.

0. **[code — DONE]** The client already POSTs to the endpoint when the flag is on, with a fallback:
   - Catalog: `useCheckoutFlow.submitOrder` → `createCatalogOrderViaEndpoint` (else `createOrder`).
   - Bespoke: `createBespokeRequest` → `createBespokeOrderViaEndpoint` (else direct insert).
   - Both use the returned order for the payment step (DOKU / manual). Voucher usage is recorded by the
     **page** (`recordVoucherUsageForOrder`) on both paths — the endpoint deliberately does NOT record it,
     so there is no double count. (If the page calls are ever removed, make the endpoint record usage.)
1. **[OPS]** Set `VITE_AUTHORITATIVE_ORDERS=true` and deploy to **staging**. On its own this makes checkout
   *prefer* the endpoint but **does not** close tampering: if the endpoint errors, the client falls back to
   a client-priced direct insert (and an attacker can force that by making the endpoint throw). Enforcement
   is step 3.
2. **[OPS] Staging test** — curl the endpoint with a tampered price/subtotal; confirm the stored `subtotal`
   equals the server recompute, not the client value. Also test: voucher order (stock deducts via the
   `voucher_discount`-skipping RPC — migration `20260729120000`), category-restricted voucher on a
   non-matching cart (rejected), bespoke order, and an order with shipping intent but no destinationId (422).
3. **[OPS] — the actual enforcement.** Apply `docs/server-side-drafts/07_orders_anon_insert_revoke.sql`
   (`revoke insert on public.storefront_orders from anon;`). **Only after** steps 1–2 pass on staging. This
   kills the direct-insert fallback, so a tampered order literally can't be inserted; a genuinely-down
   endpoint now fails checkout closed (correct) instead of silently accepting a client-priced order. Move
   the file into `supabase/migrations/` at that point (leaving it here keeps it out of auto-apply).
4. **[OPS]** Promote to production; smoke-test a real checkout end-to-end (catalog + bespoke, manual + DOKU).

Rollback: unset `VITE_AUTHORITATIVE_ORDERS` and `grant insert on public.storefront_orders to anon;`.

---

## B. Enumeration — remaining hardening (defense in depth)

High-entropy order numbers already close the practical enumeration vector for new orders. Status of the
follow-ups I considered:

- **Field-trim of `storefront_payment_session_lookup` — REJECTED (would break the buyer payment page).**
  Investigated the consumers: `PaymentPage` (served to the *unauthenticated* buyer, keyed only by order
  number) reads `customerName`, `customerCode`, `paymentProofUrl`/`FileName`/`ContentType`,
  `paymentProofNotes`, and `paymentResponse` from this RPC. Trimming them breaks a buyer who resumes payment
  from their order-number link on a fresh device. The RPC's whole purpose is to hand an unauthenticated
  buyer their own order, so it must return the full set.
- **Accepted posture:** because the payment page is unauthenticated and keyed by order number, the order
  number *is* the bearer secret. High-entropy numbers (done) make guessing infeasible, which is the right
  mitigation for this design. No further change recommended right now.
- **`lookup_token` (optional, deferred, breaking):** the only way to do better is to split the display id
  from the secret — add a per-order random token, return it only to the creating client, embed it in the
  payment link, and require it as a second RPC arg. Marginal added benefit now that numbers are
  high-entropy, and it breaks every in-flight order (existing bookmarked payment links have no token). Only
  worth doing as a deliberate, scheduled change — not now.
