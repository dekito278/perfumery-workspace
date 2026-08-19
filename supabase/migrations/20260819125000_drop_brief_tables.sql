-- Audit round 8 follow-up — the brief AI module is deleted from the app, so its tables have no reader.
--
-- MANUAL APPLY, AND OPTIONAL: this is the only migration in this repo that DESTROYS data. Nothing forces
-- you to run it. Verified before writing it (2026-08-19, production):
--   briefs                     0 rows
--   brief_projects             0 rows
--   brief_material_shortlists  0 rows
--   brief_ai_interpretations   404 — the table does not exist; migration 20260502120000 was never applied
--
-- Re-check the counts yourself before running this. If any table has grown rows since, STOP and look at
-- why — something is writing to them that this audit did not find:
--   select 'briefs' t, count(*) from public.briefs
--   union all select 'brief_projects', count(*) from public.brief_projects
--   union all select 'brief_project_stages', count(*) from public.brief_project_stages
--   union all select 'brief_project_stage_items', count(*) from public.brief_project_stage_items
--   union all select 'brief_material_shortlists', count(*) from public.brief_material_shortlists;
--
-- Leaving the tables in place costs nothing but clutter, so "do not run this" is a perfectly good answer.
-- The application code is already gone either way.

drop table if exists public.brief_ai_interpretations cascade;
drop table if exists public.brief_project_stage_items cascade;
drop table if exists public.brief_project_stages cascade;
drop table if exists public.brief_projects cascade;
drop table if exists public.brief_material_shortlists cascade;
drop table if exists public.briefs cascade;
