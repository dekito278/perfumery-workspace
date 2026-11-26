-- Patchouli so sexy: foto baru dari Dekito (26 Nov 2026) — "foto lainnya hapus".
-- Jalankan SEKALI di Supabase SQL editor. Aman dijalankan dua kali.
--
-- Lima foto botol (latar abu-abu muda) disimpan di situs, seperti foto set: /brand/products/patchouli-so-sexy/.
-- Urutan: depan (label) jadi foto utama, lalu samping dengan label, samping kanan, samping, belakang.
-- Semua foto lama produk ini diganti — galeri berisi lima foto ini saja. Harga, notes, stok, deskripsi tidak
-- disentuh. File lama di storage tidak dihapus (tidak tampil lagi di mana pun; boleh dibiarkan).

begin;

update public.storefront_products
   set image_url = 'https://www.solivagantscent.com/brand/products/patchouli-so-sexy/1-depan.webp',
       image_urls = '[
         "https://www.solivagantscent.com/brand/products/patchouli-so-sexy/1-depan.webp",
         "https://www.solivagantscent.com/brand/products/patchouli-so-sexy/2-samping-label.webp",
         "https://www.solivagantscent.com/brand/products/patchouli-so-sexy/3-samping-kanan.webp",
         "https://www.solivagantscent.com/brand/products/patchouli-so-sexy/4-samping.webp",
         "https://www.solivagantscent.com/brand/products/patchouli-so-sexy/5-belakang.webp"
       ]'::jsonb,
       updated_at = now()
 where slug = 'patchouli-so-sexy';

commit;

-- CEK
--   select image_url, jsonb_array_length(image_urls) from public.storefront_products where slug = 'patchouli-so-sexy';
--   -> .../1-depan.webp, 5
