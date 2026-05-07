create table if not exists public.storefront_products (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    category text not null default 'Fresh',
    price_number integer not null default 0,
    size text not null default '30 ml',
    notes text not null,
    top_notes jsonb not null default '[]'::jsonb,
    heart_notes jsonb not null default '[]'::jsonb,
    base_notes jsonb not null default '[]'::jsonb,
    mood text,
    description text,
    concentration text not null default 'Eau de Parfum',
    stock integer not null default 0,
    variants jsonb not null default '[]'::jsonb,
    tags jsonb not null default '[]'::jsonb,
    intensity text,
    featured boolean not null default false,
    popularity integer not null default 70,
    visual text,
    image_url text,
    source text not null default 'custom',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint storefront_products_name_not_blank check (char_length(trim(name)) > 0),
    constraint storefront_products_slug_not_blank check (char_length(trim(slug)) > 0),
    constraint storefront_products_notes_not_blank check (char_length(trim(notes)) > 0),
    constraint storefront_products_price_number_non_negative check (price_number >= 0),
    constraint storefront_products_stock_non_negative check (stock >= 0),
    constraint storefront_products_top_notes_array check (jsonb_typeof(top_notes) = 'array'),
    constraint storefront_products_heart_notes_array check (jsonb_typeof(heart_notes) = 'array'),
    constraint storefront_products_base_notes_array check (jsonb_typeof(base_notes) = 'array'),
    constraint storefront_products_variants_array check (jsonb_typeof(variants) = 'array'),
    constraint storefront_products_tags_array check (jsonb_typeof(tags) = 'array')
);

create index if not exists storefront_products_category_idx
    on public.storefront_products (category);

create index if not exists storefront_products_featured_idx
    on public.storefront_products (featured, popularity desc);

create index if not exists storefront_products_created_at_idx
    on public.storefront_products (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists storefront_products_set_updated_at on public.storefront_products;
create trigger storefront_products_set_updated_at
before update on public.storefront_products
for each row
execute function public.set_updated_at();

alter table public.storefront_products enable row level security;

drop policy if exists "storefront products public select" on public.storefront_products;
create policy "storefront products public select"
on public.storefront_products
for select
using (true);

drop policy if exists "storefront products admin insert" on public.storefront_products;
create policy "storefront products admin insert"
on public.storefront_products
for insert
with check (auth.role() = 'authenticated');

drop policy if exists "storefront products admin update" on public.storefront_products;
create policy "storefront products admin update"
on public.storefront_products
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "storefront products admin delete" on public.storefront_products;
create policy "storefront products admin delete"
on public.storefront_products
for delete
using (auth.role() = 'authenticated');
