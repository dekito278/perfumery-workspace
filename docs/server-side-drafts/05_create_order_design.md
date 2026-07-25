# #2 — Authoritative order creation (design, not a drop-in)

Finding #2: `subtotal` is client-authoritative. `orderService.createOrder` does a client-side anon
`insert` into `storefront_orders` with a client-computed `subtotal`
(`useCheckoutFlow.js:519` → `checkoutTotalDue = (summary.subtotal − voucherDiscount) + shippingFee`,
all client numbers). DOKU then charges that stored value. A crafted anon insert → underpay any order.

**This is NOT a SQL RPC.** Shipping comes from an external courier API (`/api/shipping/rates`), which a
Postgres function can't call. So order creation must move to a **Node serverless endpoint** using the
service-role key — the same pattern as `apps/web/api/doku/checkout.js`.

## Endpoint: `apps/web/api/orders/create.js`
Reuse the service-role REST helper and structure from `api/doku/checkout.js`.

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

## Why this isn't drafted as runnable code
It touches the money path and depends on the products/variants/voucher/shipping contracts I can't test
here. Building it blind would risk breaking checkout. Point me at those table schemas + the shipping
rate call and I'll write the endpoint against them in a focused pass.
