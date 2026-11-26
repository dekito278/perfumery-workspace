-- Animal Farm: foto botolnya jadi foto utama dari folder foto botol situs (26 Nov 2026).
-- Jalankan SEKALI di Supabase SQL editor. Aman dijalankan dua kali.
--
-- Fotonya SAMA dengan foto utama Animal Farm sekarang (botol di dalam kotak hijau) — hanya disalin ke situs
-- (/brand/products/animal-farm/), seperti 11 parfum lain, supaya Animal Farm ikut tampil di home dan di depan
-- katalog. Tiga gambar lain di galerinya (kartu notes, lukisan kandang, cerita) TETAP, urutannya sama, di belakang
-- foto botol. Tidak ada yang dihapus. Harga, notes, stok, deskripsi tidak disentuh.

begin;

with photos(slug, files) as (
    values ('animal-farm', array['1-depan'])
)
update public.storefront_products as p
   set image_url = 'https://www.solivagantscent.com/brand/products/' || p.slug || '/' || ph.files[1] || '.webp',
       image_urls = jsonb_build_array('https://www.solivagantscent.com/brand/products/' || p.slug || '/' || ph.files[1] || '.webp')
                    || coalesce((
                           select jsonb_agg(u order by n)
                             from jsonb_array_elements_text(coalesce(p.image_urls, '[]'::jsonb)) with ordinality as e(u, n)
                            where u not like '%/brand/products/%'
                              and u not like '%/animal-farm/1794582494900-pwjs62.jpg'
                       ), '[]'::jsonb),
       updated_at = now()
  from photos ph
 where p.slug = ph.slug;

commit;

-- CEK
--   select image_url, image_urls from public.storefront_products where slug = 'animal-farm';
--   -> image_url .../brand/products/animal-farm/1-depan.webp; image_urls: foto itu + 3 gambar lama (notes, lukisan, cerita)
