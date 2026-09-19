-- Dua kolom Inggris untuk opsi bespoke, plus dua koreksi teks.
--
-- KENAPA. Label dan deskripsi opsi bespoke hidup di tabel ini, jadi kata-katanya sampai ke halaman saat
-- runtime — tidak ada satu pun pemeriksa teks Indonesia di kode yang bisa melihatnya. Di halaman
-- /en/bespoke yang selebihnya berbahasa Inggris, pembeli membaca "Tulis tangan", "Ukuran default
-- bespoke.", dan judul "UKURAN".
--
-- Kode-nya sudah siap dan AMAN tanpa migrasi ini: kalau kolomnya belum ada, atau isinya kosong, halaman
-- Inggris jatuh kembali ke teks Indonesia per FIELD — label boleh sudah diterjemahkan sementara
-- deskripsinya belum. Jadi tidak ada yang rusak kalau kamu mengisinya perlahan.
--
-- Tanpa begin/commit — editor Supabase-mu menolaknya diam-diam.


-- ============================================================
-- BLOK 1 — TAMBAH DUA KOLOM
-- ============================================================
alter table public.storefront_bespoke_options
    add column if not exists label_en text,
    add column if not exists description_en text;


-- ============================================================
-- BLOK 2 — KOREKSI TEKS INDONESIA (ini kelihatan oleh pembeli Indonesia juga)
--
-- "mengunakan" kurang satu g. Dan satu baris label-nya NULL, jadi tombolnya tampil tanpa nama.
-- ============================================================
update public.storefront_bespoke_options
   set description = 'Tidak menggunakan stiker'
 where description = 'Tidak mengunakan stiker';

update public.storefront_bespoke_options
   set label = coalesce(nullif(trim(label), ''), nullif(trim(value), ''), 'Tanpa stiker')
 where label is null or trim(label) = '';


-- ============================================================
-- BLOK 3 — CEK. Harus keluar 2 baris: label_en | text | YES dan description_en | text | YES
-- ============================================================
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'storefront_bespoke_options'
  and column_name in ('label_en', 'description_en')
order by column_name;


-- ============================================================
-- BLOK 4 — LIHAT semua 9 baris beserta kolom barunya (masih kosong).
-- Kolom collection_key memberi tahu kelompoknya: bottleSizes, bottleTypes, capDesigns,
-- labelDesigns, exoticMaterials.
-- ============================================================
select collection_key, label, label_en, description, description_en
from public.storefront_bespoke_options
order by collection_key, sort_order;


-- ============================================================
-- BLOK 5 — ISI TERJEMAHANNYA. Ini usulan saya; ganti kalimat apa pun yang tidak sesuai seleramu.
-- Yang kamu kosongkan akan otomatis jatuh kembali ke teks Indonesia, jadi aman dicicil.
-- ============================================================
update public.storefront_bespoke_options set label_en = '30 ml',
       description_en = 'The default bespoke size.'
 where label = '30 ml';

update public.storefront_bespoke_options set label_en = '50 ml'
 where label = '50 ml';

update public.storefront_bespoke_options set label_en = 'Classic',
       description_en = 'A plain bottle shape, cap by request.'
 where label = 'Classic';

update public.storefront_bespoke_options set label_en = 'Thematic bottle',
       description_en = 'An abstract bottle shape, by request.'
 where label = 'Thematic Botol';

update public.storefront_bespoke_options set label_en = 'Custom abstract cap',
       description_en = 'Custom colour and abstract form.'
 where label = 'Cap custom Abstrak';

update public.storefront_bespoke_options set label_en = 'Basic cap',
       description_en = 'A basic cap — round or square.'
 where label = 'Cap Basic';

update public.storefront_bespoke_options set label_en = 'Handwritten',
       description_en = 'A sticker label in my own handwriting.'
 where label = 'Tulis tangan';

update public.storefront_bespoke_options set label_en = 'Custom name label',
       description_en = 'A label with a name or a personal message.' || chr(10) || '+ adds 14 days to the studio time'
 where label = 'Custom name label';

update public.storefront_bespoke_options set label_en = 'None',
       description_en = 'No sticker at all.'
 where description in ('Tidak menggunakan stiker', 'Tidak mengunakan stiker');


-- ============================================================
-- BLOK 6 — CEK AKHIR. Setiap baris harus punya label_en; description_en boleh kosong
-- kalau memang deskripsinya kosong.
-- ============================================================
select collection_key, label, label_en, description_en
from public.storefront_bespoke_options
order by collection_key, sort_order;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table public.storefront_bespoke_options
--     drop column if exists label_en,
--     drop column if exists description_en;
