alter table public.journal_posts
    add column if not exists slug text,
    add column if not exists published_at timestamptz;

create index if not exists journal_posts_published_at_idx on public.journal_posts (published_at desc);
create unique index if not exists journal_posts_user_slug_idx on public.journal_posts (user_id, slug) where slug is not null;

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

update public.journal_posts
set slug = slug,
    published_at = published_at
where slug is null
   or (status = 'published' and published_at is null)
   or (status = 'draft' and published_at is not null);
