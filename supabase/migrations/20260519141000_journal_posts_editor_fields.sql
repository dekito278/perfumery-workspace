alter table public.journal_posts
    add column if not exists related_formula_id uuid;

alter table public.journal_posts
    drop constraint if exists journal_posts_status_check;

alter table public.journal_posts
    add constraint journal_posts_status_check
    check (status in ('draft', 'published'));

create index if not exists journal_posts_related_formula_id_idx on public.journal_posts (related_formula_id);

do $$
begin
    if to_regclass('public.formulas') is not null then
        if not exists (
            select 1
            from pg_constraint
            where conname = 'journal_posts_related_formula_id_fkey'
              and conrelid = 'public.journal_posts'::regclass
        ) then
            alter table public.journal_posts
                add constraint journal_posts_related_formula_id_fkey
                foreign key (related_formula_id) references public.formulas (id) on delete set null;
        end if;
    end if;
end $$;
