-- The launch years.
--
-- Dekito, 9 Oct 2026, asked what year to use: "Rilis dari 2023". So every line below says 2023 — his
-- answer, applied to all nineteen, and not a year anybody read off a timestamp.
--
-- CHANGE THE ONES THAT ARE LATER before running this. "Releasing since 2023" says when the house
-- started, and some of these nineteen will have come out in 2024, 2025 or 2026; this file cannot know
-- which. A year that is wrong here is wrong in Fragrantica permanently, and the only person who can
-- tell them apart is reading this line.
--
-- A line set back to NULL means the product page shows no year at all, which is honest and is what
-- Fragrantica should be told rather than a guess.
--
-- The right-hand comment is when the ROW was created in this app. It is a HINT about which product is
-- which and it is NOT the launch year: it runs 2026-05 to 2026-09, years after the older compositions.
--
-- Needs supabase/migrations/20261009090000_products_carry_a_launch_year.sql to have run first.
-- Safe to run twice.

begin;

update public.storefront_products set launch_year = 2023 where slug = 'wayback';                           -- .Wayback (baris dibuat 2026-08-24)
update public.storefront_products set launch_year = 2023 where slug = 'animal-farm';                       -- Animal Farm (baris dibuat 2026-05-19)
update public.storefront_products set launch_year = 2023 where slug = 'aquilaria-tuberosa';                -- Aquilaria tuberosa (baris dibuat 2026-05-19)
update public.storefront_products set launch_year = 2023 where slug = 'ayang-ayang';                       -- Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀) (baris dibuat 2026-05-12)
update public.storefront_products set launch_year = 2023 where slug = 'hug-n-1';                           -- HUG N°1 (baris dibuat 2026-05-19)
update public.storefront_products set launch_year = 2023 where slug = 'soli-extended-j-adore-la-vanille';  -- J’adore la Vanille (baris dibuat 2026-05-07)
update public.storefront_products set launch_year = 2023 where slug = 'j-adore-la-vetiver';                -- J’adore La Vetiver (baris dibuat 2026-05-12)
update public.storefront_products set launch_year = 2023 where slug = 'jason-voorhees';                    -- Jason Voorhees (baris dibuat 2026-05-19)
update public.storefront_products set launch_year = 2023 where slug = 'jata-bhumi';                        -- Jata Bhumi (baris dibuat 2026-05-12)
update public.storefront_products set launch_year = 2023 where slug = 'l-iris';                            -- L’iris (baris dibuat 2026-09-20)
update public.storefront_products set launch_year = 2023 where slug = 'la-rose';                           -- La Rose (baris dibuat 2026-08-24)
update public.storefront_products set launch_year = 2023 where slug = 'la-tulipe';                         -- La Tulipe (baris dibuat 2026-08-24)
update public.storefront_products set launch_year = 2023 where slug = 'lintang-asmoro';                    -- Lintang Asmoro (baris dibuat 2026-05-10)
update public.storefront_products set launch_year = 2023 where slug = 'maskumambang';                      -- Maskumambang (baris dibuat 2026-08-24)
update public.storefront_products set launch_year = 2023 where slug = 'pantura';                           -- Pantura (baris dibuat 2026-05-12)
update public.storefront_products set launch_year = 2023 where slug = 'patchouli-so-sexy';                 -- Patchouli so sexy (baris dibuat 2026-07-28)
update public.storefront_products set launch_year = 2023 where slug = 'sudra';                             -- Sudra (baris dibuat 2026-05-19)
update public.storefront_products set launch_year = 2023 where slug = 'vanille-planifolia';                -- Vanille Planifolia (baris dibuat 2026-05-10)
update public.storefront_products set launch_year = 2023 where slug = 'wongka';                            -- Wongka! (baris dibuat 2026-05-19)

commit;

-- Check:
-- select name, launch_year from public.storefront_products_public order by launch_year nulls last, name;
