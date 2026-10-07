-- The prose says what the notes list says.
--
-- Dekito, 7 Oct 2026: "prosa nya samain jg", after confirming both the oud and the sandalwood are
-- reconstructions and relabelling the pyramids.
--
-- Three descriptions still named those materials the old way while the notes beside them read "Oud
-- Accord" and "Sandalwood Accord". One of them made a claim rather than a description:
--
--     "oud Malinau yang gelap dan berat"   /   "oud Malinau, dark and heavy"
--
-- Malinau is a place in North Kalimantan. Naming it says the oil was distilled there, which is the
-- one thing in all this writing that was not true once the material turned out to be a
-- reconstruction. That is what this migration removes.
--
-- WHAT IT DOES NOT REMOVE. The words cendana and sandalwood, as descriptions of how the perfume
-- smells. "It smells of sandalwood" is an impression and every perfume reader takes it as one; it is
-- not a sourcing claim the way a province name is. They are phrased as a note rather than as the
-- wood itself -- "nada cendana", "a sandalwood note" -- which is the alignment asked for, and the
-- sentences otherwise stay in Dekito's own voice. Rewriting further would be editing his marketing
-- rather than correcting a claim.
--
-- Safe to run twice. To undo: supabase/manual/20261007160000_prose_matches_the_notes.rollback.sql

begin;

update public.storefront_products set
    description = 'Dua hal yang jarang mau duduk berdampingan: tuberose yang mekar penuh, dan oud yang gelap dan berat.

Di awal tuberose bicara lebih dulu, putih, creamy, sedikit memabukkan. Lalu nada cendana dan orris menurunkan suhunya, sampai oud naik dari bawah dan mengambil alih.

Aquilaria tuberosa adalah pertemuan itu: bunga yang tidak mau mengalah, dan kayu yang tidak perlu bicara keras.',
    description_en = 'Two things that rarely sit side by side: tuberose in full bloom, and oud, dark and heavy.

At first the tuberose speaks — white, creamy, slightly intoxicating. Then a sandalwood note and orris bring the temperature down, until the oud rises from underneath and takes over.

Aquilaria tuberosa is that meeting: a flower that will not give way, and a wood that never needs to raise its voice.'
where slug = 'aquilaria-tuberosa';

update public.storefront_products set
    description = 'Sebuah penghormatan untuk vanila.

Bukan vanila manis seperti kue, tapi vanila yang tua. Gelap, resinous, ditemani kemenyan dan nada cendana sampai terasa seperti sesuatu yang dibakar pelan di ruangan tertutup.

Manisnya ada, tapi selalu ditahan.',
    description_en = 'A tribute to vanilla.

Not the sweet vanilla of a cake, but old vanilla. Dark, resinous, kept company by frankincense and a sandalwood note until it smells like something burning slowly in a closed room.

The sweetness is there, but it is always held back.'
where slug = 'soli-extended-j-adore-la-vanille';

update public.storefront_products set
    description = 'Awalnya powdery. Lama-lama jadi leathery. Vanila, nada cendana, dan musk yang bertahan.

Wangi yang nggak minta diperhatiin.',
    description_en = 'It opens powdery and turns leathery as it settles. Vanilla, a sandalwood note and musk are what stay.

A scent that does not ask to be noticed.'
where slug = 'l-iris';

commit;

-- Check:
-- select slug, description, description_en from public.storefront_products
-- where slug in ('aquilaria-tuberosa', 'soli-extended-j-adore-la-vanille', 'l-iris') order by slug;
