alter table public.raw_materials
    add column if not exists reference_abc_primary_family text,
    add column if not exists reference_impact numeric(12,2),
    add column if not exists reference_life_hours numeric(12,2),
    add column if not exists reference_use_level_typical_percent numeric(8,4),
    add column if not exists reference_use_level_max_percent numeric(8,4);

alter table public.raw_materials
    drop constraint if exists raw_materials_reference_abc_primary_family_not_blank;

alter table public.raw_materials
    add constraint raw_materials_reference_abc_primary_family_not_blank
    check (
        reference_abc_primary_family is null
        or char_length(trim(reference_abc_primary_family)) > 0
    );

alter table public.raw_materials
    drop constraint if exists raw_materials_reference_impact_non_negative;

alter table public.raw_materials
    add constraint raw_materials_reference_impact_non_negative
    check (
        reference_impact is null
        or reference_impact >= 0
    );

alter table public.raw_materials
    drop constraint if exists raw_materials_reference_life_hours_non_negative;

alter table public.raw_materials
    add constraint raw_materials_reference_life_hours_non_negative
    check (
        reference_life_hours is null
        or reference_life_hours >= 0
    );

alter table public.raw_materials
    drop constraint if exists raw_materials_reference_use_level_typical_percent_range;

alter table public.raw_materials
    add constraint raw_materials_reference_use_level_typical_percent_range
    check (
        reference_use_level_typical_percent is null
        or (
            reference_use_level_typical_percent >= 0
            and reference_use_level_typical_percent <= 100
        )
    );

alter table public.raw_materials
    drop constraint if exists raw_materials_reference_use_level_max_percent_range;

alter table public.raw_materials
    add constraint raw_materials_reference_use_level_max_percent_range
    check (
        reference_use_level_max_percent is null
        or (
            reference_use_level_max_percent >= 0
            and reference_use_level_max_percent <= 100
        )
    );

alter table public.material_reference_profiles
    add column if not exists owner_user_id uuid references auth.users (id) on delete cascade,
    add column if not exists source_kind text not null default 'library',
    add column if not exists source_raw_material_id uuid references public.raw_materials (id) on delete cascade;

update public.material_reference_profiles
set source_kind = 'library'
where source_kind is null;

alter table public.material_reference_profiles
    drop constraint if exists material_reference_profiles_source_kind_check;

alter table public.material_reference_profiles
    add constraint material_reference_profiles_source_kind_check
    check (source_kind in ('library', 'manual'));

alter table public.material_reference_profiles
    drop constraint if exists material_reference_profiles_manual_owner_required;

alter table public.material_reference_profiles
    add constraint material_reference_profiles_manual_owner_required
    check (
        (
            source_kind = 'manual'
            and owner_user_id is not null
            and source_raw_material_id is not null
        )
        or (
            source_kind = 'library'
            and owner_user_id is null
        )
    );

create index if not exists material_reference_profiles_owner_user_id_idx
    on public.material_reference_profiles (owner_user_id);

create index if not exists material_reference_profiles_source_raw_material_id_idx
    on public.material_reference_profiles (source_raw_material_id);

create unique index if not exists material_reference_profiles_manual_source_unique
    on public.material_reference_profiles (source_raw_material_id)
    where source_kind = 'manual';

drop policy if exists "material reference profiles insert own manual" on public.material_reference_profiles;
create policy "material reference profiles insert own manual"
on public.material_reference_profiles
for insert
to authenticated
with check (
    source_kind = 'manual'
    and owner_user_id = auth.uid()
);

drop policy if exists "material reference profiles update own manual" on public.material_reference_profiles;
create policy "material reference profiles update own manual"
on public.material_reference_profiles
for update
to authenticated
using (
    source_kind = 'manual'
    and owner_user_id = auth.uid()
)
with check (
    source_kind = 'manual'
    and owner_user_id = auth.uid()
);

drop policy if exists "material reference profiles delete own manual" on public.material_reference_profiles;
create policy "material reference profiles delete own manual"
on public.material_reference_profiles
for delete
to authenticated
using (
    source_kind = 'manual'
    and owner_user_id = auth.uid()
);
