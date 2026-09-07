-- "Which bottle, when" needs the shop to know when each bottle is for, and nothing in
-- storefront_products records that. Category is the closest thing, and a category is not an occasion.
--
-- A jsonb column rather than three text[] columns, so the shape can gain a facet later without another
-- migration. Deliberately NOT stored in `tags`: that column is already carrying structured data as
-- prefixed strings (P-5, still open), and adding to it would deepen a problem, not solve one.
--
-- Additive and safe to run any time. Existing rows get {} and are simply untagged — the wardrobe shows
-- them under no filter until somebody says when they are for.
alter table public.storefront_products
    add column if not exists wear jsonb not null default '{}'::jsonb;

comment on column public.storefront_products.wear is
    'When this fragrance is for: {occasions: text[], times: text[], weather: text[]}. Set from the studio product form.';

-- The public view is defined column-by-column, so it must be recreated to carry the new column.
-- (Same maintenance note as in 20260907053000: a new column needs this view redefined.)
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

-- Verify (anon key): the column travels, and internal tags are still stripped.
--   curl -s "$SUPABASE_URL/rest/v1/storefront_products_public?select=slug,wear&limit=3" -H "apikey: $ANON"
--
-- Rollback:
--   alter table public.storefront_products drop column if exists wear;
--   -- then re-run 20260907053000 to restore the view without it.
