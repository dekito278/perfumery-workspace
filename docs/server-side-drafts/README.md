# Server-side migration DRAFTS

⚠️ **These are DRAFTS, not ready to apply.** They live here (not in `supabase/migrations/`) on purpose so
`supabase db push` won't pick them up. For each: **read it, test on a staging project, do the paired
frontend change, then** move it into `supabase/migrations/` with a real timestamp prefix.

They address the server-side findings in [../audit-pass2-server-side.md](../audit-pass2-server-side.md).
I can't run them against your schema, so treat every one as a proposal to verify.

| File | Finding | Frontend change needed | Risk |
|------|---------|------------------------|------|
| `01_invoice_token.sql` | #3 invoice link leaks account | Yes — use `?token=` not `?code=` | Low (additive) |
| `02_customer_code_entropy.sql` | #1 enumeration (new codes only) | Yes — widen `isCustomerCode` regex | Low, but see caveat |
| `03_lookup_customer_hardening.sql` | #4a ungated PII incl. address | Yes — prefill loses address/contact | Medium (drops columns) |
| `04_payment_proof_ownership.sql` | #4b proof has no owner check | Yes — pass the token | Medium (depends on 01) |

## Apply order
`01` first (04 depends on its `invoice_token` column). The rest are independent.

## #2 order creation — DESIGN `05` + DRAFT ENDPOINT `06_orders_create.draft.js`
`06` is a starter endpoint: the catalog + bespoke **price recompute is real and unit-tested** (ignores
any client price, reads storefront_products/storefront_bespoke_options), while **shipping, voucher, and
the final insert are marked TODO** — they call RajaOngkir / replicate discount logic / must match
buildOrderPayload, so finish + verify them on staging before copying to `apps/web/api/orders/create.js`,
switching the frontend, and revoking the anon INSERT.


The biggest fix (client-authoritative `subtotal`). Turns out it must be a **Node endpoint, not a SQL
RPC**, because shipping comes from an external courier API a Postgres function can't call. `05` has the
full design: recompute item/bespoke prices from the DB, shipping from the courier API + DB promo,
voucher server-side, then insert + lock down the anon INSERT. Not drafted as runnable code because it's
the money path and depends on your product/variant/voucher/shipping contracts — point me at those and
I'll write the endpoint.

## Caveats that are really product decisions
- **02 only protects NEW customers.** Existing `SOLI#####` codes stay short and enumerable; the real
  fix for those is rate-limiting the `storefront_customer_portal` RPC (needs an edge function / gateway,
  not pure SQL) or forcing security questions on. Decide whether to also re-issue codes.
- **03 removes `delivery_address` (and optionally `contact`) from the public lookup.** That's the
  point — but it makes the public bespoke prefill fill less. If you'd rather keep prefill, gate the
  lookup behind the security answer instead (a bigger change).
