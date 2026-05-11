insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'storefront-payment-proofs',
    'storefront-payment-proofs',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storefront payment proofs public insert" on storage.objects;
create policy "storefront payment proofs public insert"
on storage.objects
for insert
with check (
    bucket_id = 'storefront-payment-proofs'
    and auth.role() in ('anon', 'authenticated')
);

drop policy if exists "storefront payment proofs admin read" on storage.objects;
create policy "storefront payment proofs admin read"
on storage.objects
for select
using (
    bucket_id = 'storefront-payment-proofs'
    and auth.role() = 'authenticated'
);

drop policy if exists "storefront payment proofs admin update" on storage.objects;
create policy "storefront payment proofs admin update"
on storage.objects
for update
using (
    bucket_id = 'storefront-payment-proofs'
    and auth.role() = 'authenticated'
)
with check (
    bucket_id = 'storefront-payment-proofs'
    and auth.role() = 'authenticated'
);

drop policy if exists "storefront payment proofs admin delete" on storage.objects;
create policy "storefront payment proofs admin delete"
on storage.objects
for delete
using (
    bucket_id = 'storefront-payment-proofs'
    and auth.role() = 'authenticated'
);
