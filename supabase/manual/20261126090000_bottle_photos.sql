-- Foto botol baru dari Dekito (26 Nov 2026) — "foto lainnya hapus".
-- Jalankan SEKALI di Supabase SQL editor, sesudah semua foto masuk. Aman dijalankan dua kali.
--
-- Foto disimpan di situs, seperti foto set: /brand/products/<slug>/<file>.webp. Foto pertama di tiap daftar
-- jadi foto utama. Semua foto lama tiap produk di bawah diganti — galerinya berisi foto-foto ini saja. Harga,
-- notes, stok, deskripsi tidak disentuh. File lama di storage tidak dihapus (tidak tampil lagi; boleh dibiarkan).

begin;

with photos(slug, files) as (
    values
      ('patchouli-so-sexy', array['1-depan', '2-samping-label', '3-samping-kanan', '4-samping', '5-belakang']),
      ('lintang-asmoro',    array['1-depan', '2-samping-label', '3-samping-kanan', '4-samping', '5-belakang']),
      ('jata-bhumi',        array['1-depan', '2-samping-label', '3-samping-kanan', '4-samping', '5-belakang']),
      ('ayang-ayang',       array['1-samping-label', '2-samping-kanan', '3-belakang']),
      ('aquilaria-tuberosa', array['1-depan', '2-samping-label', '3-samping-kanan', '4-belakang']),
      ('pantura',           array['1-depan', '2-samping-label', '3-samping-kanan', '4-samping', '5-belakang']),
      ('jason-voorhees',    array['1-depan', '2-samping-label', '3-samping-kanan', '4-samping', '5-belakang'])
)
update public.storefront_products as p
   set image_url = 'https://www.solivagantscent.com/brand/products/' || p.slug || '/' || ph.files[1] || '.webp',
       image_urls = (
           select jsonb_agg('https://www.solivagantscent.com/brand/products/' || p.slug || '/' || f.name || '.webp' order by f.n)
             from unnest(ph.files) with ordinality as f(name, n)
       ),
       updated_at = now()
  from photos ph
 where p.slug = ph.slug;

commit;

-- CEK
--   select slug, image_url, jsonb_array_length(image_urls) from public.storefront_products
--    where slug in ('patchouli-so-sexy', 'lintang-asmoro', 'jata-bhumi', 'ayang-ayang', 'aquilaria-tuberosa', 'pantura', 'jason-voorhees') order by slug;
--   -> ayang-ayang 3 foto, aquilaria-tuberosa 4, yang lain 5; image_url = foto pertama.
