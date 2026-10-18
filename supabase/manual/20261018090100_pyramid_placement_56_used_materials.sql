-- pyramid_placement for the 56 materials a formula actually uses
--
-- 223 of 774 raw materials have no pyramid_placement. 167 of those never appear in any formula, so
-- filling them changes nothing today. These 56 do appear, and the column decides their share of the
-- Top / Middle / Base balance.
--
-- MEASURED, 2026-10-18, read-only. The app's own resolver was run against the 551 materials Dekito has
-- already filled in, with his column held back: it answered all 551 and got 431 right = 78%. Every one
-- of those 551 has a reference profile, so 78% is the accuracy ON MATERIALS WITH A PROFILE and nowhere
-- else.
--
-- BLOCK 1 — 29 materials that have a reference profile.
--   The suggestion carries the measured 78%, so expect roughly 6 of these 29 to be wrong.
--   Run it, then correct the ones you disagree with in the Studio raw-material form.
--
-- BLOCK 2 — 27 materials with NO reference profile and no recorded impact or longevity.
--   The resolver answers 'middle' for all 27 of them, and that is a default, not knowledge: this
--   population has never been in a holdout test, because every material you have filled in has a
--   profile. Before the fix in this PR it answered 'top' for all 27 — Cedarwood texas, sandalwood
--   kupang, BENZOIN F-TEC, Vertofix Coeur, all declared the most volatile thing in the formula.
--   They are listed as comments, not as UPDATEs. Only you can place them.
--
-- legacy_category was tested as a shortcut for Block 2 and rejected: 54% accurate against your own
-- column, where answering 'middle' every time already scores 51%.

-- ============ BLOCK 1: 29 suggestions with a reference profile behind them ============
update public.raw_materials set pyramid_placement = 'base' where id = 'c5a2b879-f267-40ac-81b3-a15a9843add4'; -- Evernyl (10 formula, 11.5%)
update public.raw_materials set pyramid_placement = 'base' where id = 'cbf8b76f-b552-4dc7-a99b-696aadd80bb3'; -- Damascenone (7 formula, 10.37%)
update public.raw_materials set pyramid_placement = 'base' where id = 'be584537-3661-4b41-9b82-18897a9f8b83'; -- Javanol (7 formula, 7.08%)
update public.raw_materials set pyramid_placement = 'top' where id = '3f0d0884-95e7-4bf2-943c-3084856489d9'; -- Liffarome (7 formula, 4.84%)
update public.raw_materials set pyramid_placement = 'base' where id = '5fc19335-230e-4934-a44e-ff2c089851db'; -- Galaxolide 100 (Undiluted) (6 formula, 57.8%)
update public.raw_materials set pyramid_placement = 'base' where id = '93e958e0-709e-4455-9973-57f35ba0a530'; -- Helvetolide (6 formula, 57.62%)
update public.raw_materials set pyramid_placement = 'base' where id = 'ea01d888-7725-4fcc-b708-ab03d5bf71e0'; -- Suederal (6 formula, 12.95%)
update public.raw_materials set pyramid_placement = 'top' where id = 'f4fa97c5-748d-49b7-a7b8-d1a14bdd5d9d'; -- bergamot (5 formula, 35.16%)
update public.raw_materials set pyramid_placement = 'top' where id = '9a730e9e-8dc9-450c-87a5-9cd10f61199d'; -- Manzanate (5 formula, 3%)
update public.raw_materials set pyramid_placement = 'top' where id = '246a1fda-b55e-44d0-ad8b-b9d7ae7fc82b'; -- Pink Pepper Essential Oil (5 formula, 2.83%)
update public.raw_materials set pyramid_placement = 'base' where id = '8272023d-8751-41fd-866d-44fb1d87a1d9'; -- Patchouli Light (4 formula, 36.2%)
update public.raw_materials set pyramid_placement = 'base' where id = 'a8c12167-1152-465b-b498-c44abcdf9cdc'; -- animalis-1745-03 (4 formula, 4%)
update public.raw_materials set pyramid_placement = 'base' where id = '29b95c3d-aa0a-4d0d-ac54-b82147efc201'; -- Geosmin (3 formula, 8.54%)
update public.raw_materials set pyramid_placement = 'base' where id = '84ab84d6-5f6f-40f4-aa58-b4f3aeb21314'; -- Ambrocenide Crystal pure (3 formula, 3.6%)
update public.raw_materials set pyramid_placement = 'top' where id = '53ab958b-33c8-4aa8-a987-6f5f516396de'; -- Methyl Pample Mousse (3 formula, 1.86%)
update public.raw_materials set pyramid_placement = 'top' where id = '4c5f80c2-e0da-4a84-926e-d6cb73bfec06'; -- Cassis Base 345B (Firmenich) (3 formula, 1.1%)
update public.raw_materials set pyramid_placement = 'base' where id = '82f88825-bc9a-408c-8614-b9e75bef7bd8'; -- Molecule 10 (2 formula, 12.7%)
update public.raw_materials set pyramid_placement = 'middle' where id = '1609a040-244b-49d5-94df-b2dbcec461dd'; -- Furaneol (2 formula, 4.67%)
update public.raw_materials set pyramid_placement = 'top' where id = '40c61079-3b7e-44fc-a0a7-518e6a01eba7'; -- Linalool (2 formula, 3.5%)
update public.raw_materials set pyramid_placement = 'base' where id = 'e54938a9-a340-4660-83db-f96ea649622f'; -- Magnolan (2 formula, 1.9%)
update public.raw_materials set pyramid_placement = 'middle' where id = 'b5f47821-7b8a-4c26-8daf-d3883ed6655a'; -- Iso Amyl Iso Valerate (1 formula, 7.33%)
update public.raw_materials set pyramid_placement = 'middle' where id = 'b5a7d668-8e47-4ae5-b462-c9df3f7207ad'; -- Benzyl Alcohol (BA) (1 formula, 3.7%)
update public.raw_materials set pyramid_placement = 'top' where id = '12416d24-f48f-4978-b2b7-cd85c40e4139'; -- Para Anisic Aldehyde (1 formula, 3.7%)
update public.raw_materials set pyramid_placement = 'base' where id = '001d6c7c-6c02-47a2-8abb-8732d18aa47e'; -- hindinol (1 formula, 2.4%)
update public.raw_materials set pyramid_placement = 'middle' where id = '18647bf8-9370-4237-9754-3d4ebcabe3b7'; -- Phenylacetaldehyde 85 / PEA (1 formula, 1.4%)
update public.raw_materials set pyramid_placement = 'base' where id = 'a72323c1-e631-4bf4-b0df-4481e641c334'; -- Amber Accord (1 formula, 0.8%)
update public.raw_materials set pyramid_placement = 'middle' where id = 'db54b3bd-e959-4397-a713-62efeec2c01d'; -- Indolene 50 BB (1 formula, 0.8%)
update public.raw_materials set pyramid_placement = 'middle' where id = '6f0f4c2a-56c2-429f-a350-2b76d3577cc1'; -- 1-Octen 3-One 1-TEC (1 formula, 0.7%)
update public.raw_materials set pyramid_placement = 'middle' where id = 'aa06874c-7e8b-43bc-ad62-39b7b44f6d31'; -- Benzyl Benzoate (BB) (1 formula, 0.4%)

-- Proof for block 1. Expect 29.
select count(*) as terisi_dari_block_1 from public.raw_materials
where pyramid_placement is not null and id in (
  'c5a2b879-f267-40ac-81b3-a15a9843add4',
  'cbf8b76f-b552-4dc7-a99b-696aadd80bb3',
  'be584537-3661-4b41-9b82-18897a9f8b83',
  '3f0d0884-95e7-4bf2-943c-3084856489d9',
  '5fc19335-230e-4934-a44e-ff2c089851db',
  '93e958e0-709e-4455-9973-57f35ba0a530',
  'ea01d888-7725-4fcc-b708-ab03d5bf71e0',
  'f4fa97c5-748d-49b7-a7b8-d1a14bdd5d9d',
  '9a730e9e-8dc9-450c-87a5-9cd10f61199d',
  '246a1fda-b55e-44d0-ad8b-b9d7ae7fc82b',
  '8272023d-8751-41fd-866d-44fb1d87a1d9',
  'a8c12167-1152-465b-b498-c44abcdf9cdc',
  '29b95c3d-aa0a-4d0d-ac54-b82147efc201',
  '84ab84d6-5f6f-40f4-aa58-b4f3aeb21314',
  '53ab958b-33c8-4aa8-a987-6f5f516396de',
  '4c5f80c2-e0da-4a84-926e-d6cb73bfec06',
  '82f88825-bc9a-408c-8614-b9e75bef7bd8',
  '1609a040-244b-49d5-94df-b2dbcec461dd',
  '40c61079-3b7e-44fc-a0a7-518e6a01eba7',
  'e54938a9-a340-4660-83db-f96ea649622f',
  'b5f47821-7b8a-4c26-8daf-d3883ed6655a',
  'b5a7d668-8e47-4ae5-b462-c9df3f7207ad',
  '12416d24-f48f-4978-b2b7-cd85c40e4139',
  '001d6c7c-6c02-47a2-8abb-8732d18aa47e',
  '18647bf8-9370-4237-9754-3d4ebcabe3b7',
  'a72323c1-e631-4bf4-b0df-4481e641c334',
  'db54b3bd-e959-4397-a713-62efeec2c01d',
  '6f0f4c2a-56c2-429f-a350-2b76d3577cc1',
  'aa06874c-7e8b-43bc-ad62-39b7b44f6d31'
);

-- ============ BLOCK 2: 27 that need your judgement — NOT run ============
-- Fill these in the Studio raw-material form (Top / Middle / Base selector), or uncomment and set the
-- value yourself. The placement shown is the resolver's default, with nothing behind it.
-- update public.raw_materials set pyramid_placement = '???' where id = 'a11d1e7d-9ae1-426d-9e19-a26bcb7d9090'; -- isoraldeine95 (4 formula, 95.2%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = 'f6b52e24-fed9-4e5f-ac46-7c73b4d2c3f2'; -- Piperonyl Acetone (2 formula, 24.15%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = 'ec31bf7a-24df-406f-8f65-efe0d98d3b21'; -- Plum Accord (2 formula, 17.74%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = 'ab6b798e-3ea0-46ea-adab-eb69398ef1df'; -- Floral Ozone 10% in Triethyl Citrate (TEC) (2 formula, 10.9%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '0e94ca12-e1d9-4162-a3ce-82576b8987fc'; -- Methyl Cedryl Ketone / Vertofix Coeur (2 formula, 5.5%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = 'c2f71db8-e4d6-4a07-847b-e3238f5cbe5f'; -- Cinnamic Alcohol 10% in Triethyl Citrate (TEC) (2 formula, 3.32%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = 'b099ff4e-7f35-45b9-ade0-28c732a1692b'; -- Benzaldehyde 10% in Triethyl Citrate (TEC) (2 formula, 3.02%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = 'cc9ba2c1-7075-4a40-b849-7da06a65c5e7'; -- Styrallyl acetate (2 formula, 2.3%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = 'aff6636a-d7bb-47ad-aa48-89dc0efd59f5'; -- Rosalis (2 formula, 2%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '0b197d47-0d63-4f96-b626-de5a11b144ca'; -- mocanol (2 formula, 0.7%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '1b252411-a4fc-4ab5-a137-961b44b8edf3'; -- Cedarwood texas (1 formula, 8%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '204e1b14-254b-4dff-862b-a895e014927c'; -- DPG (1 formula, 6%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '3f8522fa-cf9a-4942-bff3-3f3a6424bb0c'; -- kaffir lime (1 formula, 3.2%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '9e722bfb-bbe6-409a-9d81-f27a470f2aa8'; -- molecule 100B (1 formula, 2.4%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '5ac9666c-fb3d-4996-a0c5-9b0d84de5a20'; -- orris givco (1 formula, 2.2%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '83dde36e-66fb-4637-a402-4ae49b47d434'; -- BENZOIN F-TEC (1 formula, 1.5%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = 'bcd0de87-3758-4be2-8b5e-527c1aa7a9c1'; -- molecule 100A (1 formula, 1.1%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '8e165345-0eeb-4e46-99a4-2ab162822330'; -- indocolone (1 formula, 1%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '9add3a4e-9d97-4fd8-96ea-8a11e814a414'; -- Saffranal (1 formula, 0.9%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '44e02b9c-b471-4636-a2f9-a50d7ec79236'; -- malinau resin oud 50% (1 formula, 0.7%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '1432a063-cb34-4b31-b836-3bdc6379fd25'; -- hexyl cinnamaldehyde (1 formula, 0.7%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '4ace3428-7e0e-4569-84fa-616d19f70d1f'; -- Blackcurrant Fleuressence (1 formula, 0.4%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = 'd9233be6-16a3-4a39-8131-962ee19fcddb'; -- florohydral (1 formula, 0.3%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = '07a1a6a7-79a9-4997-9159-d8f79da3da2c'; -- Damascone Delta (1 formula, 0.3%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = 'a46f2b18-fd9c-4947-a0ab-429de184d56c'; -- sandalwood kupang (1 formula, 0.2%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = 'c1758487-08c5-425b-9864-6fa3e7af527f'; -- Clausena/ klausena EO (1 formula, 0.2%) resolver default: middle
-- update public.raw_materials set pyramid_placement = '???' where id = 'a58e9ba5-787f-41af-98ac-6d78307c6f50'; -- kemungkus/cabeb (1 formula, 0.2%) resolver default: middle
