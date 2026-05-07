insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'storefront-product-images',
    'storefront-product-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storefront product images public read" on storage.objects;
create policy "storefront product images public read"
on storage.objects
for select
using (bucket_id = 'storefront-product-images');

drop policy if exists "storefront product images authenticated insert" on storage.objects;
create policy "storefront product images authenticated insert"
on storage.objects
for insert
with check (
    bucket_id = 'storefront-product-images'
    and auth.role() = 'authenticated'
);

drop policy if exists "storefront product images authenticated update" on storage.objects;
create policy "storefront product images authenticated update"
on storage.objects
for update
using (
    bucket_id = 'storefront-product-images'
    and auth.role() = 'authenticated'
)
with check (
    bucket_id = 'storefront-product-images'
    and auth.role() = 'authenticated'
);

drop policy if exists "storefront product images authenticated delete" on storage.objects;
create policy "storefront product images authenticated delete"
on storage.objects
for delete
using (
    bucket_id = 'storefront-product-images'
    and auth.role() = 'authenticated'
);
