-- Satu kolom: produk yang diceritakan sebuah artikel jurnal.
--
-- KENAPA. "Kisah Jason Vorhees" bercerita tentang parfum Jason Voorhees, yang ada di katalog, dan
-- halaman artikelnya tidak punya satu pun tautan ke sana. Pembaca selesai membaca lalu buntu.
--
-- related_formula_id sudah ada dan SUDAH TERISI di artikel itu, tapi ia menunjuk ke FORMULA di Studio —
-- dan storefront_products tidak punya kolom formula sama sekali, jadi tidak ada rantai data untuk sampai
-- ke produk toko. Ini kolom yang menyambungkannya, dan sengaja menyimpan SLUG, bukan id: slug itu yang
-- dipakai alamat produk (/catalog/<slug>), jadi tautannya bisa dibangun tanpa query kedua.
--
-- JALANKAN INI DULU, sebelum kode-nya di-merge. Sisi BACA aman tanpa kolom ini (service-nya memakai
-- select('*')), tapi sisi TULIS di Studio butuh kolomnya ada.
--
-- Tanpa begin/commit — editor Supabase-mu menolaknya diam-diam.


-- ============================================================
-- BLOK 1 — TAMBAH KOLOM
--
-- Tanpa foreign key ke storefront_products: produk bisa dihapus atau di-slug-ulang, dan artikel yang
-- kehilangan produknya harus tetap terbit — halaman artikel sudah menyembunyikan kartunya kalau
-- produknya tidak ketemu. Foreign key di sini akan menukar tautan mati dengan artikel yang gagal simpan.
-- ============================================================
alter table public.journal_posts
    add column if not exists related_product_slug text;


-- ============================================================
-- BLOK 2 — CEK. Harus keluar 1 baris: related_product_slug | text | YES
-- ============================================================
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'journal_posts'
  and column_name = 'related_product_slug';


-- ============================================================
-- BLOK 3 — CEK kedua: anon masih bisa membaca artikel terbit, dan kolomnya ikut terbawa.
-- Harus keluar 1 baris (artikel Jason), related_product_slug-nya masih kosong.
-- ============================================================
select slug, title, related_product_slug
from public.journal_posts
where status = 'published'
order by published_at desc;


-- ============================================================
-- BLOK 4 — ISI (opsional, boleh juga lewat Studio setelah kodenya live).
-- Slug-nya harus persis seperti di alamat produk: solivagantscent.com/catalog/<slug>
-- ============================================================
-- update public.journal_posts
--    set related_product_slug = 'jason-voorhees'
--  where slug = 'kisah-jason-vorhees-32209a44';


-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table public.journal_posts drop column if exists related_product_slug;
