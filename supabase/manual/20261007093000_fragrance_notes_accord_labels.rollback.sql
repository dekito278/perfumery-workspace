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
    top_notes = array['Blood', 'Almond', 'Cherry']::text[],
    heart_notes = array['Ylang-ylang', 'Nagarmotha']::text[],
    base_notes = array['Oud', 'Animalic']::text[],
    top_notes_en = array['Blood', 'Almond', 'Cherry']::text[],
    heart_notes_en = array['Ylang-ylang', 'Nagarmotha']::text[],
    base_notes_en = array['Oud', 'Animalic']::text[]
where slug = 'wayback';

-- Animal Farm
update public.storefront_products set
    notes = 'Green, leathery, animalic',
    notes_en = 'Green, leathery, animalic',
    top_notes = array['Green']::text[],
    heart_notes = array['Leather', 'Musk']::text[],
    base_notes = array['Animalic', 'Mud']::text[],
    top_notes_en = array['Green']::text[],
    heart_notes_en = array['Leather', 'Musk']::text[],
    base_notes_en = array['Animalic', 'Mud']::text[],
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
    top_notes = array['Tuberose Abs', 'Orange Flower Abs']::text[],
    heart_notes = array['Sandalwood Kupang', 'Orris Root']::text[],
    base_notes = array['Ambrocenide', 'Oud Malinau']::text[],
    top_notes_en = array['Tuberose Abs', 'Orange Flower Abs']::text[],
    heart_notes_en = array['Sandalwood Kupang', 'Orris Root']::text[],
    base_notes_en = array['Ambrocenide', 'Oud Malinau']::text[]
where slug = 'aquilaria-tuberosa';

-- Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀)
update public.storefront_products set
    notes = 'White floral, ambery, musky',
    notes_en = 'White floral, ambery, musky',
    top_notes = array['Jasmine', 'Tuberose']::text[],
    heart_notes = array['Amberwood F']::text[],
    base_notes = array['Radiant Musk', 'Amber']::text[],
    top_notes_en = array['Jasmine', 'Tuberose']::text[],
    heart_notes_en = array['Amberwood F']::text[],
    base_notes_en = array['Radiant Musk', 'Amber']::text[]
where slug = 'ayang-ayang';

-- HUG N°1
update public.storefront_products set
    notes = 'Metallic, milky, musky',
    notes_en = 'Metallic, milky, musky',
    top_notes = array['Metallic', 'Medicinal']::text[],
    heart_notes = array['Milky', 'Powdery']::text[],
    base_notes = array['Musk', 'Animalic']::text[],
    top_notes_en = array['Metallic', 'Medicinal']::text[],
    heart_notes_en = array['Milky', 'Powdery']::text[],
    base_notes_en = array['Musk', 'Animalic']::text[],
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
    top_notes = array['Bozzy Vanilic']::text[],
    heart_notes = array['Resin', 'Sandalwood']::text[],
    base_notes = array['Vanilla', 'Animalic']::text[],
    top_notes_en = array['Bozzy Vanilic']::text[],
    heart_notes_en = array['Resin', 'Sandalwood']::text[],
    base_notes_en = array['Vanilla', 'Animalic']::text[]
where slug = 'soli-extended-j-adore-la-vanille';

-- J’adore La Vetiver
update public.storefront_products set
    notes = 'Vetiver, fresh earthy',
    notes_en = 'Vetiver, fresh earthy',
    top_notes = array['Lime']::text[],
    heart_notes = array['Amberwood F']::text[],
    base_notes = array['Vetiver']::text[],
    top_notes_en = array['Lime']::text[],
    heart_notes_en = array['Amberwood F']::text[],
    base_notes_en = array['Vetiver']::text[]
where slug = 'j-adore-la-vetiver';

-- Jason Voorhees
update public.storefront_products set
    notes = 'Swampy green, leathery, animalic',
    notes_en = 'Swampy green, leathery, animalic',
    top_notes = array['Green', 'Wet Moss']::text[],
    heart_notes = array['Leathery', 'Smoky']::text[],
    base_notes = array['Animalic', 'Earthy']::text[],
    top_notes_en = array['Green', 'Wet Moss']::text[],
    heart_notes_en = array['Leathery', 'Smoky']::text[],
    base_notes_en = array['Animalic', 'Earthy']::text[],
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
    top_notes = array['Ozonic', 'Aquatic']::text[],
    heart_notes = array['Smoky', 'Leathery']::text[],
    base_notes = array['Animalic', 'Geosmin']::text[],
    top_notes_en = array['Ozonic', 'Aquatic']::text[],
    heart_notes_en = array['Smoky', 'Leathery']::text[],
    base_notes_en = array['Animalic', 'Geosmin']::text[],
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
    top_notes = array['Iris', 'spicy']::text[],
    heart_notes = array['Leathery', 'orris']::text[],
    base_notes = array['Musk', 'Sandalwood']::text[],
    top_notes_en = array[]::text[],
    heart_notes_en = array[]::text[],
    base_notes_en = array[]::text[],
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
    top_notes = array['Nectar']::text[],
    heart_notes = array['Rose']::text[],
    base_notes = array['Musk']::text[],
    top_notes_en = array['Nectar']::text[],
    heart_notes_en = array['Rose']::text[],
    base_notes_en = array['Musk']::text[]
where slug = 'la-rose';

-- La Tulipe
update public.storefront_products set
    notes = 'Muguet, tulip, musk',
    notes_en = 'Muguet, tulip, musk',
    top_notes = array['Muguet']::text[],
    heart_notes = array['Tulipe']::text[],
    base_notes = array['Musk']::text[],
    top_notes_en = array['Muguet']::text[],
    heart_notes_en = array['Tulipe']::text[],
    base_notes_en = array['Musk']::text[]
where slug = 'la-tulipe';

-- Lintang Asmoro
update public.storefront_products set
    notes = 'Clean aldehydic musk',
    notes_en = 'Clean aldehydic musk',
    top_notes = array['Clean', 'Aldehyde']::text[],
    heart_notes = array['Floral']::text[],
    base_notes = array['Musk']::text[],
    top_notes_en = array['Clean', 'Aldehyde']::text[],
    heart_notes_en = array['Floral']::text[],
    base_notes_en = array['Musk']::text[]
where slug = 'lintang-asmoro';

-- Maskumambang
update public.storefront_products set
    notes = 'White floral, olibanum, musk',
    notes_en = 'White floral, olibanum, musk',
    top_notes = array['Jasmine Sambac']::text[],
    heart_notes = array['Cempaka', 'Olibanum Boswellia']::text[],
    base_notes = array['White Musk', 'Deer Musk']::text[],
    top_notes_en = array['Jasmine Sambac']::text[],
    heart_notes_en = array['Cempaka', 'Olibanum Boswellia']::text[],
    base_notes_en = array['White Musk', 'Deer Musk']::text[]
where slug = 'maskumambang';

-- Pantura
update public.storefront_products set
    notes = 'Solar, salty, dusty woody',
    notes_en = 'Solar, salty, dusty woody',
    top_notes = array['Orange', 'Lime', 'Bergamot', 'Sea Salt', 'Green']::text[],
    heart_notes = array['Solar Note', 'Floral', 'Bitter']::text[],
    base_notes = array['Smoky', 'Amber', 'Amberwood F', 'Musk']::text[],
    top_notes_en = array['Orange', 'Lime', 'Bergamot', 'Sea Salt', 'Green']::text[],
    heart_notes_en = array['Solar Note', 'Floral', 'Bitter']::text[],
    base_notes_en = array['Smoky', 'Amber', 'Amberwood F', 'Musk']::text[]
where slug = 'pantura';

-- Patchouli so sexy
update public.storefront_products set
    notes = 'Nilam, amber, vanilla',
    notes_en = 'Patchouli, amber, vanilla',
    top_notes = array['Nilam', 'Coklat Putih']::text[],
    heart_notes = array['Amber', 'Balsamic']::text[],
    base_notes = array['Vanilla', 'Nilam']::text[],
    top_notes_en = array['Nilam', 'Coklat Putih']::text[],
    heart_notes_en = array['Amber', 'Balsamic']::text[],
    base_notes_en = array['Vanilla', 'Nilam']::text[]
where slug = 'patchouli-so-sexy';

-- Sudra
update public.storefront_products set
    notes = 'Spicy rice, woody',
    notes_en = 'Spicy rice, woody',
    top_notes = array['Spicy', 'Green']::text[],
    heart_notes = array['Rice Note', 'Cedarwood']::text[],
    base_notes = array['Amberwood F']::text[],
    top_notes_en = array['Spicy', 'Green']::text[],
    heart_notes_en = array['Rice Note', 'Cedarwood']::text[],
    base_notes_en = array['Amberwood F']::text[]
where slug = 'sudra';

-- Vanille Planifolia
update public.storefront_products set
    notes = 'Spicy vanilla, rum',
    notes_en = 'Spicy vanilla, rum',
    top_notes = array['Spicy', 'Creamy', 'Rum']::text[],
    heart_notes = array['Lily of the Valley', 'Fruity Note']::text[],
    base_notes = array['Musk', 'Vanilla']::text[],
    top_notes_en = array['Spicy', 'Creamy', 'Rum']::text[],
    heart_notes_en = array['Lily of the Valley', 'Fruity Note']::text[],
    base_notes_en = array['Musk', 'Vanilla']::text[]
where slug = 'vanille-planifolia';

-- Wongka!
update public.storefront_products set
    notes = 'Fresh green musk',
    notes_en = 'Fresh green musk',
    top_notes = array['Fresh']::text[],
    heart_notes = array['Green']::text[],
    base_notes = array['Musk']::text[],
    top_notes_en = array['Fresh']::text[],
    heart_notes_en = array['Green']::text[],
    base_notes_en = array['Musk']::text[]
where slug = 'wongka';

commit;
