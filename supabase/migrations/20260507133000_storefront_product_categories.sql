create table if not exists public.storefront_product_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text,
    accent text,
    sort_order integer not null default 100,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint storefront_product_categories_name_not_blank check (char_length(trim(name)) > 0)
);

create index if not exists storefront_product_categories_sort_idx
    on public.storefront_product_categories (sort_order, name);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists storefront_product_categories_set_updated_at on public.storefront_product_categories;
create trigger storefront_product_categories_set_updated_at
before update on public.storefront_product_categories
for each row
execute function public.set_updated_at();

alter table public.storefront_product_categories enable row level security;

grant select on public.storefront_product_categories to anon, authenticated;
grant insert, update, delete on public.storefront_product_categories to authenticated;

drop policy if exists "storefront product categories public select" on public.storefront_product_categories;
create policy "storefront product categories public select"
on public.storefront_product_categories
for select
using (true);

drop policy if exists "storefront product categories admin insert" on public.storefront_product_categories;
create policy "storefront product categories admin insert"
on public.storefront_product_categories
for insert
with check (auth.role() = 'authenticated');

drop policy if exists "storefront product categories admin update" on public.storefront_product_categories;
create policy "storefront product categories admin update"
on public.storefront_product_categories
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "storefront product categories admin delete" on public.storefront_product_categories;
create policy "storefront product categories admin delete"
on public.storefront_product_categories
for delete
using (auth.role() = 'authenticated');
