-- Product stories: per-product immersive editorial page data.
-- Each row holds the full story configuration (colors, hero, sections) as JSONB,
-- plus nullable media URLs for hero image override, background music, and video.

create table if not exists product_stories (
    id uuid primary key default gen_random_uuid(),
    product_slug text not null unique,
    enabled boolean not null default true,

    -- Color world
    color_bg text not null default '#1a0f14',
    color_text text not null default '#f5ede4',
    color_accent text not null default '#c4917b',

    -- Hero
    hero_eyebrow text not null default '',
    hero_headline text not null default '',
    hero_headline_script text,
    hero_subtitle text not null default '',

    -- Media
    music_url text,
    music_label text,
    video_url text,
    video_poster_url text,

    -- Editorial sections (array of {type, text, layout, eyebrow, heading, body, image, caption})
    sections jsonb not null default '[]'::jsonb,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_product_stories_slug on product_stories (product_slug);

-- RLS: public read for storefront, authenticated write for studio
alter table product_stories enable row level security;

drop policy if exists "product stories public read" on product_stories;
create policy "product stories public read"
on product_stories for select
using (true);

drop policy if exists "product stories authenticated write" on product_stories;
create policy "product stories authenticated write"
on product_stories for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- Storage bucket for story media (images, audio, video)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'product-stories',
    'product-stories',
    true,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'video/mp4', 'video/webm']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product stories media public read" on storage.objects;
create policy "product stories media public read"
on storage.objects for select
using (bucket_id = 'product-stories');

drop policy if exists "product stories media authenticated insert" on storage.objects;
create policy "product stories media authenticated insert"
on storage.objects for insert
with check (bucket_id = 'product-stories' and auth.role() = 'authenticated');

drop policy if exists "product stories media authenticated update" on storage.objects;
create policy "product stories media authenticated update"
on storage.objects for update
using (bucket_id = 'product-stories' and auth.role() = 'authenticated')
with check (bucket_id = 'product-stories' and auth.role() = 'authenticated');

drop policy if exists "product stories media authenticated delete" on storage.objects;
create policy "product stories media authenticated delete"
on storage.objects for delete
using (bucket_id = 'product-stories' and auth.role() = 'authenticated');
