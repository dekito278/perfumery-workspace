create table if not exists public.storefront_bespoke_options (
    id text primary key,
    collection_key text not null,
    label text not null,
    value text not null,
    price integer not null default 0,
    description text,
    image_url text,
    enabled boolean not null default true,
    sort_order integer not null default 100,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint storefront_bespoke_options_collection_key_check check (
        collection_key in ('bottleSizes', 'bottleTypes', 'capDesigns', 'labelDesigns', 'exoticMaterials')
    ),
    constraint storefront_bespoke_options_label_not_blank check (char_length(trim(label)) > 0),
    constraint storefront_bespoke_options_value_not_blank check (char_length(trim(value)) > 0),
    constraint storefront_bespoke_options_price_non_negative check (price >= 0)
);

create index if not exists storefront_bespoke_options_collection_sort_idx
    on public.storefront_bespoke_options (collection_key, sort_order, label);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists storefront_bespoke_options_set_updated_at on public.storefront_bespoke_options;
create trigger storefront_bespoke_options_set_updated_at
before update on public.storefront_bespoke_options
for each row
execute function public.set_updated_at();

alter table public.storefront_bespoke_options enable row level security;

grant select on public.storefront_bespoke_options to anon, authenticated;
grant insert, update, delete on public.storefront_bespoke_options to authenticated;

drop policy if exists "storefront bespoke options public select" on public.storefront_bespoke_options;
create policy "storefront bespoke options public select"
on public.storefront_bespoke_options
for select
using (true);

drop policy if exists "storefront bespoke options admin insert" on public.storefront_bespoke_options;
create policy "storefront bespoke options admin insert"
on public.storefront_bespoke_options
for insert
with check (auth.role() = 'authenticated');

drop policy if exists "storefront bespoke options admin update" on public.storefront_bespoke_options;
create policy "storefront bespoke options admin update"
on public.storefront_bespoke_options
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "storefront bespoke options admin delete" on public.storefront_bespoke_options;
create policy "storefront bespoke options admin delete"
on public.storefront_bespoke_options
for delete
using (auth.role() = 'authenticated');

insert into public.storefront_bespoke_options (
    id,
    collection_key,
    label,
    value,
    price,
    description,
    image_url,
    enabled,
    sort_order
)
values
    ('30-ml', 'bottleSizes', '30 ml', '30 ml', 350000, 'Ukuran default bespoke.', null, true, 10),
    ('50-ml', 'bottleSizes', '50 ml', '50 ml', 500000, 'Ukuran lebih besar untuk pemakaian rutin.', null, true, 20),
    ('classic-clear', 'bottleTypes', 'Classic clear bottle', 'Classic clear bottle', 0, 'Botol kaca bening dengan bentuk clean.', null, true, 10),
    ('square-premium', 'bottleTypes', 'Square premium bottle', 'Square premium bottle', 45000, 'Bentuk kotak yang lebih tegas dan premium.', null, true, 20),
    ('cap-biasa', 'capDesigns', 'Cap biasa', 'Cap biasa', 0, 'Simple, clean, ready stock.', null, true, 10),
    ('cap-batu', 'capDesigns', 'Cap batu', 'Cap batu', 75000, 'Statement cap dengan feel natural stone.', null, true, 20),
    ('cap-custom-akrilik', 'capDesigns', 'Cap custom akrilik', 'Cap custom akrilik', 125000, 'Custom color/form acrylic look.', null, true, 30),
    ('minimal-label', 'labelDesigns', 'Minimal label', 'Minimal label', 0, 'Label clean dengan nama parfum dan detail basic.', null, true, 10),
    ('custom-name-label', 'labelDesigns', 'Custom name label', 'Custom name label', 35000, 'Label dengan nama atau pesan personal.', null, true, 20)
on conflict (id) do nothing;
