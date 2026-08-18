# Audit round 7 — progress ledger

Report: https://claude.ai/code/artifact/98a900f1-088f-4c8d-98e7-6c86418adb6f
54 verified findings + the mobile UI items (A2–A5, B, C, D) from the 2026-08-19 UI pass.

Rule for every batch: fix the root cause in the shared helper, never patch each caller.
Migrations are written but **never applied** here — each one carries a MANUAL APPLY header.

| Batch | Scope | Status |
|---|---|---|
| 1 | Kritis — anon order INSERT, customer PII lookup | done |
| 2 | Tinggi — RPC anon grants, doku/status guards, payment page, proof review, number parsing, cart links, batch stock | todo |
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
