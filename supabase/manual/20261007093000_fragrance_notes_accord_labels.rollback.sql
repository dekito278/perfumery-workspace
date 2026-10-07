-- Undo 20261007093000_fragrance_notes_accord_labels.sql.
--
-- These are the EXACT values as they stood on 2026-10-07, read from the live table before the
-- migration was written. Run this and the product text is back to where it was.
--
-- If you also ran supabase/manual/20261007093100_oud_and_sandalwood_are_accords.sql, run this one --
-- it restores the oud and sandalwood wording too, because it restores everything.
--
-- Deliberately kept OUT of supabase/migrations/ so no migration run can apply it by accident.

begin;

-- .Wayback
update public.storefront_products set
    notes = 'Dark cherry, oud, animalic',
    notes_en = 'Dark cherry, oud, animalic',
    top_notes = jsonb_build_array('Blood', 'Almond', 'Cherry'),
    heart_notes = jsonb_build_array('Ylang-ylang', 'Nagarmotha'),
    base_notes = jsonb_build_array('Oud', 'Animalic'),
    top_notes_en = jsonb_build_array('Blood', 'Almond', 'Cherry'),
    heart_notes_en = jsonb_build_array('Ylang-ylang', 'Nagarmotha'),
    base_notes_en = jsonb_build_array('Oud', 'Animalic')
where slug = 'wayback';

-- Animal Farm
update public.storefront_products set
    notes = 'Green, leathery, animalic',
    notes_en = 'Green, leathery, animalic',
    top_notes = jsonb_build_array('Green'),
    heart_notes = jsonb_build_array('Leather', 'Musk'),
    base_notes = jsonb_build_array('Animalic', 'Mud'),
    top_notes_en = jsonb_build_array('Green'),
    heart_notes_en = jsonb_build_array('Leather', 'Musk'),
    base_notes_en = jsonb_build_array('Animalic', 'Mud'),
    description = 'Bayangin lo lagi jalan di peternakan. Ada ayam berlarian, sapi yang bau tanah basah, suara gaduh di tempat potong daging, bahkan aroma kotoran ayam yang nyengat. Semua campur jadi satu suasana yang liar, kacau, tapi jujur.

Dari sanalah aku dapet ide bikin parfum ini. Namanya Animal Farm. Sebuah eksperimen aroma yang gak manis, gak indah, tapi nyata, kayak hidup yang apa adanya.

Dibuka hijau dan basah, lalu kulit dan musk naik, sampai akhirnya tinggal yang paling jujur: animalic dan tanah.',
    description_en = 'Picture yourself walking through a farmyard. Chickens scattering, cattle that smell of wet earth, the noise of the slaughter shed, even the sharp reek of chicken dung. It all runs together into one atmosphere: wild, chaotic, and honest.

That is where I got the idea for this perfume. Animal Farm. A scent experiment that is not sweet and not beautiful, but real — the way life is.

It opens green and wet, then leather and musk rise, until all that remains is the most honest part: animalic and earth.'
where slug = 'animal-farm';

-- Aquilaria tuberosa
update public.storefront_products set
    notes = 'Tuberose, oud Malinau',
    notes_en = 'Tuberose, oud Malinau',
    top_notes = jsonb_build_array('Tuberose Abs', 'Orange Flower Abs'),
    heart_notes = jsonb_build_array('Sandalwood Kupang', 'Orris Root'),
    base_notes = jsonb_build_array('Ambrocenide', 'Oud Malinau'),
    top_notes_en = jsonb_build_array('Tuberose Abs', 'Orange Flower Abs'),
    heart_notes_en = jsonb_build_array('Sandalwood Kupang', 'Orris Root'),
    base_notes_en = jsonb_build_array('Ambrocenide', 'Oud Malinau')
where slug = 'aquilaria-tuberosa';

-- Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀)
update public.storefront_products set
    notes = 'White floral, ambery, musky',
    notes_en = 'White floral, ambery, musky',
    top_notes = jsonb_build_array('Jasmine', 'Tuberose'),
    heart_notes = jsonb_build_array('Amberwood F'),
    base_notes = jsonb_build_array('Radiant Musk', 'Amber'),
    top_notes_en = jsonb_build_array('Jasmine', 'Tuberose'),
    heart_notes_en = jsonb_build_array('Amberwood F'),
    base_notes_en = jsonb_build_array('Radiant Musk', 'Amber')
where slug = 'ayang-ayang';

-- HUG N°1
update public.storefront_products set
    notes = 'Metallic, milky, musky',
    notes_en = 'Metallic, milky, musky',
    top_notes = jsonb_build_array('Metallic', 'Medicinal'),
    heart_notes = jsonb_build_array('Milky', 'Powdery'),
    base_notes = jsonb_build_array('Musk', 'Animalic'),
    top_notes_en = jsonb_build_array('Metallic', 'Medicinal'),
    heart_notes_en = jsonb_build_array('Milky', 'Powdery'),
    base_notes_en = jsonb_build_array('Musk', 'Animalic'),
    description = 'Terinspirasi dari momen kelahiran, saat waktu terasa berhenti, dan segalanya berubah.

HUG adalah parfum yang menangkap keajaiban pelukan pertama: aroma ruang bersalin yang steril, darah hangat, kulit bayi, sabun lembut, dan susu pertama yang menyambut hidup.

Wanginya metallic, musky, powdery, lactonic. Bersih tapi tetap ada yang hidup di dalamnya, dan itu bagian yang paling sulit dijelaskan.',
    description_en = 'Inspired by the moment of birth, when time seems to stop and everything changes.

HUG is a perfume that holds the wonder of a first embrace: the sterile air of a delivery room, warm blood, a newborn''s skin, mild soap, and the first milk that meets a life.

It is metallic, musky, powdery, lactonic. Clean, and yet something living stays inside it — that part is the hardest to explain.'
where slug = 'hug-n-1';

-- J’adore la Vanille
update public.storefront_products set
    notes = 'Vanilla, kemenyan, cendana',
    notes_en = 'Vanilla, frankincense, sandalwood',
    top_notes = jsonb_build_array('Bozzy Vanilic'),
    heart_notes = jsonb_build_array('Resin', 'Sandalwood'),
    base_notes = jsonb_build_array('Vanilla', 'Animalic'),
    top_notes_en = jsonb_build_array('Bozzy Vanilic'),
    heart_notes_en = jsonb_build_array('Resin', 'Sandalwood'),
    base_notes_en = jsonb_build_array('Vanilla', 'Animalic')
where slug = 'soli-extended-j-adore-la-vanille';

-- J’adore La Vetiver
update public.storefront_products set
    notes = 'Vetiver, fresh earthy',
    notes_en = 'Vetiver, fresh earthy',
    top_notes = jsonb_build_array('Lime'),
    heart_notes = jsonb_build_array('Amberwood F'),
    base_notes = jsonb_build_array('Vetiver'),
    top_notes_en = jsonb_build_array('Lime'),
    heart_notes_en = jsonb_build_array('Amberwood F'),
    base_notes_en = jsonb_build_array('Vetiver')
where slug = 'j-adore-la-vetiver';

-- Jason Voorhees
update public.storefront_products set
    notes = 'Swampy green, leathery, animalic',
    notes_en = 'Swampy green, leathery, animalic',
    top_notes = jsonb_build_array('Green', 'Wet Moss'),
    heart_notes = jsonb_build_array('Leathery', 'Smoky'),
    base_notes = jsonb_build_array('Animalic', 'Earthy'),
    top_notes_en = jsonb_build_array('Green', 'Wet Moss'),
    heart_notes_en = jsonb_build_array('Leathery', 'Smoky'),
    base_notes_en = jsonb_build_array('Animalic', 'Earthy'),
    description = 'Terinspirasi dari legenda Crystal Lake.

Jason Voorhees kembali dari kegelapan, membawa ketakutan yang tak pernah mati. Diam, tapi mematikan. Tenang, tapi tak terhentikan.

Aromanya rawa yang gelap: hijau dan basah di awal, lalu kulit dan asap, dan di bawahnya sesuatu yang sebaiknya tidak ditemukan.

Berani semprot, kalau kamu cukup kuat untuk menatap kegelapan.',
    description_en = 'Inspired by the legend of Crystal Lake.

Jason Voorhees comes back out of the dark, carrying a fear that never dies. Silent, but lethal. Calm, but unstoppable.

It smells like a black swamp: green and wet at first, then leather and smoke, and underneath it something you would rather not find.

Spray it — if you are strong enough to look into the dark.'
where slug = 'jason-voorhees';

-- Jata Bhumi
update public.storefront_products set
    notes = 'Smoky marine, animalic',
    notes_en = 'Smoky marine, animalic',
    top_notes = jsonb_build_array('Ozonic', 'Aquatic'),
    heart_notes = jsonb_build_array('Smoky', 'Leathery'),
    base_notes = jsonb_build_array('Animalic', 'Geosmin'),
    top_notes_en = jsonb_build_array('Ozonic', 'Aquatic'),
    heart_notes_en = jsonb_build_array('Smoky', 'Leathery'),
    base_notes_en = jsonb_build_array('Animalic', 'Geosmin'),
    description = 'Bayangin, lo lagi ikut upacara Nadran di Indramayu.

Sesajen dilepas ke laut sebagai penghormatan untuk yang menjaga air. Perahu goyang, asap dupa kebawa angin, dan bau laut nempel di mana-mana.

Jata Bhumi adalah aroma dari atas kapal itu: marine yang asin, asap yang tipis, dan sesuatu yang amis dan hidup di bawahnya.',
    description_en = 'Picture yourself at a Nadran ceremony in Indramayu.

Offerings are released into the sea in honour of whatever keeps the water. The boat rocks, incense smoke drifts on the wind, and the smell of the sea gets into everything.

Jata Bhumi is the scent from the deck of that boat: salt marine, a thin line of smoke, and something briny and alive underneath it.'
where slug = 'jata-bhumi';

-- L’iris
update public.storefront_products set
    notes = 'Iris',
    notes_en = null,
    top_notes = jsonb_build_array('Iris', 'spicy'),
    heart_notes = jsonb_build_array('Leathery', 'orris'),
    base_notes = jsonb_build_array('Musk', 'Sandalwood'),
    top_notes_en = jsonb_build_array(),
    heart_notes_en = jsonb_build_array(),
    base_notes_en = jsonb_build_array(),
    description = 'Awalnya powdery. Lama-lama jadi leathery. Vanila, cendana, dan musk yang bertahan.

Wangi yang nggak minta diperhatiin.
musky, powdery.

hardbox, label cap with custome bottle.',
    description_en = null
where slug = 'l-iris';

-- La Rose
update public.storefront_products set
    notes = 'Nectar, rose, musk',
    notes_en = 'Nectar, rose, musk',
    top_notes = jsonb_build_array('Nectar'),
    heart_notes = jsonb_build_array('Rose'),
    base_notes = jsonb_build_array('Musk'),
    top_notes_en = jsonb_build_array('Nectar'),
    heart_notes_en = jsonb_build_array('Rose'),
    base_notes_en = jsonb_build_array('Musk')
where slug = 'la-rose';

-- La Tulipe
update public.storefront_products set
    notes = 'Muguet, tulip, musk',
    notes_en = 'Muguet, tulip, musk',
    top_notes = jsonb_build_array('Muguet'),
    heart_notes = jsonb_build_array('Tulipe'),
    base_notes = jsonb_build_array('Musk'),
    top_notes_en = jsonb_build_array('Muguet'),
    heart_notes_en = jsonb_build_array('Tulipe'),
    base_notes_en = jsonb_build_array('Musk')
where slug = 'la-tulipe';

-- Lintang Asmoro
update public.storefront_products set
    notes = 'Clean aldehydic musk',
    notes_en = 'Clean aldehydic musk',
    top_notes = jsonb_build_array('Clean', 'Aldehyde'),
    heart_notes = jsonb_build_array('Floral'),
    base_notes = jsonb_build_array('Musk'),
    top_notes_en = jsonb_build_array('Clean', 'Aldehyde'),
    heart_notes_en = jsonb_build_array('Floral'),
    base_notes_en = jsonb_build_array('Musk')
where slug = 'lintang-asmoro';

-- Maskumambang
update public.storefront_products set
    notes = 'White floral, olibanum, musk',
    notes_en = 'White floral, olibanum, musk',
    top_notes = jsonb_build_array('Jasmine Sambac'),
    heart_notes = jsonb_build_array('Cempaka', 'Olibanum Boswellia'),
    base_notes = jsonb_build_array('White Musk', 'Deer Musk'),
    top_notes_en = jsonb_build_array('Jasmine Sambac'),
    heart_notes_en = jsonb_build_array('Cempaka', 'Olibanum Boswellia'),
    base_notes_en = jsonb_build_array('White Musk', 'Deer Musk')
where slug = 'maskumambang';

-- Pantura
update public.storefront_products set
    notes = 'Solar, salty, dusty woody',
    notes_en = 'Solar, salty, dusty woody',
    top_notes = jsonb_build_array('Orange', 'Lime', 'Bergamot', 'Sea Salt', 'Green'),
    heart_notes = jsonb_build_array('Solar Note', 'Floral', 'Bitter'),
    base_notes = jsonb_build_array('Smoky', 'Amber', 'Amberwood F', 'Musk'),
    top_notes_en = jsonb_build_array('Orange', 'Lime', 'Bergamot', 'Sea Salt', 'Green'),
    heart_notes_en = jsonb_build_array('Solar Note', 'Floral', 'Bitter'),
    base_notes_en = jsonb_build_array('Smoky', 'Amber', 'Amberwood F', 'Musk')
where slug = 'pantura';

-- Patchouli so sexy
update public.storefront_products set
    notes = 'Nilam, amber, vanilla',
    notes_en = 'Patchouli, amber, vanilla',
    top_notes = jsonb_build_array('Nilam', 'Coklat Putih'),
    heart_notes = jsonb_build_array('Amber', 'Balsamic'),
    base_notes = jsonb_build_array('Vanilla', 'Nilam'),
    top_notes_en = jsonb_build_array('Nilam', 'Coklat Putih'),
    heart_notes_en = jsonb_build_array('Amber', 'Balsamic'),
    base_notes_en = jsonb_build_array('Vanilla', 'Nilam')
where slug = 'patchouli-so-sexy';

-- Sudra
update public.storefront_products set
    notes = 'Spicy rice, woody',
    notes_en = 'Spicy rice, woody',
    top_notes = jsonb_build_array('Spicy', 'Green'),
    heart_notes = jsonb_build_array('Rice Note', 'Cedarwood'),
    base_notes = jsonb_build_array('Amberwood F'),
    top_notes_en = jsonb_build_array('Spicy', 'Green'),
    heart_notes_en = jsonb_build_array('Rice Note', 'Cedarwood'),
    base_notes_en = jsonb_build_array('Amberwood F')
where slug = 'sudra';

-- Vanille Planifolia
update public.storefront_products set
    notes = 'Spicy vanilla, rum',
    notes_en = 'Spicy vanilla, rum',
    top_notes = jsonb_build_array('Spicy', 'Creamy', 'Rum'),
    heart_notes = jsonb_build_array('Lily of the Valley', 'Fruity Note'),
    base_notes = jsonb_build_array('Musk', 'Vanilla'),
    top_notes_en = jsonb_build_array('Spicy', 'Creamy', 'Rum'),
    heart_notes_en = jsonb_build_array('Lily of the Valley', 'Fruity Note'),
    base_notes_en = jsonb_build_array('Musk', 'Vanilla')
where slug = 'vanille-planifolia';

-- Wongka!
update public.storefront_products set
    notes = 'Fresh green musk',
    notes_en = 'Fresh green musk',
    top_notes = jsonb_build_array('Fresh'),
    heart_notes = jsonb_build_array('Green'),
    base_notes = jsonb_build_array('Musk'),
    top_notes_en = jsonb_build_array('Fresh'),
    heart_notes_en = jsonb_build_array('Green'),
    base_notes_en = jsonb_build_array('Musk')
where slug = 'wongka';

commit;
