with duplicate_published_slugs as (
    select
        id,
        slug,
        row_number() over (
            partition by slug
            order by published_at nulls last, created_at, id
        ) as slug_rank
    from public.journal_posts
    where status = 'published'
      and slug is not null
)
update public.journal_posts jp
set slug = duplicate_published_slugs.slug || '-' || left(replace(jp.id::text, '-', ''), 8)
from duplicate_published_slugs
where jp.id = duplicate_published_slugs.id
  and duplicate_published_slugs.slug_rank > 1;

create unique index if not exists journal_posts_published_slug_idx
    on public.journal_posts (slug)
    where status = 'published' and slug is not null;

drop policy if exists "journal posts select published" on public.journal_posts;
create policy "journal posts select published" on public.journal_posts
    for select using (status = 'published');
