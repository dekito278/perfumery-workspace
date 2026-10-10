-- Tahun rilis per parfum — DIKOSONGKAN DULU.
--
-- Dekito, 11 Oktober 2026: "kok rilis parfum saya 2023 semua. Gak gitu loh maksud saya brand yg
-- berdiri sejak 2023. Kalo variannya mah beda2."
--
-- Jadi saya salah membaca jawabannya pada 9 Oktober ("Rilis dari 2023"). Itu tentang BRAND-nya, bukan
-- tentang kesembilan belas parfumnya. Berkas 20261009090100_launch_years_to_fill.sql menulis 2023 ke
-- semuanya dan sudah dijalankan, jadi 19 halaman produk memasang "RILIS 2023" — salah untuk hampir
-- semuanya, dan tahun yang salah di Fragrantica itu permanen.
--
-- Tahun berdirinya brand (2023) TIDAK ikut dikosongkan: itu di src/data/brandProfile.js dan tampil di
-- halaman About. Dua fakta yang berbeda, dan sekarang disimpan di dua tempat yang berbeda.
--
-- BAGIAN 1 mengosongkan semuanya. Jalankan apa adanya — setelah itu halaman produk tidak memasang
-- tahun apa pun, yang jujur.
--
-- BAGIAN 2 adalah formulir isian per parfum. Buka komentarnya untuk baris yang tahunnya Anda tahu,
-- ganti NULL dengan tahunnya, lalu jalankan lagi. Baris yang dibiarkan NULL tidak menampilkan apa pun.
-- Tidak perlu sekaligus; bisa dicicil.
--
-- Komentar di kanan adalah kapan BARIS-nya dibuat di aplikasi ini. Itu PETUNJUK mana produk yang mana,
-- BUKAN tahun rilis: rentangnya 2026-05 sampai 2026-09, bertahun-tahun setelah komposisi yang lama.
--
-- Bisa dijalankan berulang kali dengan aman.

-- ============================ BAGIAN 1: kosongkan tahun yang keliru ============================

begin;

update public.storefront_products set launch_year = null
where slug in (
  'wayback',
  'animal-farm',
  'aquilaria-tuberosa',
  'ayang-ayang',
  'hug-n-1',
  'soli-extended-j-adore-la-vanille',
  'j-adore-la-vetiver',
  'jason-voorhees',
  'jata-bhumi',
  'l-iris',
  'la-rose',
  'la-tulipe',
  'lintang-asmoro',
  'maskumambang',
  'pantura',
  'patchouli-so-sexy',
  'sudra',
  'vanille-planifolia',
  'wongka'
);

commit;

-- ======================= BAGIAN 2: isi yang Anda tahu, buka komentarnya =======================
--
-- begin;
--
-- update public.storefront_products set launch_year = NULL where slug = 'wayback';                 -- .Wayback (baris dibuat 2026-08-24)
-- update public.storefront_products set launch_year = NULL where slug = 'animal-farm';             -- Animal Farm (baris dibuat 2026-05-19)
-- update public.storefront_products set launch_year = NULL where slug = 'aquilaria-tuberosa';      -- Aquilaria tuberosa (baris dibuat 2026-05-19)
-- update public.storefront_products set launch_year = NULL where slug = 'ayang-ayang';             -- Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀) (baris dibuat 2026-05-12)
-- update public.storefront_products set launch_year = NULL where slug = 'hug-n-1';                 -- HUG N°1 (baris dibuat 2026-05-19)
-- update public.storefront_products set launch_year = NULL where slug = 'soli-extended-j-adore-la-vanille'; -- J’adore la Vanille (baris dibuat 2026-05-07)
-- update public.storefront_products set launch_year = NULL where slug = 'j-adore-la-vetiver';      -- J’adore La Vetiver (baris dibuat 2026-05-12)
-- update public.storefront_products set launch_year = NULL where slug = 'jason-voorhees';          -- Jason Voorhees (baris dibuat 2026-05-19)
-- update public.storefront_products set launch_year = NULL where slug = 'jata-bhumi';              -- Jata Bhumi (baris dibuat 2026-05-12)
-- update public.storefront_products set launch_year = NULL where slug = 'l-iris';                  -- L’iris (baris dibuat 2026-09-20)
-- update public.storefront_products set launch_year = NULL where slug = 'la-rose';                 -- La Rose (baris dibuat 2026-08-24)
-- update public.storefront_products set launch_year = NULL where slug = 'la-tulipe';               -- La Tulipe (baris dibuat 2026-08-24)
-- update public.storefront_products set launch_year = NULL where slug = 'lintang-asmoro';          -- Lintang Asmoro (baris dibuat 2026-05-10)
-- update public.storefront_products set launch_year = NULL where slug = 'maskumambang';            -- Maskumambang (baris dibuat 2026-08-24)
-- update public.storefront_products set launch_year = NULL where slug = 'pantura';                 -- Pantura (baris dibuat 2026-05-12)
-- update public.storefront_products set launch_year = NULL where slug = 'patchouli-so-sexy';       -- Patchouli so sexy (baris dibuat 2026-07-28)
-- update public.storefront_products set launch_year = NULL where slug = 'sudra';                   -- Sudra (baris dibuat 2026-05-19)
-- update public.storefront_products set launch_year = NULL where slug = 'vanille-planifolia';      -- Vanille Planifolia (baris dibuat 2026-05-10)
-- update public.storefront_products set launch_year = NULL where slug = 'wongka';                  -- Wongka! (baris dibuat 2026-05-19)
--
-- commit;

