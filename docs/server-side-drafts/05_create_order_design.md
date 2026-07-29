# #2 — Authoritative order creation (design, not a drop-in)

Finding #2: `subtotal` is client-authoritative. `orderService.createOrder` does a client-side anon
`insert` into `storefront_orders` with a client-computed `subtotal`
(`useCheckoutFlow.js:519` → `checkoutTotalDue = (summary.subtotal − voucherDiscount) + shippingFee`,
all client numbers). DOKU then charges that stored value. A crafted anon insert → underpay any order.

**This is NOT a SQL RPC.** Shipping comes from an external courier API (`/api/shipping/rates`), which a
Postgres function can't call. So order creation must move to a **Node serverless endpoint** using the
service-role key — the same pattern as `apps/web/api/doku/checkout.js`.

## Confirmed pieces (verified in the repo)
- **Catalog prices ARE server-side** → `storefront_products` table (migration `20260507123000`;
  `productCatalogService.js:706` reads it). So catalog prices CAN be validated server-side.
- **Bespoke prices** → `storefront_bespoke_options` table.
- **Shipping** → RajaOngkir / Komerce via `apps/web/api/shipping/rates.js`. The customer picks a specific
  courier+service; the endpoint must **re-fetch the rate for that selected service** (fresh RajaOngkir
  call by destination + weight) and use it — never the client's `selectedShipping.cost`.
- **Order-endpoint pattern already exists** → `apps/web/api/orders/expire-reservations.js` shows the
  service-role Supabase-from-a-serverless-function pattern to copy.
- **Voucher** → `storefront_record_voucher_usage` RPC (+ a server discount calc).

## Endpoint: `apps/web/api/orders/create.js`
Reuse the service-role REST helper and structure from `api/doku/checkout.js` /
`api/orders/expire-reservations.js`.

Input (references, never prices):
```
{ items: [{ productSlug, variantId, quantity }],   // catalog lines
  bespoke: { optionIds: [...] } | null,             // bespoke lines
  voucherCode, destination, courier,                // for shipping + discount
  customer: { name, code, contact, address, area }, source, paymentProvider }
```

Server steps (all authoritative):
1. **Catalog prices** — read each product/variant price from the DB (service role). Do NOT trust any
   client price. Sum → `itemsSubtotal`. (Confirm the products/variants table + price column names;
   `validateOrderStock` in orderService shows how items map to products today.)
2. **Bespoke prices** — read `storefront_bespoke_options` by the selected option ids; sum into the total.
   (This is why bespoke *can* be validated — the prices are server-side, contrary to the first audit note.)
3. **Shipping** — call the courier rate API server-side (same call `/api/shipping/rates` makes) for
   `destination` + weight, then apply the DB shipping promotion (`storefront_shipping_promotion` row —
   also fixes the client-cache promo bug). → authoritative `shippingFee`.
4. **Voucher** — validate server-side. There's already `storefront_record_voucher_usage`; pair it with a
   server discount computation so `voucherDiscount` isn't client-set.
5. `subtotal = max(itemsSubtotal − voucherDiscount, 0) + shippingFee`. Ignore any client total.
6. Insert `storefront_orders` with the payload `buildOrderPayload` produces today (match its columns
   exactly: `order_number, status:'pending_payment', items` (incl. the voucher discount line via
   `withVoucherDiscountItem`), `quantity, subtotal, checkout_draft, payment_provider, payment_status,
   source`, + `bespoke_production_status` when bespoke). Return the created order.

## Lock down the client path (after the endpoint works)
```sql
revoke insert on public.storefront_orders from anon;      -- name/policy per your schema
-- keep only the service-role insert (the endpoint); drop any "anon can insert orders" RLS policy
```

## Frontend
`useCheckoutFlow` / `createBespokeRequest` call `POST /api/orders/create` with item **references**
(not prices) and use the returned order. Stock validation can stay client-side for UX but the server
insert is the source of truth.

## Reuse (don't reinvent)
- `apps/web/api/doku/checkout.js` — service-role REST config, body reading, error shape.
- `apps/web/api/shipping/rates` (or whatever it proxies) — the courier call.
- `storefront_record_voucher_usage` — voucher reservation.
- `buildOrderPayload` / `withVoucherDiscountItem` in orderService.js — the exact order shape.

## Verify
On staging: `POST /api/orders/create` with a tampered client price → the created order's `subtotal`
matches the server recompute, not the client. Then confirm a direct anon `insert` into
`storefront_orders` is rejected.

## Bespoke client readiness (done 2026-07-28)
The bespoke path now sends stable option **ids** so `priceBespokeOptions` can validate + re-price:
- `createBespokeRequest` stores `item.optionIds = { size, bottleType, capDesign, labelDesign, exoticMaterial }`
  (ids), alongside the existing display labels — see orderService.js. Both BespokePage and
  MobileBespokePage populate it from the selected option objects.
- When wiring `POST /api/orders/create`, build the endpoint's `bespoke.optionIds` array with
  `Object.values(item.optionIds).filter(Boolean)`. The draft's `priceBespokeOptions` already rejects
  unknown/disabled ids (covers finding #4 server-side — no separate client re-fetch needed).
- Still client-authoritative until the endpoint is wired + anon INSERT is revoked. The stored ids are
  harmless-but-useful today (stable linkage / manual price audit); they don't fix #1 on their own.

## Endpoint written (2026-07-28) — `apps/web/api/orders/create.js`
The draft (06) is now a real, deployable endpoint. It recomputes catalog + bespoke prices from the DB,
reuses `/api/shipping/rates` + the DB shipping promo, validates the voucher server-side (isomorphic
`validateVoucher` against `storefront_vouchers`), upserts the customer, and inserts via the service role.
Bespoke lines/notes/checkout_draft come from the shared `src/utils/bespokeOrder.js` builders (same as the
browser, self-checked in `bespokeOrder.selfcheck.mjs`).

**Status (2026-07-28):**
1. ✅ Endpoint written + BOTH frontends wired behind the flag. `createBespokeRequest` and the normal cart
   `useCheckoutFlow` POST to the endpoint when `VITE_AUTHORITATIVE_ORDERS=true`, falling back to the direct
   insert on any error; all paths charge `order.subtotal` (the authoritative total). Catalog orders deduct
   stock via `storefront_deduct_inventory_for_order` (endpoint cancels the order if stock is insufficient).
   Voucher usage is still recorded by the page (endpoint deliberately skips it to avoid double count). Flag
   OFF by default.
2. ⏳ Staging-verify: deploy, set the flag on staging, submit a bespoke AND a catalog order → Vercel logs
   show `POST /api/orders/create 200`, stored `subtotal` equals the server recompute (curl a tampered price
   to prove it), catalog stock deducted, voucher usage counted once. Then enable the flag in prod.
3. ⛔ Final: apply the anon INSERT revoke ([07_orders_anon_insert_revoke.sql](07_orders_anon_insert_revoke.sql))
   only after step 2 holds in prod. This is the step that actually closes finding #1 — until then price is
   still client-authoritative (a crafted anon insert bypasses the endpoint).

Request shape the endpoint expects (references, never prices):
`{ source:'bespoke', customer:{name,code,contact}, delivery:{address,area},
   bespoke:{ optionIds:{size,bottleType,capDesign,labelDesign,exoticMaterial}, perfumeName,
   scentDescription, occasion, ... , preorderAcknowledged }, shipping:{destinationId,destination,courier,
   service}, voucherCode, paymentProvider }`

## Why this is design, not runnable code
All the pieces are now located (above), so it IS buildable. It's left as design because it's the money
path and I can't run the required check here — no live RajaOngkir call, no Supabase, no way to prove the
recomputed subtotal matches before the anon-INSERT lockdown goes in. Ponytail rule: money-path logic
ships with a runnable check; this one's check only exists on staging. Build it there (or I'll write it in
a focused pass and you verify on staging before wiring it in + revoking the anon INSERT).
