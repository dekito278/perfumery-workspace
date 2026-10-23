-- Place the 28 materials whose life WAS measured but whose pyramid position was never written down.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor. Deploying the app does not apply it.
--
-- This is not a guess. Dekito's own 549 placed materials that carry a life separate perfectly by that
-- life, with no overlap at all, measured on the live studio 2026-10-24:
--
--     top     n=157    0 - 11 h
--     middle  n=281   12 - 112 h
--     base    n=111  120 - 2000 h
--
-- The intervals are disjoint, so `top if <= 11, base if >= 120, otherwise middle` reproduces 549 of 549
-- of his answers -- 100%, verified by query against the placements he wrote himself. The hours are not a
-- proxy for his rule; they ARE the rule he was already applying.
--
-- WHY IT MATTERS. resolvePyramidPlacement falls back to an inference for every material with no stated
-- position, and that inference agreed with him on 295 of 551 -- 46%. Those placements feed the Top /
-- Middle / Base percentages behind Opening, Heart, Drydown and Tenacity on every formula screen. 144 of
-- 680 formula items were placed by the guess; on GARNET-1 four guessed materials carried 93.3% of the
-- formula's weight.
--
-- WHAT IT LEAVES ALONE, deliberately:
--   * the 551 he has already placed -- `where pyramid_placement is null` never touches a stated answer;
--   * the 195 whose life nobody has recorded. They stay NULL. A material with no measurement has no
--     evidence behind it, and inventing one would be exactly the mistake this file exists to undo;
--   * the 4 materials carrying 0 hours, where 0 may mean "instantly volatile" or may mean "nobody wrote
--     it down". Only one of the four is placed, as a middle. Four rows are a cleanup for your own hands.
--
-- WHAT IT WOULD DO, previewed before writing:
--     base    17   (168 - 750 h)
--     top      7   (4 - 10 h)
--     middle   4   (28 - 100 h)
-- Nothing sits near a boundary: the closest are a 10-hour top against a line at 11, and a 168-hour base
-- against a line at 120.
--
-- Safe to re-run: the WHERE clause empties itself.

begin;

update public.raw_materials
   set pyramid_placement = case
         when reference_life_hours <= 11 then 'top'
         when reference_life_hours >= 120 then 'base'
         else 'middle'
       end
 where pyramid_placement is null
   and reference_life_hours is not null
   and reference_life_hours > 0;

commit;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- -- 1. Nothing is left that has a measured life but no position:
-- select count(*) from public.raw_materials
--  where pyramid_placement is null and reference_life_hours > 0;
--     -> 0
--
-- -- 2. The 195 with no measurement are untouched, and still honestly empty:
-- select count(*) from public.raw_materials
--  where pyramid_placement is null and coalesce(reference_life_hours, 0) = 0;
--     -> 195  (unchanged)
--
-- -- 3. Every placement in the table still agrees with the measured boundaries:
-- select count(*) as total, count(*) filter (
--          where pyramid_placement = case when reference_life_hours <= 11 then 'top'
--                                         when reference_life_hours >= 120 then 'base'
--                                         else 'middle' end) as cocok
--   from public.raw_materials
--  where pyramid_placement is not null and reference_life_hours > 0;
--     -> total 577, cocok 577
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- There is no automatic rollback: before this ran, these 28 were NULL and nothing recorded which 28 they
-- were. To undo it, re-empty exactly the rows this filled -- which is every placed row whose position
-- equals what the boundaries say AND which you have not since edited by hand. Safer, if you want them
-- back, is to take the list first:
--
--   select id, name, reference_life_hours from public.raw_materials
--    where pyramid_placement is null and reference_life_hours > 0;
--
-- Run that BEFORE the update and keep the 28 ids.
