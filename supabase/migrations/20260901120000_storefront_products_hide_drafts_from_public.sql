-- Audit round 9 — the fourth table whose publish switch is honoured only in JavaScript.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor. Deploying the app does not apply it.
--
-- storefront_products has carried `for select using (true)` since 20260507123000:65. The draft gate is
-- `isProductDraft()` in productCatalogService.js — a check for the literal tag "Studio draft" — and it runs
-- in the browser, on ten separate pages. So a single
--     GET /rest/v1/storefront_products?select=* (anon key, which ships in the JS bundle)
-- returns every unreleased product: name, price, description, images and variants included.
--
-- Same shape as product_stories (20260817120000) and journal_posts (20260819124000): the switch the owner
-- presses in the studio was never a switch on the server.
--
-- WHAT THIS DOES NOT CLOSE — the internal tags. The same `tags` array also carries 16 internal prefixes
-- ("COGS per bottle:", "Batch ID:", "Formula ID:", "SKU:", "Initial stock:", plus up to 20 "Stock
-- correction:" JSON blobs with actor and notes). Those still leak on PUBLISHED rows after this migration,
-- because RLS filters rows, not columns. Closing that needs the internal tags moved out of `tags` into
-- their own admin-only column, which is a data migration plus a code change — tracked separately as P-1b
-- in docs/audit-round9-progress.md. This migration is the half that costs nothing and can ship today.
--
-- Why a row policy and not a public view: a view means changing the storefront's main read path, which
-- cannot be verified without production credentials. Published rows stay readable exactly as they are now,
-- so the storefront cannot go blank on this change.
--
-- Verify afterwards:
--   -- as anon (or logged out in the app): a drafted product must not come back
--   select slug from public.storefront_products;      -- drafts absent
--   -- as the owner in the studio: /studio/products must still list drafts with the "Draft" badge
--
-- Rollback:
--   drop policy if exists "storefront products public select" on public.storefront_products;
--   create policy "storefront products public select"
--       on public.storefront_products for select using (true);

-- Wrapped in a transaction on purpose: the new policy replaces the old one, so a failure between the
-- DROP and the CREATE would leave storefront_products with no SELECT policy at all — an RLS-enabled table
-- with no policy denies everyone, and the storefront would go blank.
begin;

-- Mirrors isProductDraft() in src/services/productCatalogService.js: case-insensitive, trimmed match on
-- the literal tag the studio writes when "tampilkan di katalog" is off.
create or replace function public.storefront_product_is_draft(p_tags jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
    select exists (
        select 1
        from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) as tag
        where lower(btrim(tag)) = 'studio draft'
    );
$$;

drop policy if exists "storefront products public select" on public.storefront_products;
create policy "storefront products public select"
    on public.storefront_products
    for select
    using (
        public.is_admin()
        or not public.storefront_product_is_draft(tags)
    );

commit;
