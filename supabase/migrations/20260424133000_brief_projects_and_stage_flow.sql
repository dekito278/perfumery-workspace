create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create table if not exists public.brief_projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    brief_id uuid not null references public.briefs (id) on delete cascade,
    status text not null default 'draft' check (status in ('draft', 'in_progress', 'ready_for_accord', 'ready_for_formula', 'validated')),
    current_stage text not null default 'top' check (current_stage in ('top', 'middle', 'base', 'review', 'formula', 'validation')),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint brief_projects_unique_brief unique (brief_id)
);

create table if not exists public.brief_project_stages (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.brief_projects (id) on delete cascade,
    stage text not null check (stage in ('top', 'middle', 'base')),
    status text not null default 'pending' check (status in ('pending', 'in_progress', 'reviewed', 'completed')),
    answers jsonb not null default '{}'::jsonb,
    target_profile jsonb not null default '{}'::jsonb,
    recommendation_note text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint brief_project_stages_unique_stage unique (project_id, stage)
);

create table if not exists public.brief_project_stage_items (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.brief_projects (id) on delete cascade,
    stage text not null check (stage in ('top', 'middle', 'base')),
    raw_material_id uuid not null references public.raw_materials (id) on delete cascade,
    selection_state text not null default 'recommended' check (selection_state in ('recommended', 'selected', 'rejected', 'manual')),
    role text,
    rank_order integer not null default 0,
    fit_score numeric(8, 4),
    primary_function text,
    secondary_function text,
    recommendation_reason text,
    warning text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint brief_project_stage_items_unique unique (project_id, stage, raw_material_id)
);

create index if not exists brief_projects_user_id_idx
    on public.brief_projects (user_id);

create index if not exists brief_projects_brief_id_idx
    on public.brief_projects (brief_id);

create index if not exists brief_project_stages_project_id_idx
    on public.brief_project_stages (project_id);

create index if not exists brief_project_stage_items_project_stage_idx
    on public.brief_project_stage_items (project_id, stage, selection_state);

create index if not exists brief_project_stage_items_raw_material_id_idx
    on public.brief_project_stage_items (raw_material_id);

drop trigger if exists brief_projects_set_updated_at on public.brief_projects;
create trigger brief_projects_set_updated_at
before update on public.brief_projects
for each row
execute function public.set_updated_at();

drop trigger if exists brief_project_stages_set_updated_at on public.brief_project_stages;
create trigger brief_project_stages_set_updated_at
before update on public.brief_project_stages
for each row
execute function public.set_updated_at();

drop trigger if exists brief_project_stage_items_set_updated_at on public.brief_project_stage_items;
create trigger brief_project_stage_items_set_updated_at
before update on public.brief_project_stage_items
for each row
execute function public.set_updated_at();

alter table public.brief_projects enable row level security;
alter table public.brief_project_stages enable row level security;
alter table public.brief_project_stage_items enable row level security;

drop policy if exists "brief projects select own" on public.brief_projects;
create policy "brief projects select own"
on public.brief_projects
for select
using (auth.uid() = user_id);

drop policy if exists "brief projects insert own" on public.brief_projects;
create policy "brief projects insert own"
on public.brief_projects
for insert
with check (auth.uid() = user_id);

drop policy if exists "brief projects update own" on public.brief_projects;
create policy "brief projects update own"
on public.brief_projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "brief projects delete own" on public.brief_projects;
create policy "brief projects delete own"
on public.brief_projects
for delete
using (auth.uid() = user_id);

drop policy if exists "brief project stages select own" on public.brief_project_stages;
create policy "brief project stages select own"
on public.brief_project_stages
for select
using (
    exists (
        select 1
        from public.brief_projects projects
        where projects.id = brief_project_stages.project_id
          and projects.user_id = auth.uid()
    )
);

drop policy if exists "brief project stages insert own" on public.brief_project_stages;
create policy "brief project stages insert own"
on public.brief_project_stages
for insert
with check (
    exists (
        select 1
        from public.brief_projects projects
        where projects.id = brief_project_stages.project_id
          and projects.user_id = auth.uid()
    )
);

drop policy if exists "brief project stages update own" on public.brief_project_stages;
create policy "brief project stages update own"
on public.brief_project_stages
for update
using (
    exists (
        select 1
        from public.brief_projects projects
        where projects.id = brief_project_stages.project_id
          and projects.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.brief_projects projects
        where projects.id = brief_project_stages.project_id
          and projects.user_id = auth.uid()
    )
);

drop policy if exists "brief project stages delete own" on public.brief_project_stages;
create policy "brief project stages delete own"
on public.brief_project_stages
for delete
using (
    exists (
        select 1
        from public.brief_projects projects
        where projects.id = brief_project_stages.project_id
          and projects.user_id = auth.uid()
    )
);

drop policy if exists "brief project stage items select own" on public.brief_project_stage_items;
create policy "brief project stage items select own"
on public.brief_project_stage_items
for select
using (
    exists (
        select 1
        from public.brief_projects projects
        where projects.id = brief_project_stage_items.project_id
          and projects.user_id = auth.uid()
    )
);

drop policy if exists "brief project stage items insert own" on public.brief_project_stage_items;
create policy "brief project stage items insert own"
on public.brief_project_stage_items
for insert
with check (
    exists (
        select 1
        from public.brief_projects projects
        where projects.id = brief_project_stage_items.project_id
          and projects.user_id = auth.uid()
    )
);

drop policy if exists "brief project stage items update own" on public.brief_project_stage_items;
create policy "brief project stage items update own"
on public.brief_project_stage_items
for update
using (
    exists (
        select 1
        from public.brief_projects projects
        where projects.id = brief_project_stage_items.project_id
          and projects.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.brief_projects projects
        where projects.id = brief_project_stage_items.project_id
          and projects.user_id = auth.uid()
    )
);

drop policy if exists "brief project stage items delete own" on public.brief_project_stage_items;
create policy "brief project stage items delete own"
on public.brief_project_stage_items
for delete
using (
    exists (
        select 1
        from public.brief_projects projects
        where projects.id = brief_project_stage_items.project_id
          and projects.user_id = auth.uid()
    )
);

alter table if exists public.accord_items
    add column if not exists stage text;

alter table if exists public.accord_items
    add column if not exists project_role text;

do $$
declare
  accord_items_table regclass;
begin
  accord_items_table := to_regclass('public.accord_items');

  if accord_items_table is not null and not exists (
    select 1
    from pg_constraint
    where conname = 'accord_items_stage_check'
      and conrelid = accord_items_table
  ) then
    alter table public.accord_items
      add constraint accord_items_stage_check
      check (stage is null or stage in ('top', 'middle', 'base'));
  end if;
end $$;

do $$
begin
  if to_regclass('public.accord_items') is not null then
    execute 'create index if not exists accord_items_stage_idx on public.accord_items (accord_id, stage)';
  end if;
end $$;
