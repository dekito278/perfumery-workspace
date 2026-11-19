-- Discovery Set: harga luar negeri + tampil di toko (Dekito, 19 Nov 2026: "ikut saranmu", "buat live semuanya").
-- Jalankan SEKALI di Supabase SQL editor, SESUDAH 20261118120000_discovery_sets.sql. Aman dijalankan dua kali.
--
-- 1. Harga luar negeri, angka yang Dekito setujui: Set I–III US$35, Set IV US$45, Set Lengkap US$115.
--    Disimpan dalam rupiah seperti harga ekspor lain, pada kurs toko Rp16.500/US$, jadi situs menampilkan
--    tepat US$35 / US$45 / US$115. Harga rupiah di toko Indonesia (Rp199.000 / Rp269.000 / Rp699.000) tidak
--    berubah.
-- 2. Kelima set keluar dari status draf, jadi tampil di toko. Stoknya masih 0 dari SQL sebelumnya, jadi set
--    tampil sebagai "Stok habis" sampai stok diisi: Studio → Produk → buka set → isi stok → Simpan.
--
-- Di luar negeri set ikut botol: satu set per botol tidak menambah ongkir DHL; keranjang Inggris memberi tahu
-- kalau ada set tapi belum ada botol.

begin;

insert into public.storefront_product_prices (product_id, variant_id, tier, price_number)
select p.id, 'set', 'overseas', v.price
from public.storefront_products p
join (values
    ('set-i-floral', 577500),
    ('set-ii-hangat-manis', 577500),
    ('set-iii-jalan-pulang', 577500),
    ('set-iv-limited', 742500),
    ('set-lengkap', 1897500)
) as v(slug, price) on v.slug = p.slug
where p.category = 'Discovery Set'
on conflict (product_id, variant_id, tier) do update
    set price_number = excluded.price_number,
        updated_at = now();

update public.storefront_products
   set tags = coalesce((
           select jsonb_agg(tag)
             from jsonb_array_elements(tags) as tag
            where lower(btrim(tag #>> '{}')) <> 'studio draft'
       ), '[]'::jsonb),
       updated_at = now()
 where category = 'Discovery Set'
   and slug in ('set-i-floral', 'set-ii-hangat-manis', 'set-iii-jalan-pulang', 'set-iv-limited', 'set-lengkap');

commit;

-- CEK
--   select p.slug, p.tags, pp.price_number as harga_ekspor_rupiah
--     from public.storefront_products p
--     left join public.storefront_product_prices pp on pp.product_id = p.id and pp.tier = 'overseas'
--    where p.category = 'Discovery Set' order by p.slug;
--   -> 5 baris, tanpa tag "Studio draft", harga ekspor 577500 / 577500 / 577500 / 742500 / 1897500.
--
-- BATAL (sembunyikan lagi + hapus harga luar negeri)
--   update public.storefront_products set tags = tags || '["Studio draft"]'::jsonb
--    where category = 'Discovery Set';
--   delete from public.storefront_product_prices
--    where tier = 'overseas' and product_id in (select id from public.storefront_products where category = 'Discovery Set');
