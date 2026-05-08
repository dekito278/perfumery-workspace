alter table public.storefront_products
add column if not exists image_urls jsonb not null default '[]'::jsonb;

update public.storefront_products
set image_urls = to_jsonb(array[image_url])
where image_url is not null
  and trim(image_url) <> ''
  and jsonb_array_length(image_urls) = 0;

alter table public.storefront_products
drop constraint if exists storefront_products_image_urls_array;

alter table public.storefront_products
add constraint storefront_products_image_urls_array
check (jsonb_typeof(image_urls) = 'array');
