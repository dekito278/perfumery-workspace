alter table public.journal_posts
    add column if not exists seo_title text,
    add column if not exists cover_image_url text;
