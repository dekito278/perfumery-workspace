-- "Limited" was occupying the scent-family seat.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor. Deploying the app does not apply it.
--
-- storefront_products.category does two jobs at once. The catalogue card prints it as the label, and the
-- filter pills are built from it — so it has to answer "what does this smell like". Ten of nineteen
-- products answer "Limited" instead, which is how RARE something is.
--
-- Measured on the live shop: filtering FLORAL returns 4 perfumes. Maskumambang, whose own notes read
-- "White floral, olibanum, musk", is not among them — the most expensive floral in the shop is invisible
-- to a buyer looking for florals. The same holds for Aquilaria tuberosa (Tuberose, oud Malinau).
--
-- This column separates the two questions. The badge keeps saying LIMITED; the category is freed to say
-- what the perfume smells of.
--
-- IT ASSIGNS NO FAMILIES. The repo already has a keyword rule that guesses one, and running it over
-- these ten products shows why it must not be trusted here: Maskumambang, Aquilaria tuberosa and Sudra
-- land correctly, J'adore La Vetiver (Vetiver, fresh earthy) lands in Aquatic because "fresh" is tested
-- before "woody", and four more — Animal Farm, HUG N°1, Jason Voorhees, Lintang Asmoro — match nothing
-- and fall through to a default "Woody" they never earned. Swapping one wrong label for another is not
-- a fix. Which family each perfume belongs to is the perfumer's call, made in Studio, one at a time.
--
-- Until then nothing changes on screen: category stays 'Limited' for those ten, the pill still finds
-- them, and the badge now comes from this column instead.

alter table public.storefront_products
    add column if not exists limited boolean not null default false;

update public.storefront_products
   set limited = true
 where lower(trim(coalesce(category, ''))) = 'limited';

-- ============================================================================
-- VERIFY
-- ============================================================================
-- -- 1. The ten keep their badge, now as data rather than as a category:
-- select count(*) filter (where limited) as berbadge,
--        count(*) filter (where lower(trim(coalesce(category,''))) = 'limited') as masih_kategori
--   from public.storefront_products;
--     -> berbadge 10, masih_kategori 10  (both drop as you re-file each product)
--
-- -- 2. Nothing else was touched:
-- select category, count(*) from public.storefront_products group by category order by 2 desc;
--     -> Limited 10, Floral 4, Gourmand 2, Woody 2, Fresh 1
--
-- -- 3. After re-filing one in Studio, the badge survives the category change:
-- select name, category, limited from public.storefront_products where limited order by name;
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- alter table public.storefront_products drop column if exists limited;
