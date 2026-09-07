-- Audit round 9, P-1b (step 2 of 2). ONLY after the client that reads storefront_products_public is live —
-- a client still reading the table would see an empty catalog (RLS filters, it does not error).
--
-- Replaces the row policy from 20260901120000 (drafts hidden, internal tags still readable) with admin-only.
-- Wrapped in a transaction so a failure between DROP and CREATE cannot leave the table without a SELECT
-- policy (which would deny admins too).
begin;

drop policy if exists "storefront products public select" on public.storefront_products;
create policy "storefront products public select"
    on public.storefront_products
    for select
    using (public.is_admin());

commit;

-- Verify (anon key): the table answers [], the view still answers rows.
--   curl -s "$SUPABASE_URL/rest/v1/storefront_products?select=slug&limit=1" -H "apikey: $ANON"      → []
--   curl -s "$SUPABASE_URL/rest/v1/storefront_products_public?select=slug&limit=1" -H "apikey: $ANON" → [{"slug":…}]
--
-- Rollback (restores the drafts-hidden policy from 20260901120000):
--   begin;
--   drop policy if exists "storefront products public select" on public.storefront_products;
--   create policy "storefront products public select" on public.storefront_products for select
--       using (public.is_admin() or not public.storefront_product_is_draft(tags));
--   commit;
