create table if not exists public.brief_material_shortlists (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    brief_id uuid not null references public.briefs (id) on delete cascade,
    raw_material_id uuid not null references public.raw_materials (id) on delete cascade,
    role text not null default 'candidate' check (role in ('candidate', 'hero', 'support', 'bridge', 'base')),
    note text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint brief_material_shortlists_unique unique (brief_id, raw_material_id)
);

create index if not exists brief_material_shortlists_user_id_idx on public.brief_material_shortlists (user_id);
create index if not exists brief_material_shortlists_brief_id_idx on public.brief_material_shortlists (brief_id);
create index if not exists brief_material_shortlists_raw_material_id_idx on public.brief_material_shortlists (raw_material_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists brief_material_shortlists_set_updated_at on public.brief_material_shortlists;
create trigger brief_material_shortlists_set_updated_at before update on public.brief_material_shortlists for each row execute function public.set_updated_at();

alter table public.brief_material_shortlists enable row level security;

drop policy if exists "brief material shortlists select own" on public.brief_material_shortlists;
create policy "brief material shortlists select own" on public.brief_material_shortlists for select using (auth.uid() = user_id);
drop policy if exists "brief material shortlists insert own" on public.brief_material_shortlists;
create policy "brief material shortlists insert own" on public.brief_material_shortlists for insert with check (auth.uid() = user_id);
drop policy if exists "brief material shortlists update own" on public.brief_material_shortlists;
create policy "brief material shortlists update own" on public.brief_material_shortlists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "brief material shortlists delete own" on public.brief_material_shortlists;
create policy "brief material shortlists delete own" on public.brief_material_shortlists for delete using (auth.uid() = user_id);
