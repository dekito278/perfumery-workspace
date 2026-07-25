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

## NOT drafted here — #2 `storefront_create_order` (the biggest one)
Moving order creation server-side (so `subtotal` can't be client-set, and shipping is computed
server-side) needs your product/variant/bespoke-option/voucher/shipping table schemas to recompute
prices accurately. It's too schema-specific to draft blind. It's also the highest-value server fix and
the right home for server-side shipping. Do it as a dedicated task — happy to build it if you point me
at those table definitions.

## Caveats that are really product decisions
- **02 only protects NEW customers.** Existing `SOLI#####` codes stay short and enumerable; the real
  fix for those is rate-limiting the `storefront_customer_portal` RPC (needs an edge function / gateway,
  not pure SQL) or forcing security questions on. Decide whether to also re-issue codes.
- **03 removes `delivery_address` (and optionally `contact`) from the public lookup.** That's the
  point — but it makes the public bespoke prefill fill less. If you'd rather keep prefill, gate the
  lookup behind the security answer instead (a bigger change).
