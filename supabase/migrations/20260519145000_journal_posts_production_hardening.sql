create index if not exists journal_posts_user_updated_at_idx
    on public.journal_posts (user_id, updated_at desc);

create index if not exists journal_posts_user_status_updated_at_idx
    on public.journal_posts (user_id, status, updated_at desc);

alter table public.journal_posts enable row level security;

drop policy if exists "journal posts select own" on public.journal_posts;
create policy "journal posts select own" on public.journal_posts
    for select using (auth.uid() = user_id);

drop policy if exists "journal posts insert own" on public.journal_posts;
create policy "journal posts insert own" on public.journal_posts
    for insert with check (auth.uid() = user_id);

drop policy if exists "journal posts update own" on public.journal_posts;
create policy "journal posts update own" on public.journal_posts
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "journal posts delete own" on public.journal_posts;
create policy "journal posts delete own" on public.journal_posts
    for delete using (auth.uid() = user_id);

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

        if new.slug = '' then
            new.slug := base_slug || '-' || left(replace(new.id::text, '-', ''), 8);
        end if;
    end if;

    if new.status = 'published' and new.published_at is null then
        new.published_at := timezone('utc', now());
    elsif new.status = 'draft' then
        new.published_at := null;
    end if;

    return new;
end;
$$;

update public.journal_posts
set slug = null
where slug is not null
  and trim(slug) = '';

update public.journal_posts
set slug = slug,
    published_at = published_at
where slug is null
   or trim(slug) = ''
   or (status = 'published' and published_at is null)
   or (status = 'draft' and published_at is not null);

alter table public.journal_posts
    drop constraint if exists journal_posts_slug_not_blank;

alter table public.journal_posts
    add constraint journal_posts_slug_not_blank
    check (slug is null or char_length(trim(slug)) > 0);

alter table public.journal_posts
    drop constraint if exists journal_posts_published_at_matches_status;

alter table public.journal_posts
    add constraint journal_posts_published_at_matches_status
    check (
        (status = 'published' and published_at is not null)
        or (status = 'draft' and published_at is null)
    );

alter table public.journal_posts
    drop constraint if exists journal_posts_seo_title_not_blank;

alter table public.journal_posts
    add constraint journal_posts_seo_title_not_blank
    check (seo_title is null or char_length(trim(seo_title)) > 0);

alter table public.journal_posts
    drop constraint if exists journal_posts_cover_image_url_not_blank;

alter table public.journal_posts
    add constraint journal_posts_cover_image_url_not_blank
    check (cover_image_url is null or char_length(trim(cover_image_url)) > 0);

update public.journal_posts jp
set related_formula_id = null
where related_formula_id is not null
  and not exists (
      select 1
      from public.formulas f
      where f.id = jp.related_formula_id
        and f.user_id = jp.user_id
  );

create or replace function public.enforce_journal_post_related_formula_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.related_formula_id is null then
        return new;
    end if;

    if not exists (
        select 1
        from public.formulas f
        where f.id = new.related_formula_id
          and f.user_id = new.user_id
    ) then
        raise exception 'related_formula_id must reference a formula owned by the same user';
    end if;

    return new;
end;
$$;

drop trigger if exists journal_posts_enforce_related_formula_owner on public.journal_posts;
create trigger journal_posts_enforce_related_formula_owner
before insert or update of related_formula_id, user_id on public.journal_posts
for each row execute function public.enforce_journal_post_related_formula_owner();
