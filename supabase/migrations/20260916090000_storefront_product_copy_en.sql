-- Halaman produk berbahasa Inggris: kolom terjemahan untuk deskripsi dan notes.
--
-- Nama, harga, stok, dan varian TIDAK diterjemahkan — itu data, bukan teks. Yang diterjemahkan hanya
-- yang dibaca sebagai kalimat: deskripsi, teks notes bebas, dan tiga daftar piramida aroma.
--
-- Semua boleh NULL, dan etalase jatuh ke bahasa Indonesia kalau kosong. Jadi menjalankan migrasi ini
-- tidak mengubah apa pun sampai isinya diisi, dan produk yang belum diterjemahkan tetap tampil utuh
-- dalam bahasa Indonesia, bukan kosong.
--
-- TANPA blok begin;/commit; — editor SQL-mu menolaknya dan skripnya diam-diam tidak tersimpan.
-- Jalankan BERURUTAN. Kalau ada yang merah, kirim errornya dan jangan lanjut.


-- ============================================================
-- BLOK 1 — tambah kolomnya
-- ============================================================
alter table public.storefront_products
  add column if not exists description_en text,
  add column if not exists notes_en text,
  add column if not exists top_notes_en jsonb not null default '[]'::jsonb,
  add column if not exists heart_notes_en jsonb not null default '[]'::jsonb,
  add column if not exists base_notes_en jsonb not null default '[]'::jsonb;


-- ============================================================
-- BLOK 2 — jaga bentuknya: ketiga kolom notes harus tetap berupa array
-- (aturan yang sama dengan kolom notes bahasa Indonesia)
-- ============================================================
alter table public.storefront_products
  drop constraint if exists storefront_products_top_notes_en_array,
  drop constraint if exists storefront_products_heart_notes_en_array,
  drop constraint if exists storefront_products_base_notes_en_array;

alter table public.storefront_products
  add constraint storefront_products_top_notes_en_array check (jsonb_typeof(top_notes_en) = 'array'),
  add constraint storefront_products_heart_notes_en_array check (jsonb_typeof(heart_notes_en) = 'array'),
  add constraint storefront_products_base_notes_en_array check (jsonb_typeof(base_notes_en) = 'array');


-- ============================================================
-- BLOK 3 — buat ulang view publiknya.
-- View-nya menyalin SEMUA kolom tabel lewat jsonb_populate_record, tapi kolom baru hanya muncul
-- setelah view-nya dibuat ulang. Badannya sama persis dengan yang sekarang — tidak ada yang berubah
-- selain kolom yang ikut terbawa.
-- ============================================================
create or replace view public.storefront_products_public as
    select (jsonb_populate_record(
        null::public.storefront_products,
        to_jsonb(p) || jsonb_build_object(
            'tags',
            coalesce(
                (select jsonb_agg(tag)
                 from jsonb_array_elements_text(coalesce(p.tags, '[]'::jsonb)) as tag
                 where not public.storefront_product_tag_is_internal(tag)),
                '[]'::jsonb
            )
        )
    )).*
    from public.storefront_products p
    where not public.storefront_product_is_draft(p.tags);

grant select on public.storefront_products_public to anon, authenticated;


-- ============================================================
-- BLOK 4 — CEK. Kolomnya harus ada, dan view-nya harus ikut membawanya.
-- Harus keluar 5 baris.
-- ============================================================
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'storefront_products_public'
  and column_name in ('description_en', 'notes_en', 'top_notes_en', 'heart_notes_en', 'base_notes_en')
order by column_name;


-- ============================================================
-- BLOK 5 — CEK kedua: belum ada isinya, dan bentuk notes-nya benar.
-- Harus: 18, 0, 0.
-- ============================================================
select
  count(*)                                                                as produk,
  count(*) filter (where coalesce(description_en, '') <> '')              as sudah_punya_deskripsi_en,
  count(*) filter (where jsonb_typeof(top_notes_en) <> 'array')           as bentuk_notes_salah
from public.storefront_products;


-- ============================================================
-- ROLLBACK — buang kolomnya lagi dan kembalikan view-nya.
-- Buang komentarnya lalu jalankan. Etalase kembali sepenuhnya ke bahasa Indonesia.
-- ============================================================
/*
alter table public.storefront_products
  drop constraint if exists storefront_products_top_notes_en_array,
  drop constraint if exists storefront_products_heart_notes_en_array,
  drop constraint if exists storefront_products_base_notes_en_array;

alter table public.storefront_products
  drop column if exists description_en,
  drop column if exists notes_en,
  drop column if exists top_notes_en,
  drop column if exists heart_notes_en,
  drop column if exists base_notes_en;

create or replace view public.storefront_products_public as
    select (jsonb_populate_record(
        null::public.storefront_products,
        to_jsonb(p) || jsonb_build_object(
            'tags',
            coalesce(
                (select jsonb_agg(tag)
                 from jsonb_array_elements_text(coalesce(p.tags, '[]'::jsonb)) as tag
                 where not public.storefront_product_tag_is_internal(tag)),
                '[]'::jsonb
            )
        )
    )).*
    from public.storefront_products p
    where not public.storefront_product_is_draft(p.tags);

grant select on public.storefront_products_public to anon, authenticated;
*/
