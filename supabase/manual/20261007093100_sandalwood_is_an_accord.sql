-- Sandalwood written as an accord.
--
-- RUN THIS ONLY IF THE SANDALWOOD IS A RECONSTRUCTION, NOT DISTILLED OIL.
--
-- The oud is already done: Dekito confirmed on 7 Oct 2026 that his is a reconstruction, and
-- 20261007140000_oud_is_an_accord.sql applied it. He said nothing about the sandalwood, and
-- Santalum album carries no CITES listing, so it was left as written. "Sandalwood Kupang" does name
-- a provenance, which is the only reason this file exists.
--
-- If the material is natural, do not run this: it understates your own product, and it changes
-- nothing about what anyone inspects. What is controlled is the contents of the bottle.
--
-- Deliberately kept OUT of supabase/migrations/ so no migration run can apply it by accident.
-- Safe to run twice.

begin;

-- These columns are jsonb, so the rename works on the JSON TEXT of each array. Every element is
-- quoted in that text, and the quotes are what make the match exact: '"Oud"' cannot match inside
-- '"Oud Malinau"', and once 'Oud Malinau' has become 'Oud Accord' the later '"Oud"' pass cannot
-- touch it either. Order matters, so the longer name goes first.
update public.storefront_products set
    top_notes      = replace(replace(top_notes::text,      '"Sandalwood Kupang"', '"Sandalwood Accord"'), '"Sandalwood"', '"Sandalwood Accord"')::jsonb,
    heart_notes    = replace(replace(heart_notes::text,    '"Sandalwood Kupang"', '"Sandalwood Accord"'), '"Sandalwood"', '"Sandalwood Accord"')::jsonb,
    base_notes     = replace(replace(base_notes::text,     '"Sandalwood Kupang"', '"Sandalwood Accord"'), '"Sandalwood"', '"Sandalwood Accord"')::jsonb,
    top_notes_en   = replace(replace(top_notes_en::text,   '"Sandalwood Kupang"', '"Sandalwood Accord"'), '"Sandalwood"', '"Sandalwood Accord"')::jsonb,
    heart_notes_en = replace(replace(heart_notes_en::text, '"Sandalwood Kupang"', '"Sandalwood Accord"'), '"Sandalwood"', '"Sandalwood Accord"')::jsonb,
    base_notes_en  = replace(replace(base_notes_en::text,  '"Sandalwood Kupang"', '"Sandalwood Accord"'), '"Sandalwood"', '"Sandalwood Accord"')::jsonb
where slug in ('aquilaria-tuberosa', 'l-iris', 'soli-extended-j-adore-la-vanille');

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
where p.slug in ('aquilaria-tuberosa', 'l-iris', 'soli-extended-j-adore-la-vanille');

commit;

-- Check:
-- select slug, notes_en from public.storefront_products
-- where slug in ('aquilaria-tuberosa', 'wayback', 'l-iris', 'soli-extended-j-adore-la-vanille') order by slug;
