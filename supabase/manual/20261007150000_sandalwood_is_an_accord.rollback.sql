-- Undo 20261007150000_sandalwood_is_an_accord.sql, and nothing else.
--
-- The full rollback beside this one restores every product to its 2026-10-07 values, which would
-- also throw away the Deer Musk relabelling and the four rewritten descriptions. This one puts back
-- only the three sandalwood names.
--
-- Deliberately kept OUT of supabase/migrations/ so no migration run can apply it by accident.

begin;

-- Aquilaria tuberosa named its provenance; the other two did not.
update public.storefront_products set
    top_notes      = replace(top_notes::text,      '"Sandalwood Accord"', '"Sandalwood Kupang"')::jsonb,
    heart_notes    = replace(heart_notes::text,    '"Sandalwood Accord"', '"Sandalwood Kupang"')::jsonb,
    base_notes     = replace(base_notes::text,     '"Sandalwood Accord"', '"Sandalwood Kupang"')::jsonb,
    top_notes_en   = replace(top_notes_en::text,   '"Sandalwood Accord"', '"Sandalwood Kupang"')::jsonb,
    heart_notes_en = replace(heart_notes_en::text, '"Sandalwood Accord"', '"Sandalwood Kupang"')::jsonb,
    base_notes_en  = replace(base_notes_en::text,  '"Sandalwood Accord"', '"Sandalwood Kupang"')::jsonb
where slug = 'aquilaria-tuberosa';

update public.storefront_products set
    top_notes      = replace(top_notes::text,      '"Sandalwood Accord"', '"Sandalwood"')::jsonb,
    heart_notes    = replace(heart_notes::text,    '"Sandalwood Accord"', '"Sandalwood"')::jsonb,
    base_notes     = replace(base_notes::text,     '"Sandalwood Accord"', '"Sandalwood"')::jsonb,
    top_notes_en   = replace(top_notes_en::text,   '"Sandalwood Accord"', '"Sandalwood"')::jsonb,
    heart_notes_en = replace(heart_notes_en::text, '"Sandalwood Accord"', '"Sandalwood"')::jsonb,
    base_notes_en  = replace(base_notes_en::text,  '"Sandalwood Accord"', '"Sandalwood"')::jsonb
where slug in ('l-iris', 'soli-extended-j-adore-la-vanille');

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
