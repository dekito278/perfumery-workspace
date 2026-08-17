-- Finish the job started by 20260715120000/121000.
--
-- Those migrations introduced is_admin() precisely because customer Google login made
-- `auth.role() = 'authenticated'` meaningless as an admin test: a signed-in shopper is
-- 'authenticated' too. They converted the storefront tables, but every storage bucket
-- policy and the product_stories table were left on the old test.
--
-- Worst of these is storefront-payment-proofs. The bucket is private, so RLS on
-- storage.objects is the only thing protecting it, and its policies are *named*
-- "admin read/update/delete" while only checking `authenticated` — so any customer who
-- signs in with Google can read, overwrite and delete every buyer's transfer receipt.
--
-- Public read stays public wherever it already was (product images, bespoke images,
-- site images, product stories are all public buckets serving the storefront), and
-- payment proofs keep their anonymous INSERT: buyers upload a receipt without an
-- account, and submission is gated separately by storefront_submit_payment_proof.
-- Every write path for the other buckets is a studio-only screen (ProductForm,
-- SiteImageManagerPage, MobileBespokeSettingsPage, the story editor), so requiring
-- admin does not touch any public flow.

-- 1) product_stories table -------------------------------------------------------
do $$
begin
  if to_regclass('public.product_stories') is not null then
    execute $q$drop policy if exists "product stories authenticated write" on public.product_stories$q$;
    execute $q$drop policy if exists "product stories admin write" on public.product_stories$q$;
    execute $q$create policy "product stories admin write" on public.product_stories
      for all using (public.is_admin()) with check (public.is_admin())$q$;
  end if;
end;
$$;

-- 2) storage buckets --------------------------------------------------------------
-- Writes become admin-only. Named per bucket so each stays independently readable.
do $$
declare
  bucket_name text;
  policy_prefix text;
  buckets text[][] := array[
    ['storefront-product-images', 'storefront product images'],
    ['storefront-bespoke-images', 'storefront bespoke images'],
    ['site-images', 'storefront site images'],
    ['product-stories', 'product stories media']
  ];
  i int;
begin
  for i in 1 .. array_length(buckets, 1) loop
    bucket_name := buckets[i][1];
    policy_prefix := buckets[i][2];

    -- Drop the permissive originals by their exact historical names.
    execute format('drop policy if exists %I on storage.objects', policy_prefix || ' authenticated insert');
    execute format('drop policy if exists %I on storage.objects', policy_prefix || ' authenticated update');
    execute format('drop policy if exists %I on storage.objects', policy_prefix || ' authenticated delete');
    execute format('drop policy if exists %I on storage.objects', policy_prefix || ' admin insert');
    execute format('drop policy if exists %I on storage.objects', policy_prefix || ' admin update');
    execute format('drop policy if exists %I on storage.objects', policy_prefix || ' admin delete');

    execute format(
      'create policy %I on storage.objects for insert with check (bucket_id = %L and public.is_admin())',
      policy_prefix || ' admin insert', bucket_name);
    execute format(
      'create policy %I on storage.objects for update using (bucket_id = %L and public.is_admin()) with check (bucket_id = %L and public.is_admin())',
      policy_prefix || ' admin update', bucket_name, bucket_name);
    execute format(
      'create policy %I on storage.objects for delete using (bucket_id = %L and public.is_admin())',
      policy_prefix || ' admin delete', bucket_name);
  end loop;
end;
$$;

-- 3) storefront-payment-proofs ----------------------------------------------------
-- Private bucket holding buyers' transfer receipts. Keep the anonymous INSERT (that is
-- how a buyer submits one); make read/update/delete actually mean admin, which is what
-- these policies have always claimed to be.
drop policy if exists "storefront payment proofs admin read" on storage.objects;
create policy "storefront payment proofs admin read"
on storage.objects for select
using (bucket_id = 'storefront-payment-proofs' and public.is_admin());

drop policy if exists "storefront payment proofs admin update" on storage.objects;
create policy "storefront payment proofs admin update"
on storage.objects for update
using (bucket_id = 'storefront-payment-proofs' and public.is_admin())
with check (bucket_id = 'storefront-payment-proofs' and public.is_admin());

drop policy if exists "storefront payment proofs admin delete" on storage.objects;
create policy "storefront payment proofs admin delete"
on storage.objects for delete
using (bucket_id = 'storefront-payment-proofs' and public.is_admin());
