-- Apply the scheduled prices for real, then throw the schedule away.
--
-- RUN THIS ANY TIME AFTER 12 NOVEMBER 2026, 00:00 WIB. Running it earlier does nothing: every statement
-- is filtered on `effective_at <= now()`, so a schedule that has not arrived is left alone. Running it
-- twice does nothing either — the second pass finds no rows.
--
-- WHY IT EXISTS. storefront_prices_for_me picks the winner with
--
--     order by f.product_id, f.variant_id, f.tier, f.effective_at desc nulls last
--
-- read from the LIVE function on 2026-10-23, not from the migration that created it. A scheduled row
-- carries a date and the base row carries null, so once the date passes the scheduled row wins — and
-- keeps winning, for ever. That is correct on 12 November and wrong on 13 November, because from then
-- on Dekito can edit a price in Studio, see it saved, and watch the shop keep charging the old
-- scheduled number with nothing on screen to explain why. The price fields would quietly become
-- decorative for all nineteen products.
--
-- Dekito chose, 2026-10-23: the schedule is ONE-SHOT. It moves the price into the place Studio writes,
-- and then stops existing.
--
-- ALL 38 ROWS BELONG TO SINGLE-VARIANT PRODUCTS and name that variant by id (verified 2026-10-23), but
-- nothing here relies on that: variants are matched by id, never by position, so a product that grows a
-- second bottle later is still updated in the right place.

-- 1. Retail lives on the product itself — inside the variants jsonb, and in price_number when the
--    scheduled variant is the one the catalogue leads with.
with due as (
    select s.product_id, s.variant_id, s.price_number
      from public.storefront_price_schedule s
     where s.tier = 'retail'
       and s.effective_at <= now()
)
update public.storefront_products p
   set variants = (
         select jsonb_agg(
                  case when elem->>'id' = d.variant_id
                       then jsonb_set(elem, '{priceNumber}', to_jsonb(d.price_number::int))
                       else elem
                  end
                  order by ord
                )
           from jsonb_array_elements(p.variants) with ordinality as e(elem, ord)
       ),
       price_number = case when p.variants->0->>'id' = d.variant_id
                           then d.price_number::int
                           else p.price_number
                      end,
       updated_at = now()
  from due d
 where d.product_id = p.id;

-- 2. Every other tier lives in storefront_product_prices. Its CHECK forbids 'retail', which is why that
--    one went to the product above and why this statement must exclude it rather than filter by name.
insert into public.storefront_product_prices (product_id, variant_id, tier, price_number)
select s.product_id, s.variant_id, s.tier, s.price_number
  from public.storefront_price_schedule s
 where s.tier <> 'retail'
   and s.effective_at <= now()
on conflict (product_id, variant_id, tier)
do update set price_number = excluded.price_number;

-- 3. Gone. From here the only prices are the ones Studio writes, which is the whole point.
delete from public.storefront_price_schedule
 where effective_at <= now();

-- Verify. Expect: 0 scheduled rows left, and the nineteen retail prices reading 479.000 / 569.000 /
-- 849.000 / 999.000 with their member prices beside them.
select (select count(*) from public.storefront_price_schedule) as jadwal_tersisa;

select p.slug,
       (p.variants->0->>'priceNumber')::int as retail,
       (select pr.price_number::int
          from public.storefront_product_prices pr
         where pr.product_id = p.id and pr.tier = 'member'
         limit 1) as member
  from public.storefront_products p
 where p.slug in ('jason-voorhees', 'maskumambang', 'aquilaria-tuberosa', 'l-iris')
 order by p.slug;

-- Rollback: there is none that a script can give you — the old prices are gone from the schedule once
-- this runs. If a number comes out wrong, set it in Studio; Studio is in charge again from here.
