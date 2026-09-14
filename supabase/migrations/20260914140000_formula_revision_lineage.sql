-- Formula lineage: a revision knows its parent.
--
-- MANUAL APPLY. Do not run this from the app.
--
-- The problem: "Create PACED revision" makes a brand new, unrelated formula — name "X PACED", code
-- "X-PACED" — and the only link back to the parent is a sentence inside `notes`. `version` is free text.
-- After three iterations the formula list holds four unconnected rows with no way to see what changed
-- between them. The engine that makes this product worth using produces output the product cannot tidy
-- up.
--
-- Two columns, not a new table. `on delete set null` so deleting a parent does NOT delete its revisions:
-- a revision is work in its own right, it just loses its ancestry.
--
-- SAFE TO DELAY. The app ships knowing these columns may not exist. createFormula() detects 42703
-- (undefined_column), drops the lineage fields and retries, so revisions keep being created exactly as
-- they are today — detached, linked by a notes sentence. The lineage panel simply does not appear. Old
-- formulas (parent_formula_id null) render exactly as they do now either way.

alter table public.formulas
  add column if not exists parent_formula_id uuid references public.formulas(id) on delete set null,
  add column if not exists revision_note text;

create index if not exists formulas_parent_formula_id_idx
  on public.formulas (parent_formula_id)
  where parent_formula_id is not null;

-- RLS: no new policy needed. formulas is already scoped by user_id, and a revision carries the same
-- user_id as its parent because createFormula stamps it from the session. A parent_formula_id pointing
-- at another user's formula would simply read back as null for them — the join is done client-side over
-- rows RLS already returned, never as a privileged lookup.

-- ============================================================================
-- VERIFY — run after applying. Expect two rows, then a count of 0.
-- ============================================================================
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'formulas'
--    and column_name in ('parent_formula_id', 'revision_note')
--  order by column_name;
--
-- -- Nothing should point at a formula that does not exist:
-- select count(*) as dangling_parents
--   from public.formulas f
--   left join public.formulas p on p.id = f.parent_formula_id
--  where f.parent_formula_id is not null and p.id is null;
--
-- -- And nothing should be its own parent:
-- select count(*) as self_parented from public.formulas where parent_formula_id = id;

-- ============================================================================
-- ROLLBACK — restores the previous shape exactly. Losing these columns loses the
-- recorded ancestry, so export it first if any revisions have already been made:
--   select id, name, code, parent_formula_id, revision_note from public.formulas
--    where parent_formula_id is not null;
-- ============================================================================
-- drop index if exists public.formulas_parent_formula_id_idx;
-- alter table public.formulas
--   drop column if exists revision_note,
--   drop column if exists parent_formula_id;
