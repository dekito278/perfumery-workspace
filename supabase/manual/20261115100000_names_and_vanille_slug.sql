-- Product names in Dekito's spelling, and J'adore la Vanille's own address (Dekito's brief, 14 Nov 2026, P1-5).
-- Run ONCE in the Supabase SQL editor, after the site update that carries the redirect has been merged.
--
-- 1. The French series writes its second word small: La rose, La tulipe, L'iris (already right), and
--    J'adore la Vetiver beside J'adore la Vanille. The free vial lists each aroma under the perfume's name,
--    and the shop matches "already bought" by that name, so the vial's labels move with the products.
--    The vial variants' IDs stay as they are: they are what carts and old orders hold.
-- 2. J'adore la Vanille moves from soli-extended-j-adore-la-vanille to j-adore-la-vanille. Its prices,
--    schedule and stock hang off the product id, not the slug, so they follow on their own; other perfumes'
--    "related" lists name it by slug and are updated here. The old address answers with a 301 to the new one
--    (apps/web/vercel.json), in both shops. Old orders keep the slug they were placed under.
--
-- The apostrophe in these names is the typographic one (’), as the catalogue already writes it.

begin;

update public.storefront_products set name = 'La rose'            where slug = 'la-rose'            and name = 'La Rose';
update public.storefront_products set name = 'La tulipe'          where slug = 'la-tulipe'          and name = 'La Tulipe';
update public.storefront_products set name = 'J’adore la Vetiver' where slug = 'j-adore-la-vetiver' and name = 'J’adore La Vetiver';

-- The free vial's aroma labels, by variant id.
update public.storefront_products p
   set variants = (
     select jsonb_agg(
              case v->>'id'
                when 'la-rose'            then jsonb_set(v, '{size}', to_jsonb('La rose'::text))
                when 'la-tulipe'          then jsonb_set(v, '{size}', to_jsonb('La tulipe'::text))
                when 'j-adore-la-vetiver' then jsonb_set(v, '{size}', to_jsonb('J’adore la Vetiver'::text))
                else v
              end
              order by ord)
       from jsonb_array_elements(p.variants) with ordinality as e(v, ord)
   )
 where p.slug = 'vial-hadiah';

-- The address.
update public.storefront_products
   set slug = 'j-adore-la-vanille'
 where slug = 'soli-extended-j-adore-la-vanille'
   and not exists (select 1 from public.storefront_products where slug = 'j-adore-la-vanille');

update public.storefront_products
   set related_slugs = (
     select jsonb_agg(case when s = 'soli-extended-j-adore-la-vanille' then to_jsonb('j-adore-la-vanille'::text) else to_jsonb(s) end)
       from jsonb_array_elements_text(related_slugs) as s
   )
 where related_slugs ? 'soli-extended-j-adore-la-vanille';

commit;

-- VERIFY
--   select slug, name from public.storefront_products
--    where slug in ('la-rose', 'la-tulipe', 'j-adore-la-vetiver', 'j-adore-la-vanille', 'soli-extended-j-adore-la-vanille');
--   -> La rose · La tulipe · J’adore la Vetiver · j-adore-la-vanille present, the soli-extended slug gone.
--   select v->>'id', v->>'size' from public.storefront_products, jsonb_array_elements(variants) v where slug = 'vial-hadiah';
--
-- AFTER: the prerendered product pages and the sitemap are written at build time, so the new address gets its
-- own page on the next deploy of the site.
--
-- UNDO
--   update public.storefront_products set slug = 'soli-extended-j-adore-la-vanille' where slug = 'j-adore-la-vanille';
--   update public.storefront_products set name = 'La Rose' where slug = 'la-rose';
--   update public.storefront_products set name = 'La Tulipe' where slug = 'la-tulipe';
--   update public.storefront_products set name = 'J’adore La Vetiver' where slug = 'j-adore-la-vetiver';
--   (and the vial labels the same way)
