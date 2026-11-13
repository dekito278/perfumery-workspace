-- "Parfum karya": the batch a bottle comes from, and photos of the work (Dekito's brief, 14 Nov 2026, P2-6).
-- Run ONCE in the Supabase SQL editor. Safe to run twice.
--
-- Three optional columns on storefront_products, filled in Studio (Produk → edit):
--   batch_label         e.g. 'Batch 03'           shown beside the stock line: "Batch 03 · 40 botol"
--   batch_size          e.g. 40                   the number of bottles in that batch
--   process_image_urls  up to four photo URLs     a small gallery on the product page
-- Empty means nothing is shown. The About page's process photos live in Pengaturan toko (no SQL needed).
--
-- The public view is recreated with the SAME definition. Postgres fixes a view's `*` to the columns that
-- existed when it was created, so without this the shop would never see the new columns (the bug fixed once
-- already, in 20261025150000_buyer_quotes_and_the_view_that_forgot.sql).
--
-- Before this runs, Studio still saves products normally: the app only sends these columns once it has read
-- them back from the database, or when one is filled in.

begin;

alter table public.storefront_products
    add column if not exists batch_label text,
    add column if not exists batch_size integer check (batch_size is null or (batch_size > 0 and batch_size < 100000)),
    add column if not exists process_image_urls jsonb not null default '[]'::jsonb;

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

commit;

-- VERIFY
--   select column_name from information_schema.columns
--    where table_name = 'storefront_products_public' and column_name in ('batch_label', 'batch_size', 'process_image_urls');
--   -> three rows.
--
-- UNDO (the view first, then the columns)
--   alter table public.storefront_products drop column if exists process_image_urls, drop column if exists batch_size,
--     drop column if exists batch_label;   -- then re-run the view statement above
