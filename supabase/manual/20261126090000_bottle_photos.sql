-- Foto botol baru dari Dekito (26 Nov 2026) — "foto lainnya hapus".
-- Jalankan SEKALI di Supabase SQL editor, sesudah semua foto masuk. Aman dijalankan dua kali.
--
-- Foto disimpan di situs, seperti foto set: /brand/products/<slug>/. Lima foto per parfum, urutannya:
-- depan (label) jadi foto utama, lalu samping dengan label, samping kanan, samping, belakang.
-- Semua foto lama tiap produk di bawah diganti — galerinya berisi lima foto ini saja. Harga, notes, stok,
-- deskripsi tidak disentuh. File lama di storage tidak dihapus (tidak tampil lagi; boleh dibiarkan).

begin;

update public.storefront_products as p
   set image_url = 'https://www.solivagantscent.com/brand/products/' || p.slug || '/1-depan.webp',
       image_urls = (
           select jsonb_agg('https://www.solivagantscent.com/brand/products/' || p.slug || '/' || f || '.webp' order by f)
             from unnest(array['1-depan', '2-samping-label', '3-samping-kanan', '4-samping', '5-belakang']) as f
       ),
       updated_at = now()
 where p.slug in (
     'patchouli-so-sexy',
     'lintang-asmoro'
 );

commit;

-- CEK
--   select slug, image_url, jsonb_array_length(image_urls) from public.storefront_products
--    where slug in ('patchouli-so-sexy', 'lintang-asmoro');
--   -> tiap baris .../1-depan.webp dan 5
