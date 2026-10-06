-- Oud and sandalwood written as accords.
--
-- RUN THIS ONLY IF THEY ARE RECONSTRUCTIONS, NOT DISTILLED OIL.
--
-- If the materials are natural, this understates your own product, and it changes nothing about what
-- a carrier or a customs officer inspects: what is controlled is the contents of the bottle, not the
-- wording of a web page. For natural material the route is a CITES permit from BKSDA. Bortnikoff --
-- the format this follows -- names its real oud "Oud Merauke", by region, exactly the way
-- "Oud Malinau" reads today, and keeps "(Feel-oud)" for the synthetic.
--
-- Deliberately kept OUT of supabase/migrations/ so that no migration run can apply it by accident.
-- Run it by hand, once, after you have decided. Safe to run twice.

begin;

-- The arrays first, element by element: array_replace matches a whole element, so unlike a string
-- replace it cannot half-rename a note or miss one that sits at the end of the line.
update public.storefront_products set
    top_notes      = array_replace(array_replace(array_replace(array_replace(top_notes,      'Oud Malinau', 'Oud Accord'), 'Oud', 'Oud Accord'), 'Sandalwood Kupang', 'Sandalwood Accord'), 'Sandalwood', 'Sandalwood Accord'),
    heart_notes    = array_replace(array_replace(array_replace(array_replace(heart_notes,    'Oud Malinau', 'Oud Accord'), 'Oud', 'Oud Accord'), 'Sandalwood Kupang', 'Sandalwood Accord'), 'Sandalwood', 'Sandalwood Accord'),
    base_notes     = array_replace(array_replace(array_replace(array_replace(base_notes,     'Oud Malinau', 'Oud Accord'), 'Oud', 'Oud Accord'), 'Sandalwood Kupang', 'Sandalwood Accord'), 'Sandalwood', 'Sandalwood Accord'),
    top_notes_en   = array_replace(array_replace(array_replace(array_replace(top_notes_en,   'Oud Malinau', 'Oud Accord'), 'Oud', 'Oud Accord'), 'Sandalwood Kupang', 'Sandalwood Accord'), 'Sandalwood', 'Sandalwood Accord'),
    heart_notes_en = array_replace(array_replace(array_replace(array_replace(heart_notes_en, 'Oud Malinau', 'Oud Accord'), 'Oud', 'Oud Accord'), 'Sandalwood Kupang', 'Sandalwood Accord'), 'Sandalwood', 'Sandalwood Accord'),
    base_notes_en  = array_replace(array_replace(array_replace(array_replace(base_notes_en,  'Oud Malinau', 'Oud Accord'), 'Oud', 'Oud Accord'), 'Sandalwood Kupang', 'Sandalwood Accord'), 'Sandalwood', 'Sandalwood Accord')
where slug in ('aquilaria-tuberosa', 'wayback', 'l-iris', 'soli-extended-j-adore-la-vanille');

-- Then rebuild the notes line FROM the arrays, the same way the main migration built it, so the
-- summary and the pyramid cannot drift apart again.
update public.storefront_products set
    notes    = 'Fragrance Notes: ' || array_to_string(top_notes    || heart_notes    || base_notes,    ', '),
    notes_en = 'Fragrance Notes: ' || array_to_string(top_notes_en || heart_notes_en || base_notes_en, ', ')
where slug in ('aquilaria-tuberosa', 'wayback', 'l-iris', 'soli-extended-j-adore-la-vanille');

commit;

-- Check:
-- select slug, notes_en from public.storefront_products
-- where slug in ('aquilaria-tuberosa', 'wayback', 'l-iris', 'soli-extended-j-adore-la-vanille') order by slug;
