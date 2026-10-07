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

-- These columns are jsonb, so the rename works on the JSON TEXT of each array. Every element is
-- quoted in that text, and the quotes are what make the match exact: '"Oud"' cannot match inside
-- '"Oud Malinau"', and once 'Oud Malinau' has become 'Oud Accord' the later '"Oud"' pass cannot
-- touch it either. Order matters, so the longer name goes first.
update public.storefront_products set
    top_notes      = replace(replace(replace(replace(top_notes::text,      '"Oud Malinau"', '"Oud Accord"'), '"Oud"', '"Oud Accord"'), '"Sandalwood Kupang"', '"Sandalwood Accord"'), '"Sandalwood"', '"Sandalwood Accord"')::jsonb,
    heart_notes    = replace(replace(replace(replace(heart_notes::text,    '"Oud Malinau"', '"Oud Accord"'), '"Oud"', '"Oud Accord"'), '"Sandalwood Kupang"', '"Sandalwood Accord"'), '"Sandalwood"', '"Sandalwood Accord"')::jsonb,
    base_notes     = replace(replace(replace(replace(base_notes::text,     '"Oud Malinau"', '"Oud Accord"'), '"Oud"', '"Oud Accord"'), '"Sandalwood Kupang"', '"Sandalwood Accord"'), '"Sandalwood"', '"Sandalwood Accord"')::jsonb,
    top_notes_en   = replace(replace(replace(replace(top_notes_en::text,   '"Oud Malinau"', '"Oud Accord"'), '"Oud"', '"Oud Accord"'), '"Sandalwood Kupang"', '"Sandalwood Accord"'), '"Sandalwood"', '"Sandalwood Accord"')::jsonb,
    heart_notes_en = replace(replace(replace(replace(heart_notes_en::text, '"Oud Malinau"', '"Oud Accord"'), '"Oud"', '"Oud Accord"'), '"Sandalwood Kupang"', '"Sandalwood Accord"'), '"Sandalwood"', '"Sandalwood Accord"')::jsonb,
    base_notes_en  = replace(replace(replace(replace(base_notes_en::text,  '"Oud Malinau"', '"Oud Accord"'), '"Oud"', '"Oud Accord"'), '"Sandalwood Kupang"', '"Sandalwood Accord"'), '"Sandalwood"', '"Sandalwood Accord"')::jsonb
where slug in ('aquilaria-tuberosa', 'wayback', 'l-iris', 'soli-extended-j-adore-la-vanille');

-- Then rebuild the notes line FROM the arrays, the same way the main migration built it, so the
-- summary and the pyramid cannot drift apart again.
update public.storefront_products p set
    notes = 'Fragrance Notes: ' || (
        select string_agg(e.value #>> '{}', ', ' order by e.ord)
        from jsonb_array_elements(coalesce(p.top_notes, '[]'::jsonb) || coalesce(p.heart_notes, '[]'::jsonb) || coalesce(p.base_notes, '[]'::jsonb))
             with ordinality as e(value, ord)
    ),
    notes_en = 'Fragrance Notes: ' || (
        select string_agg(e.value #>> '{}', ', ' order by e.ord)
        from jsonb_array_elements(coalesce(p.top_notes_en, '[]'::jsonb) || coalesce(p.heart_notes_en, '[]'::jsonb) || coalesce(p.base_notes_en, '[]'::jsonb))
             with ordinality as e(value, ord)
    )
where p.slug in ('aquilaria-tuberosa', 'wayback', 'l-iris', 'soli-extended-j-adore-la-vanille');

commit;

-- Check:
-- select slug, notes_en from public.storefront_products
-- where slug in ('aquilaria-tuberosa', 'wayback', 'l-iris', 'soli-extended-j-adore-la-vanille') order by slug;
