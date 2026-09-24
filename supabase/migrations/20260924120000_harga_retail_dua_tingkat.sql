-- Harga retail dua tingkat: Signature Rp 359.000, Elevated Rp 429.000
--
-- KENAPA. HPP per botol 30 ml Rp 135.000 (sudah termasuk packaging). 17 dari 19 parfum dijual di
-- 2,07x-2,56x HPP; yang termurah, Rp 279.000, cuma 2,07x. Setelah diskon member 10% dan promo ongkir
-- gratis Rp 25.000, sisa marginnya 36%. Rp 359.000 adalah angka terendah yang masih menyisakan 50%
-- setelah dua potongan yang sama.
--
-- Delapan titik harga antara Rp 279.000 dan Rp 345.000 dirapatkan jadi dua. Aquilaria tuberosa
-- (Rp 649.000) dan Maskumambang (Rp 750.000) tidak disentuh — keduanya sudah di 4,81x dan 5,56x.
--
-- TIGA TABEL, BUKAN SATU. Menaikkan retail saja akan merusak dua harga lain yang disimpan sebagai
-- angka mati, bukan rumus:
--   * harga member: kalau dibiarkan, Rp 260.100 di atas retail Rp 359.000 bukan lagi potongan 10%,
--     melainkan 27%.
--   * harga internasional 'overseas': kalau dibiarkan, kelipatannya turun dari 3,5x jadi 2,8x.
-- Harga Asia Tenggara tidak ada di sini karena memang dihitung (retail x 2,2), bukan disimpan.
--
-- Angka member dan overseas memakai pembulatan yang sama persis dengan tombol isi massal di layar
-- Kurasi Katalog (memberPriceFill.js): member dibulatkan TURUN ke ribuan terdekat, overseas
-- dibulatkan NAIK ke puluhan-ribu terdekat. Jadi menjalankan SQL ini dan menekan tombol itu
-- menghasilkan angka yang sama.
--
-- YANG DIUBAH:
--   HUG N°1                        Rp 279.000 ->   Rp 359.000   member   Rp 323.000   dunia  Rp 1.260.000
--   J’adore La Vetiver             Rp 279.000 ->   Rp 359.000   member   Rp 323.000   dunia  Rp 1.260.000
--   Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀)    Rp 289.000 ->   Rp 359.000   member   Rp 323.000   dunia  Rp 1.260.000
--   J’adore la Vanille             Rp 289.000 ->   Rp 359.000   member   Rp 323.000   dunia  Rp 1.260.000
--   Jata Bhumi                     Rp 289.000 ->   Rp 359.000   member   Rp 323.000   dunia  Rp 1.260.000
--   La Tulipe                      Rp 289.000 ->   Rp 359.000   member   Rp 323.000   dunia  Rp 1.260.000
--   Vanille Planifolia             Rp 289.000 ->   Rp 359.000   member   Rp 323.000   dunia  Rp 1.260.000
--   Animal Farm                    Rp 297.000 ->   Rp 359.000   member   Rp 323.000   dunia  Rp 1.260.000
--   Jason Voorhees                 Rp 297.000 ->   Rp 359.000   member   Rp 323.000   dunia  Rp 1.260.000
--   Patchouli so sexy              Rp 297.000 ->   Rp 359.000   member   Rp 323.000   dunia  Rp 1.260.000
--   L’iris                         Rp 310.000 ->   Rp 429.000   member   Rp 386.000   dunia  Rp 1.510.000
--   La Rose                        Rp 310.000 ->   Rp 429.000   member   Rp 386.000   dunia  Rp 1.510.000
--   Wongka!                        Rp 319.000 ->   Rp 429.000   member   Rp 386.000   dunia  Rp 1.510.000
--   Lintang Asmoro                 Rp 329.000 ->   Rp 429.000   member   Rp 386.000   dunia  Rp 1.510.000
--   Pantura                        Rp 339.000 ->   Rp 429.000   member   Rp 386.000   dunia  Rp 1.510.000
--   Sudra                          Rp 339.000 ->   Rp 429.000   member   Rp 386.000   dunia  Rp 1.510.000
--   .Wayback                       Rp 345.000 ->   Rp 429.000   member   Rp 386.000   dunia  Rp 1.510.000
--
-- Dijalankan oleh Dekito. Bukan oleh agen.

BEGIN;

CREATE TEMP TABLE harga_baru (
  slug          text PRIMARY KEY,
  variant_id    text NOT NULL,
  harga_lama    integer NOT NULL,
  harga_baru    integer NOT NULL,
  harga_member  integer NOT NULL,
  harga_dunia   integer NOT NULL
) ON COMMIT DROP;

INSERT INTO harga_baru (slug, variant_id, harga_lama, harga_baru, harga_member, harga_dunia) VALUES
  ('hug-n-1', '30-ml', 279000, 359000, 323000, 1260000),
  ('j-adore-la-vetiver', '30-ml', 279000, 359000, 323000, 1260000),
  ('ayang-ayang', '30-ml', 289000, 359000, 323000, 1260000),
  ('soli-extended-j-adore-la-vanille', '30-ml', 289000, 359000, 323000, 1260000),
  ('jata-bhumi', '10-ml', 289000, 359000, 323000, 1260000),
  ('la-tulipe', '30-ml', 289000, 359000, 323000, 1260000),
  ('vanille-planifolia', '10-ml', 289000, 359000, 323000, 1260000),
  ('animal-farm', 'variant-1779213046244', 297000, 359000, 323000, 1260000),
  ('jason-voorhees', '30-ml', 297000, 359000, 323000, 1260000),
  ('patchouli-so-sexy', '30-ml', 297000, 359000, 323000, 1260000),
  ('l-iris', '30-ml', 310000, 429000, 386000, 1510000),
  ('la-rose', '30-ml', 310000, 429000, 386000, 1510000),
  ('wongka', '30-ml', 319000, 429000, 386000, 1510000),
  ('lintang-asmoro', '30-ml', 329000, 429000, 386000, 1510000),
  ('pantura', '30-ml', 339000, 429000, 386000, 1510000),
  ('sudra', '30-ml', 339000, 429000, 386000, 1510000),
  ('wayback', '30-ml', 345000, 429000, 386000, 1510000);

-- Berhenti kalau katalognya sudah bergerak sejak daftar ini dibuat: harga lama harus masih persis sama,
-- dan tiap produk harus masih punya tepat satu varian. Menimpa harga yang sudah diubah orang lain, atau
-- menyamaratakan harga beberapa ukuran jadi satu angka, adalah dua cara merusak yang tidak kelihatan.
DO $$
DECLARE
  tidak_cocok integer;
BEGIN
  SELECT count(*) INTO tidak_cocok
  FROM harga_baru h
  LEFT JOIN storefront_products p ON p.slug = h.slug
  WHERE p.id IS NULL
     OR p.price_number IS DISTINCT FROM h.harga_lama
     OR jsonb_array_length(p.variants) <> 1;

  IF tidak_cocok > 0 THEN
    RAISE EXCEPTION 'Batal: % produk tidak cocok (harga sudah berubah, produk hilang, atau variannya lebih dari satu).', tidak_cocok;
  END IF;
END
$$;

-- 1. Harga retail. price_number DAN priceNumber di dalam varian, karena storefront membaca varian
--    lebih dulu dan baru jatuh ke price_number — mengubah satu saja meninggalkan dua harga berbeda
--    untuk produk yang sama.
UPDATE storefront_products p
SET price_number = h.harga_baru,
    variants = (
      SELECT jsonb_agg(jsonb_set(elem, '{priceNumber}', to_jsonb(h.harga_baru)))
      FROM jsonb_array_elements(p.variants) AS elem
    ),
    updated_at = now()
FROM harga_baru h
WHERE p.slug = h.slug;

-- 2. Harga member (potongan 10%, dibulatkan turun ke ribuan).
INSERT INTO storefront_product_prices (product_id, variant_id, tier, price_number, updated_at)
SELECT p.id, h.variant_id, 'member', h.harga_member, now()
FROM harga_baru h JOIN storefront_products p ON p.slug = h.slug
ON CONFLICT (product_id, variant_id, tier)
DO UPDATE SET price_number = EXCLUDED.price_number, updated_at = now();

-- 3. Harga internasional 'overseas' (3,5x retail, dibulatkan naik ke puluhan ribu).
INSERT INTO storefront_product_prices (product_id, variant_id, tier, price_number, updated_at)
SELECT p.id, h.variant_id, 'overseas', h.harga_dunia, now()
FROM harga_baru h JOIN storefront_products p ON p.slug = h.slug
ON CONFLICT (product_id, variant_id, tier)
DO UPDATE SET price_number = EXCLUDED.price_number, updated_at = now();

COMMIT;

-- =====================================================================================================
-- VERIFY — jalankan setelah COMMIT. Semua harus mengembalikan 17 dan 0.
-- =====================================================================================================
-- 17 produk di harga baru, dan tidak ada varian yang tertinggal di harga lama:
--
--   SELECT count(*) FILTER (WHERE price_number IN (359000, 429000))                    AS retail_baru,
--          count(*) FILTER (WHERE (variants -> 0 ->> 'priceNumber')::int <> price_number) AS varian_beda
--   FROM storefront_products
--   WHERE slug IN ('hug-n-1', 'j-adore-la-vetiver', 'ayang-ayang', 'soli-extended-j-adore-la-vanille', 'jata-bhumi', 'la-tulipe', 'vanille-planifolia', 'animal-farm', 'jason-voorhees', 'patchouli-so-sexy', 'l-iris', 'la-rose', 'wongka', 'lintang-asmoro', 'pantura', 'sudra', 'wayback');
--   -- harapan: retail_baru = 17, varian_beda = 0
--
-- Potongan member kembali 10% dan kelipatan dunia kembali 3,5x:
--
--   SELECT t.tier,
--          count(*)                                                        AS baris,
--          min(round(t.price_number::numeric / p.price_number, 2))         AS kelipatan_min,
--          max(round(t.price_number::numeric / p.price_number, 2))         AS kelipatan_max
--   FROM storefront_product_prices t
--   JOIN storefront_products p ON p.id = t.product_id
--   WHERE p.price_number IN (359000, 429000)
--   GROUP BY t.tier;
--   -- harapan: member 0,90 (turun sedikit karena pembulatan), overseas 3,51-3,52
--
-- Di aplikasi: buka satu produk di toko, harga katalognya Rp 359.000; buka /en dengan ?ship=world,
-- harganya Rp 1.260.000. Kalau salah satunya masih angka lama, cache katalog di perangkat itu yang
-- basi — muat ulang keras, jangan jalankan SQL ini dua kali.

-- =====================================================================================================
-- ROLLBACK — mengembalikan persis ke keadaan sebelum migrasi ini.
-- =====================================================================================================
-- Harga member dan overseas yang LAMA tidak ditulis di sini sebagai angka: keduanya memang turunan dari
-- retail, jadi mengembalikan retail lalu menekan tombol isi massal di Kurasi Katalog (member 10%,
-- overseas 3,5x) menghasilkan angka lama yang sama persis. Yang tidak bisa dikarang ulang adalah retail,
-- dan itu ada lengkap di bawah.
--
-- BEGIN;
--
-- CREATE TEMP TABLE harga_lama (slug text PRIMARY KEY, harga integer NOT NULL) ON COMMIT DROP;
-- INSERT INTO harga_lama (slug, harga) VALUES
--   ('hug-n-1', 279000),
--   ('j-adore-la-vetiver', 279000),
--   ('ayang-ayang', 289000),
--   ('soli-extended-j-adore-la-vanille', 289000),
--   ('jata-bhumi', 289000),
--   ('la-tulipe', 289000),
--   ('vanille-planifolia', 289000),
--   ('animal-farm', 297000),
--   ('jason-voorhees', 297000),
--   ('patchouli-so-sexy', 297000),
--   ('l-iris', 310000),
--   ('la-rose', 310000),
--   ('wongka', 319000),
--   ('lintang-asmoro', 329000),
--   ('pantura', 339000),
--   ('sudra', 339000),
--   ('wayback', 345000);
--
-- UPDATE storefront_products p
-- SET price_number = l.harga,
--     variants = (
--       SELECT jsonb_agg(jsonb_set(elem, '{priceNumber}', to_jsonb(l.harga)))
--       FROM jsonb_array_elements(p.variants) AS elem
--     ),
--     updated_at = now()
-- FROM harga_lama l
-- WHERE p.slug = l.slug;
--
-- COMMIT;
