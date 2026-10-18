-- IFRA limit 0 means "not recorded", and the column says "0%".
--
-- 76 profiles in material_reference_profiles carry ifra_limit_percent = 0. A real IFRA limit of zero
-- would mean the material may not be used at all, which is not what any of these mean: they are rows
-- the workbook import left blank. 94 other profiles already hold NULL, which is the honest value, so
-- the column currently says two different things with two different values.
--
-- Same defect class as the raw-material fix in this PR: Number(null) is 0, so "nobody filled this in"
-- became a measurement. There it was life_hours, and a material with no recorded longevity was placed
-- at the TOP of the pyramid. Here it is the IFRA ceiling.
--
-- Measured on production 2026-10-18 (read-only): 666 profiles, 76 at exactly 0, 94 already NULL.
--
-- Run it once, by hand. Re-running is harmless: the WHERE clause matches nothing the second time.

-- 1. What it will change, before changing it. Expect 76.
select count(*) as profil_akan_diubah
from public.material_reference_profiles
where ifra_limit_percent = 0;

-- 2. The change.
update public.material_reference_profiles
set ifra_limit_percent = null
where ifra_limit_percent = 0;

-- 3. Proof. Expect 0 rows at zero, and 170 at NULL (94 + 76).
select
  count(*) filter (where ifra_limit_percent = 0) as masih_nol,
  count(*) filter (where ifra_limit_percent is null) as sekarang_null,
  count(*) filter (where ifra_limit_percent > 0) as punya_batas_nyata
from public.material_reference_profiles;
