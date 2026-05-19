create table if not exists public.journal_posts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    title text not null,
    category text not null default 'experience' check (category in ('formula_accord', 'experience', 'material_note', 'process', 'product_idea')),
    status text not null default 'draft' check (status in ('draft', 'published')),
    slug text,
    related_formula_id uuid,
    excerpt text,
    content text,
    seo_title text,
    cover_image_url text,
    tags text[] not null default '{}',
    published_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint journal_posts_title_not_blank check (char_length(trim(title)) > 0)
);

create index if not exists journal_posts_user_id_idx on public.journal_posts (user_id);
create index if not exists journal_posts_status_idx on public.journal_posts (status);
create index if not exists journal_posts_published_at_idx on public.journal_posts (published_at desc);
create index if not exists journal_posts_category_idx on public.journal_posts (category);
create index if not exists journal_posts_related_formula_id_idx on public.journal_posts (related_formula_id);
create index if not exists journal_posts_updated_at_idx on public.journal_posts (updated_at desc);
create unique index if not exists journal_posts_user_slug_idx on public.journal_posts (user_id, slug) where slug is not null;

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

drop trigger if exists journal_posts_set_updated_at on public.journal_posts;
create trigger journal_posts_set_updated_at before update on public.journal_posts for each row execute function public.set_updated_at();

create or replace function public.set_journal_post_share_fields()
returns trigger
language plpgsql
as $$
declare
    base_slug text;
begin
    if new.id is null then
        new.id := gen_random_uuid();
    end if;

    base_slug := lower(regexp_replace(trim(coalesce(new.title, 'journal-note')), '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);

    if base_slug = '' then
        base_slug := 'journal-note';
    end if;

    if new.slug is null or trim(new.slug) = '' then
        new.slug := base_slug || '-' || left(replace(new.id::text, '-', ''), 8);
    else
        new.slug := lower(regexp_replace(trim(new.slug), '[^a-zA-Z0-9]+', '-', 'g'));
        new.slug := trim(both '-' from new.slug);
    end if;

    if new.status = 'published' and new.published_at is null then
        new.published_at := timezone('utc', now());
    elsif new.status = 'draft' then
        new.published_at := null;
    end if;

    return new;
end;
$$;

drop trigger if exists journal_posts_set_share_fields on public.journal_posts;
create trigger journal_posts_set_share_fields before insert or update on public.journal_posts for each row execute function public.set_journal_post_share_fields();

alter table public.journal_posts enable row level security;

drop policy if exists "journal posts select own" on public.journal_posts;
create policy "journal posts select own" on public.journal_posts for select using (auth.uid() = user_id);
drop policy if exists "journal posts insert own" on public.journal_posts;
create policy "journal posts insert own" on public.journal_posts for insert with check (auth.uid() = user_id);
drop policy if exists "journal posts update own" on public.journal_posts;
create policy "journal posts update own" on public.journal_posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "journal posts delete own" on public.journal_posts;
create policy "journal posts delete own" on public.journal_posts for delete using (auth.uid() = user_id);
