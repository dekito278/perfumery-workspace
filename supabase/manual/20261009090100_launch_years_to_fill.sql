-- The launch years, for Dekito to fill in.
--
-- One line per fragrance. Replace each NULL with the year that perfume was released to buyers, then
-- run the file. Leave a line as NULL if the year is genuinely not known: the product page simply does
-- not show a year for it, which is honest, and Fragrantica can be told unknown rather than a guess.
--
-- The right-hand comment is when the ROW was created in this app. It is there as a HINT about which
-- product is which, and it is NOT the launch year — it is years later for the older compositions.
-- Nothing in the app derives a year from it, and nothing should.
--
-- Needs supabase/migrations/20261009090000_products_carry_a_launch_year.sql to have run first.
-- Safe to run twice.

begin;

update public.storefront_products set launch_year = NULL where slug = 'wayback';                           -- .Wayback (baris dibuat 2026-08-24)
update public.storefront_products set launch_year = NULL where slug = 'animal-farm';                       -- Animal Farm (baris dibuat 2026-05-19)
update public.storefront_products set launch_year = NULL where slug = 'aquilaria-tuberosa';                -- Aquilaria tuberosa (baris dibuat 2026-05-19)
update public.storefront_products set launch_year = NULL where slug = 'ayang-ayang';                       -- Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀) (baris dibuat 2026-05-12)
update public.storefront_products set launch_year = NULL where slug = 'hug-n-1';                           -- HUG N°1 (baris dibuat 2026-05-19)
update public.storefront_products set launch_year = NULL where slug = 'soli-extended-j-adore-la-vanille';  -- J’adore la Vanille (baris dibuat 2026-05-07)
update public.storefront_products set launch_year = NULL where slug = 'j-adore-la-vetiver';                -- J’adore La Vetiver (baris dibuat 2026-05-12)
update public.storefront_products set launch_year = NULL where slug = 'jason-voorhees';                    -- Jason Voorhees (baris dibuat 2026-05-19)
update public.storefront_products set launch_year = NULL where slug = 'jata-bhumi';                        -- Jata Bhumi (baris dibuat 2026-05-12)
update public.storefront_products set launch_year = NULL where slug = 'l-iris';                            -- L’iris (baris dibuat 2026-09-20)
update public.storefront_products set launch_year = NULL where slug = 'la-rose';                           -- La Rose (baris dibuat 2026-08-24)
update public.storefront_products set launch_year = NULL where slug = 'la-tulipe';                         -- La Tulipe (baris dibuat 2026-08-24)
update public.storefront_products set launch_year = NULL where slug = 'lintang-asmoro';                    -- Lintang Asmoro (baris dibuat 2026-05-10)
update public.storefront_products set launch_year = NULL where slug = 'maskumambang';                      -- Maskumambang (baris dibuat 2026-08-24)
update public.storefront_products set launch_year = NULL where slug = 'pantura';                           -- Pantura (baris dibuat 2026-05-12)
update public.storefront_products set launch_year = NULL where slug = 'patchouli-so-sexy';                 -- Patchouli so sexy (baris dibuat 2026-07-28)
update public.storefront_products set launch_year = NULL where slug = 'sudra';                             -- Sudra (baris dibuat 2026-05-19)
update public.storefront_products set launch_year = NULL where slug = 'vanille-planifolia';                -- Vanille Planifolia (baris dibuat 2026-05-10)
update public.storefront_products set launch_year = NULL where slug = 'wongka';                            -- Wongka! (baris dibuat 2026-05-19)

commit;

-- Check:
-- select name, launch_year from public.storefront_products_public order by launch_year nulls last, name;
