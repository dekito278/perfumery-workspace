alter table if exists public.accords
  add column if not exists brief_id uuid;

do $$
declare
  accords_table regclass;
begin
  accords_table := to_regclass('public.accords');

  if accords_table is not null and to_regclass('public.briefs') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'accords_brief_id_fkey'
        and conrelid = accords_table
    ) then
      alter table public.accords
        add constraint accords_brief_id_fkey
        foreign key (brief_id) references public.briefs (id) on delete set null;
    end if;
  end if;
end $$;

do $$
begin
  if to_regclass('public.accords') is not null then
    execute 'create index if not exists accords_brief_id_idx on public.accords (brief_id)';
  end if;
end $$;
