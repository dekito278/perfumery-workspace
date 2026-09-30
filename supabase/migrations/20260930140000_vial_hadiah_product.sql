-- Produk VIAL HADIAH — satu baris produk, satu varian per aroma.
--
-- JALANKAN MANUAL di SQL editor Supabase. Deploy aplikasi tidak menjalankan ini.
--
-- Kenapa lewat SQL dan bukan form Studio: variannya harus satu per aroma dengan `id` = slug parfumnya,
-- dan nama-nama itu memuat apostrof melengkung (J’adore) serta aksara Jawa (ꦲꦪꦤ꧀ꦒ꧀). Diturunkan dari
-- tabelnya sendiri, tidak ada yang bisa salah ketik, dan kalau Dekito menambah parfum nanti cukup
-- jalankan blok TAMBAH AROMA di bawah.
--
-- Barisnya SENGAJA tidak ditandai draft: pemilih aroma membaca vial dari katalog PUBLIK
-- (storefront_products_public), jadi harus lolos view itu. Yang menjaganya tetap tidak terlihat pembeli
-- adalah tag `Vial hadiah` — isProductVisibleInStorefront mengeluarkannya dari 11 halaman listing,
-- planAutoTierPrices menolak memberinya harga member/ekspor, dan tools/seo-artifacts.mjs menjauhkannya
-- dari sitemap serta prerender.
--
-- Stok: 20 per aroma (angka Dekito, 30 Sep 2026).

insert into public.storefront_products (
    slug, name, category, price_number, size, notes, description, concentration,
    stock, variants, tags, source, featured, popularity
)
select
    'vial-hadiah',
    'Vial hadiah',
    'Vial',
    0,
    '2 ml',
    'Vial 2 ml hadiah, satu per order, dipilih pembeli di keranjang.',
    'Stok vial hadiah. Bukan produk yang dijual — baris ini hanya menyimpan stok per aroma untuk pemilih hadiah di keranjang.',
    'Eau de Parfum',
    (count(*) * 20)::int,
    jsonb_agg(
        jsonb_build_object(
            'id', p.slug,
            'size', p.name,
            'priceNumber', 0,
            'compareAtPriceNumber', 0,
            'stock', 20
        )
        order by p.name
    ),
    '["Vial hadiah"]'::jsonb,
    'custom',
    false,
    70
from public.storefront_products p
where not public.storefront_product_is_draft(p.tags)
  and p.slug <> 'vial-hadiah'
on conflict (slug) do nothing;

-- ============================================================================
-- VERIFIKASI — jalankan setelahnya, harus 19 aroma / 380 vial
-- ============================================================================
-- select name,
--        stock                                   as total_vial,
--        jsonb_array_length(variants)            as jumlah_aroma,
--        tags
--   from public.storefront_products
--  where slug = 'vial-hadiah';
--
-- -- Aroma-aromanya, apa adanya:
-- select v->>'size' as aroma, v->>'id' as variant_id, (v->>'stock')::int as stok
--   from public.storefront_products, jsonb_array_elements(variants) v
--  where slug = 'vial-hadiah'
--  order by 1;
--
-- -- Dan pembeli anonim BISA melihatnya (ini yang bikin pemilih aroma muncul):
-- select slug, jsonb_array_length(variants) from public.storefront_products_public
--  where slug = 'vial-hadiah';

-- ============================================================================
-- NANTI: menambah aroma baru tanpa menyentuh stok yang sudah berjalan
-- ============================================================================
-- Jalankan ini setiap kali ada parfum baru. Hanya menambahkan varian yang BELUM ada — stok aroma lama
-- tidak disentuh sama sekali.
--
-- update public.storefront_products vial
--    set variants = vial.variants || coalesce((
--            select jsonb_agg(jsonb_build_object(
--                       'id', p.slug, 'size', p.name,
--                       'priceNumber', 0, 'compareAtPriceNumber', 0, 'stock', 20) order by p.name)
--              from public.storefront_products p
--             where not public.storefront_product_is_draft(p.tags)
--               and p.slug <> 'vial-hadiah'
--               and not exists (select 1 from jsonb_array_elements(vial.variants) v
--                                where v->>'id' = p.slug)
--        ), '[]'::jsonb),
--        stock = (select coalesce(sum((v->>'stock')::int), 0)
--                   from jsonb_array_elements(vial.variants) v)
--  where vial.slug = 'vial-hadiah';

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- delete from public.storefront_products where slug = 'vial-hadiah';
