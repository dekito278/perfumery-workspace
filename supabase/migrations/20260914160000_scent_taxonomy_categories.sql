-- Raw material classification: PerfumersWorld A-Z (26) -> Ecofragrantica grandfamilies (11).
--
-- MANUAL APPLY. Do not run this from the app. Read the whole file first — this one rewrites data.
--
-- Dekito's decision, 2026-09-14. The A-Z table in workbookAbcClassification.js is NOT affected: that is
-- how the reference workbook DESCRIBES a material, and the seeded reference data speaks it. What changes
-- is the shelf a material sits on.
--
-- THIS IS LOSSY BY DESIGN. Iris, Jasmin, Muguet, Narcotic, Orchid, Rose and Light Chemical Floral all
-- become Floral. You cannot get back from "Floral" to "Rose".
--
-- So the old value is KEPT, in raw_materials.legacy_category. That column is what makes the rollback at
-- the bottom exact rather than approximate, and it is why this is safe to apply. Do not drop it until
-- you are certain you will never want the A-Z filing back.
--
-- The 26 -> 11 map below was checked against the materials actually sitting under each letter in the
-- seeded reference data, not taken on faith. The letters most easily got wrong:
--   A  Lauric Acid, Aldehyde C-11, Dodecyl Nitrile     -> Mineral        (Aldehydic is a Mineral subfamily)
--   B  Peppermint, Camphor, Borneol, Rosemary          -> Herbal         (Minty, Camphoraceous)
--   D  Octalactone, Delta Decalactone, Nonalactone     -> Sweet/Balsamic (Lactonic is a subfamily)
--   E  Coffee, 2-Acetyl Thiazole, Ethyl Safranate      -> Soulful        (roasted, savoury)
--   S  Turmeric, Ginger, Cassia, Myrcene               -> Woody          (Spicy is a Woody subfamily)
--   Y  Treemoss, Seaweed, Ozone                        -> Mineral        (Marine, Ozonic)
--
-- SAFE TO DELAY. The app already ships reading BOTH vocabularies: a material still on "k - konifer"
-- displays as Woody and keeps a working dropdown, and the Remap dialog offers the same mapping one
-- material at a time. Nothing breaks while this sits unapplied; it only stays messy.

-- 1. Somewhere to put the old value. Idempotent, so re-running is harmless.
alter table public.raw_materials
  add column if not exists legacy_category text;

-- 2. Preserve, but never overwrite a preserved value — re-running must not turn legacy_category into a
--    copy of the already-migrated category.
update public.raw_materials
   set legacy_category = category
 where legacy_category is null
   and category is not null;

-- 3. Move each material onto its grandfamily. Matched on the stored label, lower-cased, exactly as the
--    app writes it. Anything that matches nothing is LEFT ALONE rather than guessed at.
update public.raw_materials m
   set category = t.grandfamily
  from (values
    ('a - ali-fat-ic',              'Mineral'),
    ('b - berg-iceberg',            'Herbal'),
    ('c - citrus',                  'Citrus'),
    ('d - dairy',                   'Sweet/Balsamic'),
    ('e - edible',                  'Soulful'),
    ('f - fruit',                   'Fruity'),
    ('g - green',                   'Green'),
    ('h - herb (cool)',             'Herbal'),
    ('i - iris',                    'Floral'),
    ('j - jasmin',                  'Floral'),
    ('k - konifer',                 'Woody'),
    ('l - light chemical floral',   'Floral'),
    ('m - muguet',                  'Floral'),
    ('n - narcotic',                'Floral'),
    ('o - orchid',                  'Floral'),
    ('p - phenol',                  'Industrial'),
    ('q - queen of the orient',     'Sweet/Balsamic'),
    ('r - rose',                    'Floral'),
    ('s - spice (hot)',             'Woody'),
    ('t - tar smoke',               'Woody'),
    ('u - urine faecal animal',     'Animalic'),
    ('v - vanilla',                 'Sweet/Balsamic'),
    ('w - wood',                    'Woody'),
    ('x - x-rated musk',            'Animalic'),
    ('y - earthy mossy',            'Mineral'),
    ('z - zolvents',                'Industrial')
  ) as t(legacy, grandfamily)
 where lower(trim(m.category)) = t.legacy;

-- 4. Remove the A-Z category rows, but ONLY where nothing points at them any more. A row still in use
--    stays, and its material keeps a working dropdown.
delete from public.raw_material_categories c
 where lower(trim(c.name)) in (
        'a - ali-fat-ic', 'b - berg-iceberg', 'c - citrus', 'd - dairy', 'e - edible', 'f - fruit',
        'g - green', 'h - herb (cool)', 'i - iris', 'j - jasmin', 'k - konifer',
        'l - light chemical floral', 'm - muguet', 'n - narcotic', 'o - orchid', 'p - phenol',
        'q - queen of the orient', 'r - rose', 's - spice (hot)', 't - tar smoke',
        'u - urine faecal animal', 'v - vanilla', 'w - wood', 'x - x-rated musk',
        'y - earthy mossy', 'z - zolvents')
   and not exists (
        select 1 from public.raw_materials m
         where m.user_id = c.user_id
           and lower(trim(m.category)) = lower(trim(c.name)));

-- The 11 grandfamily rows are NOT inserted here. The app seeds them per user on the next load of the
-- materials page (synchronizeScentTaxonomyCategories), which stamps the right user_id without this
-- migration having to guess at one.

-- ============================================================================
-- VERIFY — run after applying.
-- ============================================================================
-- -- Nothing should still be filed under an A-Z label:
-- select category, count(*) from public.raw_materials
--  where category ilike '_ - %' group by category order by 2 desc;
--
-- -- Every material that had a category must have kept a copy of the old one:
-- select count(*) as lost_originals from public.raw_materials
--  where category is not null and legacy_category is null;
--
-- -- What moved where, to eyeball the merges:
-- select legacy_category, category, count(*) from public.raw_materials
--  where legacy_category is distinct from category
--  group by 1, 2 order by 3 desc;

-- ============================================================================
-- ROLLBACK — exact, because legacy_category kept the original.
-- ============================================================================
-- update public.raw_materials
--    set category = legacy_category
--  where legacy_category is not null;
--
-- -- The A-Z category rows are re-seeded by the app itself once the code is reverted. Only drop the
-- -- column after you have confirmed the categories came back:
-- -- alter table public.raw_materials drop column if exists legacy_category;
