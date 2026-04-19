create table if not exists public.material_reference_abc_families (
    id uuid primary key default gen_random_uuid(),
    letter text not null,
    class_index integer,
    family_name text not null,
    description text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint material_reference_abc_families_letter_not_blank check (char_length(trim(letter)) > 0),
    constraint material_reference_abc_families_family_name_not_blank check (char_length(trim(family_name)) > 0),
    constraint material_reference_abc_families_unique_letter unique (letter),
    constraint material_reference_abc_families_unique_family_name unique (family_name)
);

create table if not exists public.material_reference_profiles (
    id uuid primary key default gen_random_uuid(),
    reference_code text not null,
    name text not null,
    synonym text,
    supplier text,
    abc_code text,
    abc_primary_letter text,
    abc_primary_family text,
    abc_secondary_letter text,
    abc_secondary_family text,
    category text,
    catalog_tag text,
    classification text,
    brief_description text,
    odour_description text,
    odour_profile text,
    perfume_uses text,
    flavour_uses text,
    function_labels text,
    function_raw text,
    order_no text,
    impact numeric(12,2),
    life_hours numeric(12,2),
    use_level_min_percent numeric(8,4),
    use_level_typical_percent numeric(8,4),
    use_level_max_percent numeric(8,4),
    ifra_limit_percent numeric(8,4),
    stability_heat text,
    stability_discolour text,
    stability_storage text,
    stability_antioxidant text,
    stability_summary text,
    physical_state text,
    mol_formula text,
    molecular_weight numeric(12,4),
    cas_no text,
    safety text,
    ifra text,
    pw_price numeric(12,4),
    catalog_price numeric(12,4),
    catalog_available text,
    catalog_unit text,
    source_workbook_path text,
    source_catalog_path text,
    raw_payload jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint material_reference_profiles_reference_code_not_blank check (char_length(trim(reference_code)) > 0),
    constraint material_reference_profiles_name_not_blank check (char_length(trim(name)) > 0),
    constraint material_reference_profiles_unique_reference_code unique (reference_code),
    constraint material_reference_profiles_use_level_min_range check (
        use_level_min_percent is null or (use_level_min_percent >= 0 and use_level_min_percent <= 100)
    ),
    constraint material_reference_profiles_use_level_typical_range check (
        use_level_typical_percent is null or (use_level_typical_percent >= 0 and use_level_typical_percent <= 100)
    ),
    constraint material_reference_profiles_use_level_max_range check (
        use_level_max_percent is null or (use_level_max_percent >= 0 and use_level_max_percent <= 100)
    ),
    constraint material_reference_profiles_ifra_limit_range check (
        ifra_limit_percent is null or (ifra_limit_percent >= 0 and ifra_limit_percent <= 100)
    )
);

create table if not exists public.material_reference_odour_facets (
    id uuid primary key default gen_random_uuid(),
    reference_profile_id uuid not null references public.material_reference_profiles (id) on delete cascade,
    letter text not null,
    family text,
    value numeric(8,2) not null default 0,
    description text,
    sort_order integer not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint material_reference_odour_facets_letter_not_blank check (char_length(trim(letter)) > 0),
    constraint material_reference_odour_facets_value_non_negative check (value >= 0)
);

create table if not exists public.raw_material_reference_links (
    id uuid primary key default gen_random_uuid(),
    raw_material_id uuid not null references public.raw_materials (id) on delete cascade,
    reference_profile_id uuid not null references public.material_reference_profiles (id) on delete cascade,
    match_method text not null default 'manual',
    match_confidence numeric(5,4),
    is_primary boolean not null default true,
    notes text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint raw_material_reference_links_match_confidence_range check (
        match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)
    )
);

create unique index if not exists material_reference_profiles_reference_code_idx
    on public.material_reference_profiles (reference_code);

create index if not exists material_reference_profiles_name_idx
    on public.material_reference_profiles (name);

create index if not exists material_reference_profiles_cas_no_idx
    on public.material_reference_profiles (cas_no);

create index if not exists material_reference_profiles_abc_code_idx
    on public.material_reference_profiles (abc_code);

create index if not exists material_reference_odour_facets_reference_profile_id_idx
    on public.material_reference_odour_facets (reference_profile_id, sort_order);

create unique index if not exists material_reference_odour_facets_unique_profile_letter
    on public.material_reference_odour_facets (reference_profile_id, letter);

create index if not exists raw_material_reference_links_raw_material_id_idx
    on public.raw_material_reference_links (raw_material_id);

create index if not exists raw_material_reference_links_reference_profile_id_idx
    on public.raw_material_reference_links (reference_profile_id);

create unique index if not exists raw_material_reference_links_primary_unique
    on public.raw_material_reference_links (raw_material_id)
    where is_primary = true;

drop trigger if exists material_reference_abc_families_set_updated_at on public.material_reference_abc_families;
create trigger material_reference_abc_families_set_updated_at
before update on public.material_reference_abc_families
for each row
execute function public.set_updated_at();

drop trigger if exists material_reference_profiles_set_updated_at on public.material_reference_profiles;
create trigger material_reference_profiles_set_updated_at
before update on public.material_reference_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists material_reference_odour_facets_set_updated_at on public.material_reference_odour_facets;
create trigger material_reference_odour_facets_set_updated_at
before update on public.material_reference_odour_facets
for each row
execute function public.set_updated_at();

drop trigger if exists raw_material_reference_links_set_updated_at on public.raw_material_reference_links;
create trigger raw_material_reference_links_set_updated_at
before update on public.raw_material_reference_links
for each row
execute function public.set_updated_at();

alter table public.material_reference_abc_families enable row level security;
alter table public.material_reference_profiles enable row level security;
alter table public.material_reference_odour_facets enable row level security;
alter table public.raw_material_reference_links enable row level security;

drop policy if exists "material reference abc families read authenticated" on public.material_reference_abc_families;
create policy "material reference abc families read authenticated"
on public.material_reference_abc_families
for select
to authenticated
using (true);

drop policy if exists "material reference profiles read authenticated" on public.material_reference_profiles;
create policy "material reference profiles read authenticated"
on public.material_reference_profiles
for select
to authenticated
using (true);

drop policy if exists "material reference odour facets read authenticated" on public.material_reference_odour_facets;
create policy "material reference odour facets read authenticated"
on public.material_reference_odour_facets
for select
to authenticated
using (true);

drop policy if exists "raw material reference links select own" on public.raw_material_reference_links;
create policy "raw material reference links select own"
on public.raw_material_reference_links
for select
using (
    exists (
        select 1
        from public.raw_materials
        where raw_materials.id = raw_material_reference_links.raw_material_id
          and raw_materials.user_id = auth.uid()
    )
);

drop policy if exists "raw material reference links insert own" on public.raw_material_reference_links;
create policy "raw material reference links insert own"
on public.raw_material_reference_links
for insert
with check (
    exists (
        select 1
        from public.raw_materials
        where raw_materials.id = raw_material_reference_links.raw_material_id
          and raw_materials.user_id = auth.uid()
    )
);

drop policy if exists "raw material reference links update own" on public.raw_material_reference_links;
create policy "raw material reference links update own"
on public.raw_material_reference_links
for update
using (
    exists (
        select 1
        from public.raw_materials
        where raw_materials.id = raw_material_reference_links.raw_material_id
          and raw_materials.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.raw_materials
        where raw_materials.id = raw_material_reference_links.raw_material_id
          and raw_materials.user_id = auth.uid()
    )
);

drop policy if exists "raw material reference links delete own" on public.raw_material_reference_links;
create policy "raw material reference links delete own"
on public.raw_material_reference_links
for delete
using (
    exists (
        select 1
        from public.raw_materials
        where raw_materials.id = raw_material_reference_links.raw_material_id
          and raw_materials.user_id = auth.uid()
    )
);
