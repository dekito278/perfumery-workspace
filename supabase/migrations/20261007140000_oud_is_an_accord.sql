-- The oud is a reconstruction, so "Oud Accord" is its name.
--
-- Dekito, 7 Oct 2026, asked directly: "oudnya rekontruksi". That settles the one question
-- 20261007093000_fragrance_notes_accord_labels.sql deliberately left open, and it settles it in the
-- direction where the new wording is simply MORE accurate than the old one -- a reconstruction
-- called an accord is a reconstruction described correctly.
--
-- This is the half of Bortnikoff's convention that applies to him. They keep the region name for
-- oil they actually distilled ("Oud Merauke") and a material name for the synthetic ("Oud Co Chang
-- (Feel-oud)"). "Oud Malinau" was the first form for something that is the second.
--
-- A DELTA, not a rerun. The migration above has already been applied to production, so this touches
-- only the two products that name oud: Aquilaria tuberosa ("Oud Malinau") and .Wayback ("Oud").
-- Sandalwood is NOT here -- he answered about the oud, and Santalum album carries no CITES listing,
-- so "Sandalwood Kupang" stays until he says otherwise (supabase/manual/..._sandalwood_is_an_accord.sql).
--
-- Safe to run twice. To undo just this change: supabase/manual/20261007140000_oud_is_an_accord.rollback.sql

begin;

-- These columns are jsonb, so the rename works on the JSON TEXT of each array. Every element is
-- quoted there, and the quotes are what make the match exact: '"Oud"' cannot match inside
-- '"Oud Malinau"', and once Malinau has become Accord the second pass cannot touch it either.
-- The longer name therefore goes first.
update public.storefront_products set
    top_notes      = replace(replace(top_notes::text,      '"Oud Malinau"', '"Oud Accord"'), '"Oud"', '"Oud Accord"')::jsonb,
    heart_notes    = replace(replace(heart_notes::text,    '"Oud Malinau"', '"Oud Accord"'), '"Oud"', '"Oud Accord"')::jsonb,
    base_notes     = replace(replace(base_notes::text,     '"Oud Malinau"', '"Oud Accord"'), '"Oud"', '"Oud Accord"')::jsonb,
    top_notes_en   = replace(replace(top_notes_en::text,   '"Oud Malinau"', '"Oud Accord"'), '"Oud"', '"Oud Accord"')::jsonb,
    heart_notes_en = replace(replace(heart_notes_en::text, '"Oud Malinau"', '"Oud Accord"'), '"Oud"', '"Oud Accord"')::jsonb,
    base_notes_en  = replace(replace(base_notes_en::text,  '"Oud Malinau"', '"Oud Accord"'), '"Oud"', '"Oud Accord"')::jsonb
where slug in ('aquilaria-tuberosa', 'wayback');

-- Then rebuild the notes line FROM the arrays, the way the first migration built it, so the summary
-- and the pyramid cannot drift apart again.
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
where p.slug in ('aquilaria-tuberosa', 'wayback');

commit;

-- The prose on Aquilaria tuberosa still says "oud Malinau" in both languages. Left alone on purpose:
-- it is Dekito's own writing about how the scent behaves, not a material declaration, and rewriting
-- an owner's description is his call rather than a migration's.

-- Check:
-- select slug, notes_en from public.storefront_products
-- where slug in ('aquilaria-tuberosa', 'wayback') order by slug;
