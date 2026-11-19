-- Discovery Set: deskripsi bahasa Inggris (19 Nov 2026).
-- Jalankan SEKALI di Supabase SQL editor. Aman dijalankan dua kali.
--
-- Toko luar negeri menampilkan deskripsi Indonesia kalau versi Inggrisnya kosong — dan deskripsi set
-- menyebut "kartu potongan Rp50.000", jadi pembeli luar negeri melihat rupiah. Ini terjemahan dari isi lembar
-- Dekito yang sama (vial 2 ml, box dan pouch, daftar aroma). Kartu potongan sengaja tidak disebut: itu voucher
-- untuk website Indonesia, tidak berlaku untuk pesanan luar negeri. Deskripsi Indonesia tidak berubah.

begin;

update public.storefront_products as p
   set description_en = v.description_en,
       notes_en = v.notes_en,
       updated_at = now()
  from (values
    ('set-i-floral',
     '2 ml spray vials in a Solivagant box and pouch. Five vials: La Rose, La Tulipe, L''iris, Ayang-ayang, Lintang Asmoro.',
     'La Rose, La Tulipe, L''iris, Ayang-ayang, Lintang Asmoro'),
    ('set-ii-hangat-manis',
     '2 ml spray vials in a Solivagant box and pouch. Five vials: Vanille Planifolia, J''adore la Vanille, Patchouli So Sexy, .Wayback, J''adore la Vetiver.',
     'Vanille Planifolia, J''adore la Vanille, Patchouli So Sexy, .Wayback, J''adore la Vetiver'),
    ('set-iii-jalan-pulang',
     '2 ml spray vials in a Solivagant box and pouch. Five vials: Pantura, Jata Bhumi, Sudra, Wongka!, HUG N°1.',
     'Pantura, Jata Bhumi, Sudra, Wongka!, HUG N°1'),
    ('set-iv-limited',
     '2 ml spray vials in a Solivagant box and pouch. Four vials: Aquilaria Tuberosa, Maskumambang, Animal Farm, Jason Voorhees.',
     'Aquilaria Tuberosa, Maskumambang, Animal Farm, Jason Voorhees'),
    ('set-lengkap',
     '2 ml spray vials in a Solivagant box and pouch. Nineteen vials — every scent from Set I to IV: La Rose, La Tulipe, L''iris, Ayang-ayang, Lintang Asmoro, Vanille Planifolia, J''adore la Vanille, Patchouli So Sexy, .Wayback, J''adore la Vetiver, Pantura, Jata Bhumi, Sudra, Wongka!, HUG N°1, Aquilaria Tuberosa, Maskumambang, Animal Farm, Jason Voorhees.',
     'All 19 scents from Set I to IV')
  ) as v(slug, description_en, notes_en)
 where p.slug = v.slug
   and p.category = 'Discovery Set';

commit;

-- CEK
--   select slug, description_en from public.storefront_products where category = 'Discovery Set' order by slug;
--   -> 5 baris, semua dengan teks Inggris di atas.
