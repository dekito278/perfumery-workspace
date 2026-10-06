-- Fragrance notes in the Bortnikoff shape, and the sentences that read badly at a border.
--
-- WHY. Two kinds of problem, and only the first one is about customs.
--
--   1. Materials named as if they were the animal or the protected plant. "Deer Musk" is Moschus
--      spp., CITES Appendix I -- the strictest listing there is, a step above Aquilaria's Appendix
--      II -- and it sat in a public base note on Maskumambang. Calling it "Deer Musk Accord" is not
--      a euphemism: a reconstruction is what it is, and saying so is MORE accurate than what was
--      there. Same for Animalic, Leather, Musk, and for "Blood" on .Wayback, whose note is really a
--      metallic one. This is the convention Bortnikoff uses, and it lowers risk by being precise
--      rather than vague.
--
--   2. Prose that reads alarmingly out of context. "Darah hangat, kulit bayi" in a delivery room
--      (HUG No 1); "sesuatu yang sebaiknya tidak ditemukan" in a swamp (Jason Voorhees); a slaughter
--      shed and chicken dung (Animal Farm). No regulation touches any of it. It is simply what makes
--      a person decide to open the box. The scents are unchanged; four descriptions are.
--
-- Fixed while in here: L'iris had no English text at all, and its description ended with the
-- internal note "hardbox, label cap with custome bottle."; "Bozzy Vanilic" was a typo for Boozy
-- Vanilla; Patchouli so sexy had "Nilam, Coklat Putih" sitting in its ENGLISH columns.
--
-- The notes line is DERIVED from the pyramid it summarises. Those two had already drifted apart --
-- Jason Voorhees read "Swampy green, leathery, animalic" over a pyramid of six different words -- so
-- generating one from the other is the fix for that as well.
--
-- WHAT IS NOT HERE. Oud and sandalwood. Which wording is TRUE depends on what is in the bottle, and
-- only Dekito knows that, so it is a separate file you run on purpose:
-- supabase/manual/20261007093100_oud_and_sandalwood_are_accords.sql
--
-- Bortnikoff writes real oud as "Oud Merauke", by its region, exactly the way "Oud Malinau" is
-- written today; the "(Feel-oud)" label is for the synthetic one. If the oil is natural, the rows
-- below already say the right thing and that other file should never be run.
--
-- Written 2026-10-07. Safe to run twice: every statement sets absolute values, not increments.
-- To undo: supabase/manual/20261007093000_fragrance_notes_accord_labels.rollback.sql

begin;

-- .Wayback
update public.storefront_products set
    notes = 'Fragrance Notes: Metallic Accord, Almond, Cherry, Ylang-ylang, Nagarmotha, Oud, Animalic Accord',
    notes_en = 'Fragrance Notes: Metallic Accord, Almond, Cherry, Ylang-ylang, Nagarmotha, Oud, Animalic Accord',
    top_notes = array['Metallic Accord', 'Almond', 'Cherry']::text[],
    heart_notes = array['Ylang-ylang', 'Nagarmotha']::text[],
    base_notes = array['Oud', 'Animalic Accord']::text[],
    top_notes_en = array['Metallic Accord', 'Almond', 'Cherry']::text[],
    heart_notes_en = array['Ylang-ylang', 'Nagarmotha']::text[],
    base_notes_en = array['Oud', 'Animalic Accord']::text[]
where slug = 'wayback';

-- Animal Farm
update public.storefront_products set
    notes = 'Fragrance Notes: Green, Leather Accord, Musk Accord, Animalic Accord, Earthy Accord',
    notes_en = 'Fragrance Notes: Green, Leather Accord, Musk Accord, Animalic Accord, Earthy Accord',
    top_notes = array['Green']::text[],
    heart_notes = array['Leather Accord', 'Musk Accord']::text[],
    base_notes = array['Animalic Accord', 'Earthy Accord']::text[],
    top_notes_en = array['Green']::text[],
    heart_notes_en = array['Leather Accord', 'Musk Accord']::text[],
    base_notes_en = array['Animalic Accord', 'Earthy Accord']::text[],
    description = 'Bayangin lo lagi jalan di peternakan pagi-pagi. Tanah basah, jerami, kandang, suara ternak dari kejauhan. Semua campur jadi satu suasana yang liar, kacau, tapi jujur.

Dari sanalah aku dapet ide bikin parfum ini. Namanya Animal Farm. Sebuah eksperimen aroma yang gak manis, gak indah, tapi nyata, kayak hidup yang apa adanya.

Dibuka hijau dan basah, lalu leather accord dan musk naik, sampai akhirnya tinggal yang paling jujur: animalic accord dan tanah.',
    description_en = 'Picture yourself walking through a farmyard early in the morning. Wet earth, straw, pens, livestock somewhere in the distance. It all runs together into one atmosphere: wild, chaotic, and honest.

That is where I got the idea for this perfume. Animal Farm. A scent experiment that is not sweet and not beautiful, but real — the way life is.

It opens green and wet, then a leather accord and musk rise, until all that remains is the most honest part: an animalic accord and earth.'
where slug = 'animal-farm';

-- Aquilaria tuberosa
update public.storefront_products set
    notes = 'Fragrance Notes: Tuberose Absolute, Orange Flower Absolute, Sandalwood Kupang, Orris Root, Ambrocenide, Oud Malinau',
    notes_en = 'Fragrance Notes: Tuberose Absolute, Orange Flower Absolute, Sandalwood Kupang, Orris Root, Ambrocenide, Oud Malinau',
    top_notes = array['Tuberose Absolute', 'Orange Flower Absolute']::text[],
    heart_notes = array['Sandalwood Kupang', 'Orris Root']::text[],
    base_notes = array['Ambrocenide', 'Oud Malinau']::text[],
    top_notes_en = array['Tuberose Absolute', 'Orange Flower Absolute']::text[],
    heart_notes_en = array['Sandalwood Kupang', 'Orris Root']::text[],
    base_notes_en = array['Ambrocenide', 'Oud Malinau']::text[]
where slug = 'aquilaria-tuberosa';

-- Ayang-ayang (ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀)
update public.storefront_products set
    notes = 'Fragrance Notes: Jasmine, Tuberose, Amberwood F, Radiant Musk Accord, Amber',
    notes_en = 'Fragrance Notes: Jasmine, Tuberose, Amberwood F, Radiant Musk Accord, Amber',
    top_notes = array['Jasmine', 'Tuberose']::text[],
    heart_notes = array['Amberwood F']::text[],
    base_notes = array['Radiant Musk Accord', 'Amber']::text[],
    top_notes_en = array['Jasmine', 'Tuberose']::text[],
    heart_notes_en = array['Amberwood F']::text[],
    base_notes_en = array['Radiant Musk Accord', 'Amber']::text[]
where slug = 'ayang-ayang';

-- HUG N°1
update public.storefront_products set
    notes = 'Fragrance Notes: Metallic Accord, Medicinal, Milky, Powdery, Musk Accord, Animalic Accord',
    notes_en = 'Fragrance Notes: Metallic Accord, Medicinal, Milky, Powdery, Musk Accord, Animalic Accord',
    top_notes = array['Metallic Accord', 'Medicinal']::text[],
    heart_notes = array['Milky', 'Powdery']::text[],
    base_notes = array['Musk Accord', 'Animalic Accord']::text[],
    top_notes_en = array['Metallic Accord', 'Medicinal']::text[],
    heart_notes_en = array['Milky', 'Powdery']::text[],
    base_notes_en = array['Musk Accord', 'Animalic Accord']::text[],
    description = 'Terinspirasi dari momen kelahiran, saat waktu terasa berhenti, dan segalanya berubah.

HUG adalah parfum yang menangkap keajaiban pelukan pertama: udara ruang yang bersih, kulit yang hangat, sabun lembut, dan susu pertama yang menyambut hidup.

Wanginya metallic, musky, powdery, lactonic. Bersih tapi tetap ada yang hidup di dalamnya, dan itu bagian yang paling sulit dijelaskan.',
    description_en = 'Inspired by the moment of birth, when time seems to stop and everything changes.

HUG is a perfume that holds the wonder of a first embrace: clean air, warm skin, mild soap, and the first milk that meets a life.

It is metallic, musky, powdery, lactonic. Clean, and yet something living stays inside it — that part is the hardest to explain.'
where slug = 'hug-n-1';

-- J’adore la Vanille
update public.storefront_products set
    notes = 'Fragrance Notes: Boozy Vanilla, Resin, Sandalwood, Vanilla, Animalic Accord',
    notes_en = 'Fragrance Notes: Boozy Vanilla, Resin, Sandalwood, Vanilla, Animalic Accord',
    top_notes = array['Boozy Vanilla']::text[],
    heart_notes = array['Resin', 'Sandalwood']::text[],
    base_notes = array['Vanilla', 'Animalic Accord']::text[],
    top_notes_en = array['Boozy Vanilla']::text[],
    heart_notes_en = array['Resin', 'Sandalwood']::text[],
    base_notes_en = array['Vanilla', 'Animalic Accord']::text[]
where slug = 'soli-extended-j-adore-la-vanille';

-- J’adore La Vetiver
update public.storefront_products set
    notes = 'Fragrance Notes: Lime, Amberwood F, Vetiver',
    notes_en = 'Fragrance Notes: Lime, Amberwood F, Vetiver',
    top_notes = array['Lime']::text[],
    heart_notes = array['Amberwood F']::text[],
    base_notes = array['Vetiver']::text[],
    top_notes_en = array['Lime']::text[],
    heart_notes_en = array['Amberwood F']::text[],
    base_notes_en = array['Vetiver']::text[]
where slug = 'j-adore-la-vetiver';

-- Jason Voorhees
update public.storefront_products set
    notes = 'Fragrance Notes: Green, Wet Moss, Leather Accord, Smoky Accord, Animalic Accord, Earthy',
    notes_en = 'Fragrance Notes: Green, Wet Moss, Leather Accord, Smoky Accord, Animalic Accord, Earthy',
    top_notes = array['Green', 'Wet Moss']::text[],
    heart_notes = array['Leather Accord', 'Smoky Accord']::text[],
    base_notes = array['Animalic Accord', 'Earthy']::text[],
    top_notes_en = array['Green', 'Wet Moss']::text[],
    heart_notes_en = array['Leather Accord', 'Smoky Accord']::text[],
    base_notes_en = array['Animalic Accord', 'Earthy']::text[],
    description = 'Terinspirasi dari danau dan hutan yang mengelilinginya.

Dibuka hijau dan basah — lumut, kayu lembap, udara setelah hujan. Lalu leather accord dan asap tipis naik pelan, dan di bawahnya animalic accord yang hangat dan gelap.

Aroma untuk malam yang panjang, buat orang yang nggak buru-buru pulang.',
    description_en = 'Inspired by a lake and the forest that closes in around it.

It opens green and wet — moss, damp wood, the air after rain. Then a leather accord and a thin line of smoke rise slowly, and underneath them a warm, dark animalic accord.

A scent for a long night, for someone in no hurry to go home.'
where slug = 'jason-voorhees';

-- Jata Bhumi
update public.storefront_products set
    notes = 'Fragrance Notes: Ozonic, Aquatic, Smoky Accord, Leather Accord, Animalic Accord, Geosmin',
    notes_en = 'Fragrance Notes: Ozonic, Aquatic, Smoky Accord, Leather Accord, Animalic Accord, Geosmin',
    top_notes = array['Ozonic', 'Aquatic']::text[],
    heart_notes = array['Smoky Accord', 'Leather Accord']::text[],
    base_notes = array['Animalic Accord', 'Geosmin']::text[],
    top_notes_en = array['Ozonic', 'Aquatic']::text[],
    heart_notes_en = array['Smoky Accord', 'Leather Accord']::text[],
    base_notes_en = array['Animalic Accord', 'Geosmin']::text[],
    description = 'Bayangin, lo lagi ikut upacara Nadran di Indramayu.

Sesajen dilepas ke laut sebagai penghormatan untuk yang menjaga air. Perahu goyang, asap dupa kebawa angin, dan bau laut nempel di mana-mana.

Jata Bhumi adalah aroma dari atas kapal itu: marine yang asin, asap yang tipis, dan dasar animalik yang dalam di bawahnya.',
    description_en = 'Picture yourself at a Nadran ceremony in Indramayu.

Offerings are released into the sea in honour of whatever keeps the water. The boat rocks, incense smoke drifts on the wind, and the smell of the sea gets into everything.

Jata Bhumi is the scent from the deck of that boat: salt marine, a thin line of smoke, and a deep animalic base underneath.'
where slug = 'jata-bhumi';

-- L’iris
update public.storefront_products set
    notes = 'Fragrance Notes: Iris, Spice, Leather Accord, Orris, Musk Accord, Sandalwood',
    notes_en = 'Fragrance Notes: Iris, Spice, Leather Accord, Orris, Musk Accord, Sandalwood',
    top_notes = array['Iris', 'Spice']::text[],
    heart_notes = array['Leather Accord', 'Orris']::text[],
    base_notes = array['Musk Accord', 'Sandalwood']::text[],
    top_notes_en = array['Iris', 'Spice']::text[],
    heart_notes_en = array['Leather Accord', 'Orris']::text[],
    base_notes_en = array['Musk Accord', 'Sandalwood']::text[],
    description = 'Awalnya powdery. Lama-lama jadi leathery. Vanila, cendana, dan musk yang bertahan.

Wangi yang nggak minta diperhatiin.',
    description_en = 'It opens powdery and turns leathery as it settles. Vanilla, sandalwood and musk are what stay.

A scent that does not ask to be noticed.'
where slug = 'l-iris';

-- La Rose
update public.storefront_products set
    notes = 'Fragrance Notes: Nectar, Rose, Musk Accord',
    notes_en = 'Fragrance Notes: Nectar, Rose, Musk Accord',
    top_notes = array['Nectar']::text[],
    heart_notes = array['Rose']::text[],
    base_notes = array['Musk Accord']::text[],
    top_notes_en = array['Nectar']::text[],
    heart_notes_en = array['Rose']::text[],
    base_notes_en = array['Musk Accord']::text[]
where slug = 'la-rose';

-- La Tulipe
update public.storefront_products set
    notes = 'Fragrance Notes: Muguet, Tulip, Musk Accord',
    notes_en = 'Fragrance Notes: Muguet, Tulip, Musk Accord',
    top_notes = array['Muguet']::text[],
    heart_notes = array['Tulip']::text[],
    base_notes = array['Musk Accord']::text[],
    top_notes_en = array['Muguet']::text[],
    heart_notes_en = array['Tulip']::text[],
    base_notes_en = array['Musk Accord']::text[]
where slug = 'la-tulipe';

-- Lintang Asmoro
update public.storefront_products set
    notes = 'Fragrance Notes: Clean Accord, Aldehydes, Floral, Musk Accord',
    notes_en = 'Fragrance Notes: Clean Accord, Aldehydes, Floral, Musk Accord',
    top_notes = array['Clean Accord', 'Aldehydes']::text[],
    heart_notes = array['Floral']::text[],
    base_notes = array['Musk Accord']::text[],
    top_notes_en = array['Clean Accord', 'Aldehydes']::text[],
    heart_notes_en = array['Floral']::text[],
    base_notes_en = array['Musk Accord']::text[]
where slug = 'lintang-asmoro';

-- Maskumambang
update public.storefront_products set
    notes = 'Fragrance Notes: Jasmine Sambac, Cempaka, Olibanum Boswellia, White Musk Accord, Deer Musk Accord',
    notes_en = 'Fragrance Notes: Jasmine Sambac, Champaca, Olibanum Boswellia, White Musk Accord, Deer Musk Accord',
    top_notes = array['Jasmine Sambac']::text[],
    heart_notes = array['Cempaka', 'Olibanum Boswellia']::text[],
    base_notes = array['White Musk Accord', 'Deer Musk Accord']::text[],
    top_notes_en = array['Jasmine Sambac']::text[],
    heart_notes_en = array['Champaca', 'Olibanum Boswellia']::text[],
    base_notes_en = array['White Musk Accord', 'Deer Musk Accord']::text[]
where slug = 'maskumambang';

-- Pantura
update public.storefront_products set
    notes = 'Fragrance Notes: Orange, Lime, Bergamot, Sea Salt Accord, Green, Solar Note, Floral, Bitter, Smoky Accord, Amber, Amberwood F, Musk Accord',
    notes_en = 'Fragrance Notes: Orange, Lime, Bergamot, Sea Salt Accord, Green, Solar Note, Floral, Bitter, Smoky Accord, Amber, Amberwood F, Musk Accord',
    top_notes = array['Orange', 'Lime', 'Bergamot', 'Sea Salt Accord', 'Green']::text[],
    heart_notes = array['Solar Note', 'Floral', 'Bitter']::text[],
    base_notes = array['Smoky Accord', 'Amber', 'Amberwood F', 'Musk Accord']::text[],
    top_notes_en = array['Orange', 'Lime', 'Bergamot', 'Sea Salt Accord', 'Green']::text[],
    heart_notes_en = array['Solar Note', 'Floral', 'Bitter']::text[],
    base_notes_en = array['Smoky Accord', 'Amber', 'Amberwood F', 'Musk Accord']::text[]
where slug = 'pantura';

-- Patchouli so sexy
update public.storefront_products set
    notes = 'Fragrance Notes: Nilam, Coklat Putih, Amber, Balsamic, Vanilla',
    notes_en = 'Fragrance Notes: Patchouli, White Chocolate, Amber, Balsamic, Vanilla',
    top_notes = array['Nilam', 'Coklat Putih']::text[],
    heart_notes = array['Amber', 'Balsamic']::text[],
    base_notes = array['Vanilla', 'Nilam']::text[],
    top_notes_en = array['Patchouli', 'White Chocolate']::text[],
    heart_notes_en = array['Amber', 'Balsamic']::text[],
    base_notes_en = array['Vanilla', 'Patchouli']::text[]
where slug = 'patchouli-so-sexy';

-- Sudra
update public.storefront_products set
    notes = 'Fragrance Notes: Spice, Green, Rice Note, Cedarwood, Amberwood F',
    notes_en = 'Fragrance Notes: Spice, Green, Rice Note, Cedarwood, Amberwood F',
    top_notes = array['Spice', 'Green']::text[],
    heart_notes = array['Rice Note', 'Cedarwood']::text[],
    base_notes = array['Amberwood F']::text[],
    top_notes_en = array['Spice', 'Green']::text[],
    heart_notes_en = array['Rice Note', 'Cedarwood']::text[],
    base_notes_en = array['Amberwood F']::text[]
where slug = 'sudra';

-- Vanille Planifolia
update public.storefront_products set
    notes = 'Fragrance Notes: Spice, Creamy, Rum, Lily of the Valley, Fruity Note, Musk Accord, Vanilla',
    notes_en = 'Fragrance Notes: Spice, Creamy, Rum, Lily of the Valley, Fruity Note, Musk Accord, Vanilla',
    top_notes = array['Spice', 'Creamy', 'Rum']::text[],
    heart_notes = array['Lily of the Valley', 'Fruity Note']::text[],
    base_notes = array['Musk Accord', 'Vanilla']::text[],
    top_notes_en = array['Spice', 'Creamy', 'Rum']::text[],
    heart_notes_en = array['Lily of the Valley', 'Fruity Note']::text[],
    base_notes_en = array['Musk Accord', 'Vanilla']::text[]
where slug = 'vanille-planifolia';

-- Wongka!
update public.storefront_products set
    notes = 'Fragrance Notes: Fresh, Green, Musk Accord',
    notes_en = 'Fragrance Notes: Fresh, Green, Musk Accord',
    top_notes = array['Fresh']::text[],
    heart_notes = array['Green']::text[],
    base_notes = array['Musk Accord']::text[],
    top_notes_en = array['Fresh']::text[],
    heart_notes_en = array['Green']::text[],
    base_notes_en = array['Musk Accord']::text[]
where slug = 'wongka';

commit;
