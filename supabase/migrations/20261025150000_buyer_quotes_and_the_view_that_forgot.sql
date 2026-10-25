-- Buyer quotes on the product page, and the public view that has been one column behind since 24 Oct.
--
-- TWO THINGS, one migration, because the second is what makes the first reach a buyer at all.
--
-- 1. storefront_products.testimonials — quotes Dekito pastes himself from WhatsApp and Instagram.
--
--    Decided on 25 Oct against this shop's own numbers rather than against what a bigger shop would do:
--    35 orders ever, 24 of them paid, and the best-selling perfume has FOUR buyers. A review system with
--    a form, a login, star averages and a moderation queue would, at full participation, put 4 reviews on
--    the best product page and 0 or 1 on most of them. "Ulasan (0)" on 14 of 18 product pages is not
--    neutral — it announces that nobody has bought. Four samples also cannot be averaged into a star
--    rating honestly, and Google's rich snippets want genuine first-party reviews, not a thin one.
--
--    So: no stars, no login, no moderation queue, no new table. One jsonb column holding an ARRAY of
--    {quote, name, city}, shown only when it has something in it. The shop stays silent where it has
--    nothing to say, which is the only honest default when the real number is four.
--
--    Nothing is seeded here. Inventing a customer quote would be fabricating a review, which is not a
--    thing to do at any scale, so the column ships EMPTY and Dekito fills it with words people really
--    sent him.
--
-- 2. storefront_products_public is recreated — and that is a BUG FIX, not housekeeping.
--
--    The view is built with jsonb_populate_record(null::storefront_products, ...).*, so its column list
--    was frozen when it was created. 20261024090000_reserve_is_a_line.sql added `reserve` to the TABLE
--    and never recreated the view, so the storefront has been reading 33 columns of a 34-column table:
--
--      storefront_products        34 columns
--      storefront_products_public 33 columns, missing `reserve`
--
--    productBadge.js reads product.reserve, and the storefront reads the view, so isReserveProduct() has
--    been returning false no matter what Studio saved. Nothing is flagged reserve yet (0 rows), so no
--    badge is missing today — it simply would never have appeared. The view migration's own comment
--    warned about exactly this ("New table columns need this view recreated to show up") and the reserve
--    migration went past it anyway. Writing the warning down did not make anyone read it.
--
--    create or replace is safe here because both missing columns are at the END of the table's column
--    order (both arrived by ALTER TABLE ADD COLUMN, reserve then testimonials), and Postgres allows a
--    replaced view to gain columns only at the end. If it ever refuses, nothing changes — read the error
--    rather than forcing it.

alter table public.storefront_products
    add column if not exists testimonials jsonb not null default '[]'::jsonb;

comment on column public.storefront_products.testimonials is
    'Buyer quotes pasted by the owner: array of {quote, name, city}. Not reviews — no stars, no login, no '
    'moderation. Shown on the product page only when non-empty. Never seeded or generated.';

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

-- Verify (service role), after running this:
--   the view must now have the SAME number of columns as the table, and both names must be present.
--   select count(*) from information_schema.columns where table_name = 'storefront_products';
--   select count(*) from information_schema.columns where table_name = 'storefront_products_public';
--   → the two counts must be equal (35 and 35).
--   select column_name from information_schema.columns
--    where table_name = 'storefront_products_public' and column_name in ('reserve','testimonials');
--   → must return both rows.
