-- A perfume can say when it was released.
--
-- Fragrantica records a launch year for every fragrance, and nothing in this shop has ever held one.
-- An editor entering the house either guesses or leaves it blank, and a guess in that database is
-- quoted back forever.
--
-- NOT created_at. That column already exists and looks like an answer: it ranges 2026-05-07 to
-- 2026-09-20 across the nineteen products, which is when each ROW was made in this app — years after
-- some of these perfumes were composed. Deriving a launch year from it would fill a permanent public
-- record with wrong data, confidently. The column below starts NULL on purpose and only Dekito can
-- fill it; supabase/manual/20261009090100_launch_years_to_fill.sql is the form to do it on.
--
-- THE VIEW HAS TO BE RECREATED. A Postgres view freezes its column list at creation time, so adding a
-- column to storefront_products does not make it appear in storefront_products_public — the view every
-- buyer's browser actually reads. That is the trap 20260920170000 documented when `limited` was added,
-- and the body below is copied from it unchanged: jsonb_populate_record expands the table's own column
-- list, so recreating the view is all it takes to pick the new column up.
--
-- Safe to run twice.

alter table public.storefront_products
    add column if not exists launch_year smallint;

comment on column public.storefront_products.launch_year is
    'Year the fragrance was released to buyers. NULL until stated by the atelier — never derived from created_at, which is when the row was made in this app.';

-- A year that cannot be a year is a typo, and a typo here reaches a public database.
alter table public.storefront_products
    drop constraint if exists storefront_products_launch_year_plausible;
alter table public.storefront_products
    add constraint storefront_products_launch_year_plausible
    check (launch_year is null or (launch_year between 1900 and 2100));

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

-- Check — the column exists AND the buyer's view carries it (the second is the one that was missed
-- last time; a 42703 here means the view was not recreated):
-- select slug, launch_year from public.storefront_products_public order by name;
