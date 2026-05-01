alter table public.raw_materials
add column if not exists solvent_impact_shift_percent numeric(6,2),
add column if not exists solvent_life_shift_percent numeric(6,2);

alter table public.raw_materials
drop constraint if exists raw_materials_solvent_impact_shift_percent_range;

alter table public.raw_materials
add constraint raw_materials_solvent_impact_shift_percent_range check (
  solvent_impact_shift_percent is null
  or (solvent_impact_shift_percent >= -100 and solvent_impact_shift_percent <= 100)
);

alter table public.raw_materials
drop constraint if exists raw_materials_solvent_life_shift_percent_range;

alter table public.raw_materials
add constraint raw_materials_solvent_life_shift_percent_range check (
  solvent_life_shift_percent is null
  or (solvent_life_shift_percent >= -100 and solvent_life_shift_percent <= 100)
);
