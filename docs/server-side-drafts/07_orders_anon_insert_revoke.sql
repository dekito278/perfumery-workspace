-- FINAL LOCKDOWN for finding #1 — do NOT apply yet. Kept OUT of supabase/migrations on purpose so a
-- routine `supabase db push` can't apply it early and break live checkout.
--
-- This is what actually enforces server-authoritative pricing: once anon can no longer INSERT orders,
-- the ONLY way to create one is POST /api/orders/create (service role), which recomputes every price
-- from the DB. Until then the endpoint is optional and the price is still client-authoritative.
--
-- PRECONDITIONS — all must be true first, or this breaks checkout:
--   1. /api/orders/create is deployed and smoke-tested on staging (tampered price → server recompute wins).
--   2. VITE_AUTHORITATIVE_ORDERS=true in prod AND BOTH paths are confirmed going through the endpoint —
--      bespoke (createBespokeRequest) AND normal cart (useCheckoutFlow) are both wired (done 2026-07-28);
--      verify Vercel logs show POST /api/orders/create 200 for real orders of each type, no fallback warnings.
--   3. Confirm a real catalog order still deducts stock (endpoint calls storefront_deduct_inventory_for_order)
--      and a voucher order still records usage once (page calls it; the endpoint intentionally does not).
--
-- Apply (as a new timestamped migration, or straight in the SQL editor) only after 1–3 hold:

drop policy if exists "storefront orders public insert" on public.storefront_orders;

-- The service-role endpoint bypasses RLS, so no replacement INSERT policy is needed. Verify afterwards:
--   a direct anon `insert into public.storefront_orders (...)` must be rejected, and a normal + a bespoke
--   checkout must both still succeed through /api/orders/create.
--
-- Rollback if something regresses:
--   create policy "storefront orders public insert" on public.storefront_orders for insert with check (true);
