-- The sandalwood is a reconstruction too, so Sandalwood Accord is its name.
--
-- Dekito, 7 Oct 2026: "cendana jg", right after settling the oud the same way. Both materials in
-- Aquilaria tuberosa were named by provenance -- "Oud Malinau", "Sandalwood Kupang" -- for things
-- that have no provenance, and the accord name is the accurate one.
--
-- Santalum album carries no CITES listing, so this was never the urgent half; it sat in
-- supabase/manual/ waiting for a decision rather than for a risk. The decision has been made and
-- applied, so it lives here now: leaving a conditional "run only if..." file in manual/ would tell
-- the next reader it is still open.
--
-- Three products name sandalwood: Aquilaria tuberosa ("Sandalwood Kupang"), L'iris and
-- J'adore la Vanille (plain "Sandalwood").
--
-- Safe to run twice. To undo just this: supabase/manual/20261007150000_sandalwood_is_an_accord.rollback.sql

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
