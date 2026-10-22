-- Maskumambang: 950.000 -> 999.000, member 855.000 -> 899.000.
--
-- ALREADY APPLIED to production on 2026-10-22; this file exists so a database built from the migration
-- history alone ends up at the same numbers.
--
-- Dekito confirmed the last of the (?) marks in the October brief on 2026-10-22. Only this one price
-- moved; everything else in the confirmed table already matched what 20261021090000 scheduled.
--
-- That file's insert was edited to 999.000/899.000 in the same commit, so a FRESH database inserts the
-- right number on the first pass and this update is a no-op. A database that already ran the original
-- (production) gets the correction here. The guard reads the intended end state out of that file, which
-- is why both had to move together.
--
-- effective_at is deliberately untouched: 12 Nov 2026 00:00 WIB, the first minute after 11.11.

update public.storefront_price_schedule s
   set price_number = case s.tier when 'retail' then 999000 else 899000 end
  from public.storefront_products p
 where p.id = s.product_id
   and p.slug = 'maskumambang'
   and s.tier in ('retail', 'member');

-- Verify: 999000 retail / 899000 member, both at 2026-11-11 17:00+00 (= 12 Nov 00:00 WIB).
select p.slug, s.tier, s.price_number, s.effective_at
  from public.storefront_price_schedule s
  join public.storefront_products p on p.id = s.product_id
 where p.slug = 'maskumambang'
 order by s.tier;
