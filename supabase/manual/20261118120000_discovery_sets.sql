-- Discovery Set — lima set vial dari lembar "Set vial Solivagant" (Dekito, 18 Nov 2026; harga per 12 Nov 2026).
-- Jalankan SEKALI di Supabase SQL editor. Aman dijalankan dua kali: set yang sudah ada tidak disentuh.
--
-- Semua isi di bawah diambil persis dari lembar Dekito: nama set, isi vial, harga WEBSITE, "box dan pouch
-- Solivagant", dan kartu potongan. Foto produknya gambar box dari lembar yang sama, disimpan di situs
-- (/brand/sets/*.jpg), seperti sampul Samhain.
--
-- Masuk sebagai DRAF dengan stok 0, jadi belum tampil di toko. Sesudah dijalankan:
--   Studio → Produk → buka tiap set → isi stok → nyalakan "Tampil di toko" → Simpan.
--
-- Aturan yang ikut otomatis di situs (kategori "Discovery Set"):
--   - hanya di toko Indonesia (toko luar negeri tidak menampilkannya — ongkir DHL lebih mahal dari set-nya);
--   - set tidak dihitung sebagai botol, jadi tidak dapat vial gratis;
--   - tidak ada harga member atau ekspor otomatis — harganya persis seperti di bawah.
--
-- Berat kirim: ukuran "5 vial" dihitung 300 g (angka cadangan sistem) sampai ada angka timbangan asli.

begin;

insert into public.storefront_products (
    slug, name, category, price_number, size, notes, description,
    stock, variants, tags, image_url, image_urls, source, featured, limited, popularity
)
values
  (
    'set-i-floral',
    'Set I · Floral',
    'Discovery Set',
    199000,
    '5 vial',
    'La Rose, La Tulipe, L''iris, Ayang-ayang, Lintang Asmoro',
    'Vial spray 2 ml, dikemas dalam box dan pouch Solivagant. Isi 5 vial: La Rose, La Tulipe, L''iris, Ayang-ayang, Lintang Asmoro. Di dalam box ada kartu potongan Rp50.000 untuk pembelian botol penuh di website.',
    0,
    '[{"id": "set", "size": "5 vial", "priceNumber": 199000, "compareAtPriceNumber": 0, "stock": 0}]'::jsonb,
    '["Studio draft", "Discovery set"]'::jsonb,
    'https://www.solivagantscent.com/brand/sets/set-i-floral.jpg',
    '["https://www.solivagantscent.com/brand/sets/set-i-floral.jpg"]'::jsonb,
    'custom', false, false, 40
  ),
  (
    'set-ii-hangat-manis',
    'Set II · Hangat & Manis',
    'Discovery Set',
    199000,
    '5 vial',
    'Vanille Planifolia, J''adore la Vanille, Patchouli So Sexy, .Wayback, J''adore la Vetiver',
    'Vial spray 2 ml, dikemas dalam box dan pouch Solivagant. Isi 5 vial: Vanille Planifolia, J''adore la Vanille, Patchouli So Sexy, .Wayback, J''adore la Vetiver. Di dalam box ada kartu potongan Rp50.000 untuk pembelian botol penuh di website.',
    0,
    '[{"id": "set", "size": "5 vial", "priceNumber": 199000, "compareAtPriceNumber": 0, "stock": 0}]'::jsonb,
    '["Studio draft", "Discovery set"]'::jsonb,
    'https://www.solivagantscent.com/brand/sets/set-ii-hangat-manis.jpg',
    '["https://www.solivagantscent.com/brand/sets/set-ii-hangat-manis.jpg"]'::jsonb,
    'custom', false, false, 40
  ),
  (
    'set-iii-jalan-pulang',
    'Set III · Jalan Pulang',
    'Discovery Set',
    199000,
    '5 vial',
    'Pantura, Jata Bhumi, Sudra, Wongka!, HUG N°1',
    'Vial spray 2 ml, dikemas dalam box dan pouch Solivagant. Isi 5 vial: Pantura, Jata Bhumi, Sudra, Wongka!, HUG N°1. Di dalam box ada kartu potongan Rp50.000 untuk pembelian botol penuh di website.',
    0,
    '[{"id": "set", "size": "5 vial", "priceNumber": 199000, "compareAtPriceNumber": 0, "stock": 0}]'::jsonb,
    '["Studio draft", "Discovery set"]'::jsonb,
    'https://www.solivagantscent.com/brand/sets/set-iii-jalan-pulang.jpg',
    '["https://www.solivagantscent.com/brand/sets/set-iii-jalan-pulang.jpg"]'::jsonb,
    'custom', false, false, 40
  ),
  (
    'set-iv-limited',
    'Set IV · Limited',
    'Discovery Set',
    269000,
    '4 vial',
    'Aquilaria Tuberosa, Maskumambang, Animal Farm, Jason Voorhees',
    'Vial spray 2 ml, dikemas dalam box dan pouch Solivagant. Isi 4 vial: Aquilaria Tuberosa, Maskumambang, Animal Farm, Jason Voorhees. Di dalam box ada kartu potongan Rp50.000 untuk pembelian botol penuh di website.',
    0,
    '[{"id": "set", "size": "4 vial", "priceNumber": 269000, "compareAtPriceNumber": 0, "stock": 0}]'::jsonb,
    '["Studio draft", "Discovery set"]'::jsonb,
    'https://www.solivagantscent.com/brand/sets/set-iv-limited.jpg',
    '["https://www.solivagantscent.com/brand/sets/set-iv-limited.jpg"]'::jsonb,
    'custom', false, false, 40
  ),
  (
    'set-lengkap',
    'Set Lengkap · Semua varian',
    'Discovery Set',
    699000,
    '19 vial',
    'Semua 19 varian dari Set I sampai IV',
    'Vial spray 2 ml, dikemas dalam box dan pouch Solivagant. Isi 19 vial — semua varian dari Set I sampai IV: La Rose, La Tulipe, L''iris, Ayang-ayang, Lintang Asmoro, Vanille Planifolia, J''adore la Vanille, Patchouli So Sexy, .Wayback, J''adore la Vetiver, Pantura, Jata Bhumi, Sudra, Wongka!, HUG N°1, Aquilaria Tuberosa, Maskumambang, Animal Farm, Jason Voorhees. Di dalam box ada kartu potongan Rp100.000 untuk pembelian botol penuh di website.',
    0,
    '[{"id": "set", "size": "19 vial", "priceNumber": 699000, "compareAtPriceNumber": 0, "stock": 0}]'::jsonb,
    '["Studio draft", "Discovery set"]'::jsonb,
    'https://www.solivagantscent.com/brand/sets/set-lengkap.jpg',
    '["https://www.solivagantscent.com/brand/sets/set-lengkap.jpg"]'::jsonb,
    'custom', false, false, 40
  )
on conflict (slug) do nothing;

commit;

-- CEK
--   select slug, name, price_number, stock, tags from public.storefront_products
--    where category = 'Discovery Set' order by slug;
--   -> 5 baris, semua bertag "Studio draft" sampai di-publish dari Studio.
--
-- BATAL (hanya selama belum ada pesanan untuk set-set ini)
--   delete from public.storefront_products where category = 'Discovery Set' and slug in
--     ('set-i-floral','set-ii-hangat-manis','set-iii-jalan-pulang','set-iv-limited','set-lengkap');
