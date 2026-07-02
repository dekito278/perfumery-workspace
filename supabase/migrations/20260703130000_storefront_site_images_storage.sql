-- Storage bucket + RLS policies for storefront site images (hero, mood, banner slots
-- managed from the Site Image Manager). The `site-images` bucket was created ad hoc
-- but had no policies migration, so authenticated uploads were blocked by RLS
-- (in Supabase, writes always need a policy even when the bucket is public) —
-- that's why site image upload "didn't work". Idempotent: safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'site-images',
    'site-images',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storefront site images public read" on storage.objects;
create policy "storefront site images public read"
on storage.objects
for select
using (bucket_id = 'site-images');

drop policy if exists "storefront site images authenticated insert" on storage.objects;
create policy "storefront site images authenticated insert"
on storage.objects
for insert
with check (
    bucket_id = 'site-images'
    and auth.role() = 'authenticated'
);

drop policy if exists "storefront site images authenticated update" on storage.objects;
create policy "storefront site images authenticated update"
on storage.objects
for update
using (
    bucket_id = 'site-images'
    and auth.role() = 'authenticated'
)
with check (
    bucket_id = 'site-images'
    and auth.role() = 'authenticated'
);

drop policy if exists "storefront site images authenticated delete" on storage.objects;
create policy "storefront site images authenticated delete"
on storage.objects
for delete
using (
    bucket_id = 'site-images'
    and auth.role() = 'authenticated'
);
