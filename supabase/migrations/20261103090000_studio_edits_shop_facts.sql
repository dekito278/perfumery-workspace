-- Studio edits the shop's own facts, an article's search details, and a perfume's pairings.
--
-- Dekito, 2026-11-02: "cari kolom-kolom yang harusnya bisa saya edit tapi masih statis". Three groups
-- chosen (Fakta toko, Detail artikel, Pasangan produk). Every value here was typed into the code, so
-- only a developer could change it.
--
-- RUN THIS BEFORE the code that writes these columns is merged (#523: code that starts writing a column
-- shipped before the column, and every product save in Studio failed). It is one transaction: if any
-- statement fails, nothing is applied. Safe to run twice.

begin;

-- 1. Shop facts -------------------------------------------------------------------------------------
-- One row, read by every buyer, written only by an admin. The facts are a jsonb object rather than a
-- column each: the code owns the keys and their defaults (today's values), so an empty object means
-- "the shop says exactly what it said before", and adding a fact later needs no migration.
create table if not exists public.storefront_site_settings (
    id text primary key default 'default',
    facts jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint storefront_site_settings_singleton check (id = 'default'),
    constraint storefront_site_settings_facts_is_object check (jsonb_typeof(facts) = 'object')
);

drop trigger if exists storefront_site_settings_set_updated_at on public.storefront_site_settings;
create trigger storefront_site_settings_set_updated_at
before update on public.storefront_site_settings
for each row execute function public.set_updated_at();

alter table public.storefront_site_settings enable row level security;
revoke all on public.storefront_site_settings from anon, authenticated;
grant select on public.storefront_site_settings to anon, authenticated;
grant insert, update on public.storefront_site_settings to authenticated;

-- Written by an admin only — the same gate as every other Studio table since the July lockdown. A
-- signed-in CUSTOMER is also "authenticated", which is why the grant alone is not the gate.
drop policy if exists storefront_site_settings_read on public.storefront_site_settings;
create policy storefront_site_settings_read on public.storefront_site_settings
    for select using (true);
drop policy if exists storefront_site_settings_insert on public.storefront_site_settings;
create policy storefront_site_settings_insert on public.storefront_site_settings
    for insert with check (public.is_admin());
drop policy if exists storefront_site_settings_update on public.storefront_site_settings;
create policy storefront_site_settings_update on public.storefront_site_settings
    for update using (public.is_admin()) with check (public.is_admin());

insert into public.storefront_site_settings (id) values ('default') on conflict (id) do nothing;

-- 2. How many bottles the English shop prices before it asks ---------------------------------------
-- Was SHIPPING_RATE_MAX_BOTTLES = 6 in internationalShippingRates.js. It belongs beside the subsidy and
-- the conversion rate, which Dekito already edits on the export shipping screen.
alter table public.storefront_export_shipping_settings
    add column if not exists max_quoted_bottles integer not null default 6;
alter table public.storefront_export_shipping_settings
    drop constraint if exists storefront_export_shipping_max_quoted_bottles_range;
alter table public.storefront_export_shipping_settings
    add constraint storefront_export_shipping_max_quoted_bottles_range
    check (max_quoted_bottles between 1 and 24);

-- 3. Articles -----------------------------------------------------------------------------------------
-- The search snippet was the excerpt or the title, and the cover had no alt text at all.
alter table public.journal_posts
    add column if not exists seo_description text,
    add column if not exists cover_alt text;

-- The five categories were a CHECK list, so a new one could not exist. Their names now live in the shop
-- facts above; the column only has to hold a well-formed key. Every existing value already does.
alter table public.journal_posts drop constraint if exists journal_posts_category_check;
alter table public.journal_posts
    add constraint journal_posts_category_check
    check (category ~ '^[a-z][a-z0-9_]{0,39}$');

-- 4. "Kamu mungkin suka" pairings ----------------------------------------------------------------------
-- Chosen by Dekito per perfume. Empty means the old rule (same family first) still picks.
alter table public.storefront_products
    add column if not exists related_slugs jsonb not null default '[]'::jsonb;
alter table public.storefront_products drop constraint if exists storefront_products_related_slugs_is_array;
alter table public.storefront_products
    add constraint storefront_products_related_slugs_is_array
    check (jsonb_typeof(related_slugs) = 'array' and jsonb_array_length(related_slugs) <= 12);

-- The buyer's view expands the table's columns when it is CREATED, so a column added afterwards is
-- invisible to every buyer until the view is made again (20261025150000 is the month this cost). Same
-- body as that migration; the new column lands at the end, which CREATE OR REPLACE allows.
create or replace view public.storefront_products_public as
    select (jsonb_populate_record(
        null::public.storefront_products,
        to_jsonb(p) || jsonb_build_object(
            'tags',
            coalesce(
                (select jsonb_agg(tag)
                 from jsonb_array_elements_text(coalesce(p.tags, '[]'::jsonb)) as tag
                 where not public.storefront_product_tag_is_internal(tag)),
                '[]'::jsonb
            )
        )
    )).*
    from public.storefront_products p
    where not public.storefront_product_is_draft(p.tags);

grant select on public.storefront_products_public to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Verify (each must return a row, readable with the anon key — the shop checks these after you run it):
--   select facts from public.storefront_site_settings;
--   select max_quoted_bottles from public.storefront_export_shipping_settings;
--   select seo_description, cover_alt from public.journal_posts limit 1;
--   select related_slugs from public.storefront_products_public limit 1;
--
-- Rollback (only if no code reads these yet):
--   drop table public.storefront_site_settings;
--   alter table public.storefront_export_shipping_settings drop column max_quoted_bottles;
--   alter table public.journal_posts drop column seo_description, drop column cover_alt;
--   -- the category check: restore the five-value list from 20260519142000
--   drop view public.storefront_products_public;  -- it depends on the column
--   alter table public.storefront_products drop column related_slugs;
--   -- then recreate the view and its grant exactly as above
