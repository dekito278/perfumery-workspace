create table if not exists public.storefront_shipping_promotion_settings (
    id text primary key default 'default',
    enabled boolean not null default false,
    preset text not null default 'free_java_discount_other',
    java_amount integer not null default 10000,
    other_amount integer not null default 10000,
    minimum_subtotal integer not null default 0,
    starts_at date,
    ends_at date,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint storefront_shipping_promotion_singleton check (id = 'default'),
    constraint storefront_shipping_promotion_preset_check check (
        preset in (
            'free_java',
            'free_java_discount_other',
            'flat_java',
            'flat_java_discount_other',
            'free_all',
            'discount_all'
        )
    ),
    constraint storefront_shipping_promotion_java_amount_non_negative check (java_amount >= 0),
    constraint storefront_shipping_promotion_other_amount_non_negative check (other_amount >= 0),
    constraint storefront_shipping_promotion_minimum_subtotal_non_negative check (minimum_subtotal >= 0),
    constraint storefront_shipping_promotion_period_check check (starts_at is null or ends_at is null or starts_at <= ends_at)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists storefront_shipping_promotion_settings_set_updated_at on public.storefront_shipping_promotion_settings;
create trigger storefront_shipping_promotion_settings_set_updated_at
before update on public.storefront_shipping_promotion_settings
for each row
execute function public.set_updated_at();

alter table public.storefront_shipping_promotion_settings enable row level security;

grant select on public.storefront_shipping_promotion_settings to anon, authenticated;
grant insert, update, delete on public.storefront_shipping_promotion_settings to authenticated;

drop policy if exists "storefront shipping promotion public select" on public.storefront_shipping_promotion_settings;
create policy "storefront shipping promotion public select"
on public.storefront_shipping_promotion_settings
for select
using (true);

drop policy if exists "storefront shipping promotion admin insert" on public.storefront_shipping_promotion_settings;
create policy "storefront shipping promotion admin insert"
on public.storefront_shipping_promotion_settings
for insert
with check (auth.role() = 'authenticated');

drop policy if exists "storefront shipping promotion admin update" on public.storefront_shipping_promotion_settings;
create policy "storefront shipping promotion admin update"
on public.storefront_shipping_promotion_settings
for update
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

drop policy if exists "storefront shipping promotion admin delete" on public.storefront_shipping_promotion_settings;
create policy "storefront shipping promotion admin delete"
on public.storefront_shipping_promotion_settings
for delete
using (auth.role() = 'authenticated');
