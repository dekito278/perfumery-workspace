-- Clear compare-at prices that are not comparisons.
--
-- MANUAL APPLY. Data only — no schema change.
--
-- Two live products carry a struck-through price BELOW what is being charged:
--   lintang-asmoro     30 ml   price Rp329.000   compare-at Rp5
--   patchouli-so-sexy  30 ml   price Rp297.000   compare-at Rp10
-- (measured against storefront_products_public on 2026-09-14; they are the only two, and there are no
--  legitimate compare-at values anywhere in the catalogue.)
--
-- NOBODY HAS EVER SEEN THESE. PriceNote renders a compare-at only when it is above the price, so the
-- storefront has always ignored them. This is hygiene, not a visible bug: the risk is a future reader
-- taking the field at face value.
--
-- The code change shipping with this stops them coming back — both product forms now say, inline, that a
-- compare-at below the price will not display. That is the actual fix; this is the leftover.
--
-- Order matters: variants is a jsonb ARRAY and its order is the order of sizes shown to buyers, so the
-- rebuild below preserves it with ordinality rather than letting jsonb_agg pick.

update public.storefront_products p
   set variants = (
         select jsonb_agg(
                  case
                    when jsonb_typeof(v -> 'compareAtPriceNumber') = 'number'
                     and (v ->> 'compareAtPriceNumber')::numeric > 0
                     and (v ->> 'compareAtPriceNumber')::numeric
                         <= coalesce(nullif(v ->> 'priceNumber', '')::numeric, 0)
                    then v || '{"compareAtPriceNumber": 0}'::jsonb
                    else v
                  end
                  order by ord)
           from jsonb_array_elements(p.variants) with ordinality as t(v, ord)
       )
 where exists (
         select 1
           from jsonb_array_elements(p.variants) as e(v)
          where jsonb_typeof(e.v -> 'compareAtPriceNumber') = 'number'
            and (e.v ->> 'compareAtPriceNumber')::numeric > 0
            and (e.v ->> 'compareAtPriceNumber')::numeric
                <= coalesce(nullif(e.v ->> 'priceNumber', '')::numeric, 0)
       );

-- ============================================================================
-- VERIFY — expect zero rows.
-- ============================================================================
-- select p.slug, e.v ->> 'size' as size, e.v ->> 'priceNumber' as price,
--        e.v ->> 'compareAtPriceNumber' as compare_at
--   from public.storefront_products p,
--        jsonb_array_elements(p.variants) as e(v)
--  where jsonb_typeof(e.v -> 'compareAtPriceNumber') = 'number'
--    and (e.v ->> 'compareAtPriceNumber')::numeric > 0
--    and (e.v ->> 'compareAtPriceNumber')::numeric
--        <= coalesce(nullif(e.v ->> 'priceNumber', '')::numeric, 0);
--
-- -- And confirm no variant went missing in the rebuild:
-- select slug, jsonb_array_length(variants) from public.storefront_products order by slug;

-- ============================================================================
-- ROLLBACK — the two values, written back literally. They were Rp5 and Rp10 and
-- meant nothing, so this exists for completeness rather than for use.
-- ============================================================================
-- update public.storefront_products p
--    set variants = (
--          select jsonb_agg(
--                   case when v ->> 'size' = '30 ml'
--                        then v || jsonb_build_object('compareAtPriceNumber',
--                               case p.slug when 'lintang-asmoro' then 5 else 10 end)
--                        else v end
--                   order by ord)
--            from jsonb_array_elements(p.variants) with ordinality as t(v, ord))
--  where p.slug in ('lintang-asmoro', 'patchouli-so-sexy');
