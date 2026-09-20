-- The badge column exists on the table and the shop cannot see it.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor. Deploying the app does not apply it.
--
-- 20260920160500 added storefront_products.limited. The storefront does not read that table — it reads
-- storefront_products_public, and a Postgres view FREEZES its column list at creation time. Adding a
-- column to the table does not add it to a view already built over it.
--
-- Measured with the anon key right after the first migration ran:
--
--   GET /rest/v1/storefront_products_public?select=name,category,limited
--   -> 400 42703 "column storefront_products_public.limited does not exist"
--
-- So the badge would have stayed invisible to every buyer, and — worse — the moment a perfume was
-- re-filed from 'Limited' to its real family, its badge would have vanished: the fallback that keeps
-- today's screen intact reads `category = 'limited'`, and that would no longer be true either.
--
-- This is the third time this shop has hit it. The English copy columns needed the same follow-up in
-- #181, which is why productCopy.selfcheck asserts the view is recreated AND re-granted.
--
-- The view body is unchanged. jsonb_populate_record expands the table's own column list, so recreating
-- it simply picks the new column up; `create or replace view` accepts columns appended at the end.

create or replace view public.storefront_products_public as
    select (jsonb_populate_record(
        null::public.storefront_products,
        to_jsonb(p) || jsonb_build_object(
            'tags',
            coalesce(
                (select jsonb_agg(tag)
                 from jsonb_array_elements_text(coalesce(p.tags, '[]'::jsonb)) as tag
                 where not public.storefront_product_tag_is_internal(tag)),
                '[]'::jsonb
            )
        )
    )).*
    from public.storefront_products p
    where not public.storefront_product_is_draft(p.tags);

grant select on public.storefront_products_public to anon, authenticated;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- -- 1. The shop can finally read the badge (expect rows, not 42703):
-- --   curl -s "$SUPABASE_URL/rest/v1/storefront_products_public?select=name,category,limited&order=name" \
-- --     -H "apikey: $ANON"
-- --   -> 19 rows, 10 of them limited = true
--
-- -- 2. Nothing else moved:
-- select category, count(*) from public.storefront_products_public group by category order by 2 desc;
--     -> Limited 10, Floral 4, Gourmand 2, Woody 2, Fresh 1
--
-- -- 3. Drafts are still hidden, which is the whole reason this view exists:
-- select count(*) from public.storefront_products_public;   -- fewer than storefront_products if any draft
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- Recreating the view from 20260908093000 restores the previous column list. Note that dropping
-- storefront_products.limited first would fail while this view depends on it.
