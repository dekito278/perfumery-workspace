-- Three new perfumes for the shop — Samhain, Bloody Luwak, Ambar Segara (Dekito's brief, 14 Nov 2026, P1-3).
-- Run ONCE in the Supabase SQL editor. Safe to run twice: existing slugs and price rows are left alone.
--
-- WHAT IS DECIDED (Dekito, 14 Nov 2026)
--   Samhain       30 ml   Rp479.000   member Rp429.000   US$80    stock 0  (not given yet)
--   Bloody Luwak  30 ml   Rp479.000   member Rp429.000   US$80    stock 5
--   Ambar Segara  30 ml   Rp2.980.000 member = same      US$180   stock 0  (not given yet) — Solivagant Reserve
--
-- WHAT IS DELIBERATELY EMPTY — Dekito fills these in Studio; nothing about the scent is invented here:
--   description / description_en, notes, the note pyramid, mood, launch year. The cover image is a plain
--   name card (SOLIVAGANT · name · line), served from the site at /brand/covers/<slug>.jpg. Replace it with
--   a bottle photo in Studio when there is one.
--
-- CHECK BEFORE RUNNING
--   * Ambar Segara's size is written as 30 ml. Change '30 ml' / '30-ml' below if the Reserve bottle differs.
--   * Ambar Segara's US$180: the shop treats an export price BELOW the rupiah price as a mistake and then shows
--     "Price on request" in the English shop. US$180 is Rp2.970.000 at the shop's rate (16.500), below
--     Rp2.980.000. Either keep it and ask for the rule to allow it for Reserve, or use US$185 (Rp3.052.500).
--
-- Member price: Samhain and Bloody Luwak carry a member row of Rp429.000. Ambar Segara carries none, and as a
-- Reserve bottle (reserve = true) a member code takes no percentage off it either (app + order server).

begin;

insert into public.storefront_products (
  slug, name, category, price_number, size, notes, concentration, stock, variants, tags, limited, reserve,
  featured, popularity, intensity, image_url, image_urls, source
)
select v.slug, v.name, v.category, v.price, '30 ml', '', 'Eau de Parfum', v.stock,
       jsonb_build_array(jsonb_build_object('id', '30-ml', 'size', '30 ml', 'stock', v.stock, 'priceNumber', v.price, 'compareAtPriceNumber', 0)),
       '[]'::jsonb, v.limited, v.reserve, false, 70, 'Medium',
       v.cover, jsonb_build_array(v.cover), 'custom'
from (values
  ('samhain',      'Samhain',      'Limited', 479000,  0, true,  false, 'https://www.solivagantscent.com/brand/covers/samhain.jpg'),
  ('bloody-luwak', 'Bloody Luwak', 'Limited', 479000,  5, true,  false, 'https://www.solivagantscent.com/brand/covers/bloody-luwak.jpg'),
  ('ambar-segara', 'Ambar Segara', 'Limited', 2980000, 0, false, true,  'https://www.solivagantscent.com/brand/covers/ambar-segara.jpg')
) as v(slug, name, category, price, stock, limited, reserve, cover)
where not exists (select 1 from public.storefront_products p where p.slug = v.slug);

-- Member and international prices, per variant (the shop keys every tier price by variant).
insert into public.storefront_product_prices (product_id, variant_id, tier, price_number)
select p.id, '30-ml', t.tier, t.price
from (values
  ('samhain',      'member',   429000),
  ('samhain',      'overseas', 1320000),   -- US$80  at 16.500
  ('bloody-luwak', 'member',   429000),
  ('bloody-luwak', 'overseas', 1320000),   -- US$80
  ('ambar-segara', 'overseas', 2970000)    -- US$180 — see "CHECK BEFORE RUNNING"
) as t(slug, tier, price)
join public.storefront_products p on p.slug = t.slug
on conflict (product_id, variant_id, tier) do nothing;

commit;

-- VERIFY
--   select slug, name, price_number, stock, reserve, image_urls from public.storefront_products
--    where slug in ('samhain', 'bloody-luwak', 'ambar-segara');
--   select p.slug, pp.tier, pp.price_number from public.storefront_product_prices pp
--     join public.storefront_products p on p.id = pp.product_id
--    where p.slug in ('samhain', 'bloody-luwak', 'ambar-segara') order by 1, 2;
--   -> 3 products; 5 price rows. The shop shows them at /catalog/samhain, /catalog/bloody-luwak, /catalog/ambar-segara.
--
-- UNDO
--   delete from public.storefront_products where slug in ('samhain', 'bloody-luwak', 'ambar-segara');
--   (price rows go with them: product_id cascades)
