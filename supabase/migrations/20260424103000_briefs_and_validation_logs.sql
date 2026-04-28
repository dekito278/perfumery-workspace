create table if not exists public.briefs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    formula_id uuid,
    title text not null,
    status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
    mood_story text,
    audience_usage text,
    performance_target text,
    budget_direction text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint briefs_title_not_blank check (char_length(trim(title)) > 0)
);

create table if not exists public.validation_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    formula_id uuid not null,
    revision_label text,
    test_type text not null default 'revision' check (test_type in ('blotter', 'skin', 'stability', 'revision', 'other')),
    status text not null default 'logged' check (status in ('logged', 'action_needed', 'approved')),
    note text not null,
    next_action text,
    evaluator_name text,
    tested_at date not null default current_date,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint validation_logs_note_not_blank check (char_length(trim(note)) > 0)
);

create index if not exists briefs_user_id_idx on public.briefs (user_id);
create index if not exists briefs_formula_id_idx on public.briefs (formula_id);
create index if not exists validation_logs_user_id_idx on public.validation_logs (user_id);
create index if not exists validation_logs_formula_id_idx on public.validation_logs (formula_id);
create index if not exists validation_logs_tested_at_idx on public.validation_logs (tested_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists briefs_set_updated_at on public.briefs;
create trigger briefs_set_updated_at before update on public.briefs for each row execute function public.set_updated_at();
drop trigger if exists validation_logs_set_updated_at on public.validation_logs;
create trigger validation_logs_set_updated_at before update on public.validation_logs for each row execute function public.set_updated_at();

do $$
begin
    if to_regclass('public.formulas') is not null then
        if not exists (
            select 1
            from pg_constraint
            where conname = 'briefs_formula_id_fkey'
              and conrelid = 'public.briefs'::regclass
        ) then
            alter table public.briefs
                add constraint briefs_formula_id_fkey
                foreign key (formula_id) references public.formulas (id) on delete set null;
        end if;

        if not exists (
            select 1
            from pg_constraint
            where conname = 'validation_logs_formula_id_fkey'
              and conrelid = 'public.validation_logs'::regclass
        ) then
            alter table public.validation_logs
                add constraint validation_logs_formula_id_fkey
                foreign key (formula_id) references public.formulas (id) on delete cascade;
        end if;
    end if;
end $$;

alter table public.briefs enable row level security;
alter table public.validation_logs enable row level security;

drop policy if exists "briefs select own" on public.briefs;
create policy "briefs select own" on public.briefs for select using (auth.uid() = user_id);
drop policy if exists "briefs insert own" on public.briefs;
create policy "briefs insert own" on public.briefs for insert with check (auth.uid() = user_id);
drop policy if exists "briefs update own" on public.briefs;
create policy "briefs update own" on public.briefs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "briefs delete own" on public.briefs;
create policy "briefs delete own" on public.briefs for delete using (auth.uid() = user_id);

drop policy if exists "validation logs select own" on public.validation_logs;
create policy "validation logs select own" on public.validation_logs for select using (auth.uid() = user_id);
drop policy if exists "validation logs insert own" on public.validation_logs;
create policy "validation logs insert own" on public.validation_logs for insert with check (auth.uid() = user_id);
drop policy if exists "validation logs update own" on public.validation_logs;
create policy "validation logs update own" on public.validation_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "validation logs delete own" on public.validation_logs;
create policy "validation logs delete own" on public.validation_logs for delete using (auth.uid() = user_id);
