-- Undo 20261007160000_prose_matches_the_notes.sql, and nothing else.
--
-- The exact descriptions as they stood before that migration, read from the live table. Running this
-- puts the provenance claim back, so it is here for completeness rather than as something to reach for.
--
-- Deliberately kept OUT of supabase/migrations/ so no migration run can apply it by accident.

begin;

-- aquilaria-tuberosa
update public.storefront_products set
    description = 'Dua hal yang jarang mau duduk berdampingan: tuberose yang mekar penuh, dan oud Malinau yang gelap dan berat.

Di awal tuberose bicara lebih dulu, putih, creamy, sedikit memabukkan. Lalu cendana dan orris menurunkan suhunya, sampai oud naik dari bawah dan mengambil alih.

Aquilaria tuberosa adalah pertemuan itu: bunga yang tidak mau mengalah, dan kayu yang tidak perlu bicara keras.',
    description_en = 'Two things that rarely sit side by side: tuberose in full bloom, and oud Malinau, dark and heavy.

At first the tuberose speaks — white, creamy, slightly intoxicating. Then sandalwood and orris bring the temperature down, until the oud rises from underneath and takes over.

Aquilaria tuberosa is that meeting: a flower that will not give way, and a wood that never needs to raise its voice.'
where slug = 'aquilaria-tuberosa';

-- l-iris
update public.storefront_products set
    description = 'Awalnya powdery. Lama-lama jadi leathery. Vanila, cendana, dan musk yang bertahan.

Wangi yang nggak minta diperhatiin.',
    description_en = 'It opens powdery and turns leathery as it settles. Vanilla, sandalwood and musk are what stay.

A scent that does not ask to be noticed.'
where slug = 'l-iris';

-- soli-extended-j-adore-la-vanille
update public.storefront_products set
    description = 'Sebuah penghormatan untuk vanila.

Bukan vanila manis seperti kue, tapi vanila yang tua. Gelap, resinous, ditemani kemenyan dan cendana sampai terasa seperti sesuatu yang dibakar pelan di ruangan tertutup.

Manisnya ada, tapi selalu ditahan.',
    description_en = 'A tribute to vanilla.

Not the sweet vanilla of a cake, but old vanilla. Dark, resinous, kept company by frankincense and sandalwood until it smells like something burning slowly in a closed room.

The sweetness is there, but it is always held back.'
where slug = 'soli-extended-j-adore-la-vanille';

commit;
