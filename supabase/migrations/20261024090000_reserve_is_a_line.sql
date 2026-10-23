-- Solivagant Reserve: a LINE, not a price tier.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor. Deploying the app does not apply it.
--
-- The October 2026 brief used the word "Reserve" as if it were a price tier for Aquilaria tuberosa and
-- Maskumambang. It is not. Dekito, 23 Oct 2026: "Reserve itu nama lini baru" — and in his own caption,
-- "jalan kecil yang aku buka buat bahan-bahan alami yang langka". The first release is Ambar Segara, an
-- ambergris attar with tobacco, jasmine sambac, leather and Kupang sandalwood.
--
-- It is kept out of `category` for exactly the reason `limited` was taken out of it (see
-- 20260920160500): the category seat feeds the filter pills and has to answer "what does this smell
-- like". A line name is not a smell, and a Reserve bottle still has a family of its own.
--
-- UNLIKE `limited`, THIS MIGRATION FLAGS NOTHING. There was no legacy category to inherit from, and
-- Ambar Segara is not in the catalogue yet, so every row stays false and NOTHING CHANGES ON SCREEN:
-- the badge appears on no card, and the RESERVE pill stays absent because the pill is kept alive by the
-- badge. The column simply waits for the first tick of "Lini RESERVE" in Studio.
--
-- Which perfumes belong to the line is Dekito's call, made in Studio, one at a time. This file does not
-- guess, the same way 20260920160500 refused to guess scent families.

alter table public.storefront_products
    add column if not exists reserve boolean not null default false;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- -- 1. The column exists and nothing was flagged:
-- select count(*) filter (where reserve) as di_lini_reserve, count(*) as total
--   from public.storefront_products;
--     -> di_lini_reserve 0, total unchanged
--
-- -- 2. After ticking "Lini RESERVE" on a product in Studio, it reads back:
-- select name, category, limited, reserve from public.storefront_products where reserve order by name;
--     -> the badge survives whatever family the perfume is filed under
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- alter table public.storefront_products drop column if exists reserve;
