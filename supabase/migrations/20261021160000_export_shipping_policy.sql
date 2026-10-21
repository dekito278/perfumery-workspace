-- The two numbers in the international shipping rule that are a DECISION, not arithmetic.
--
-- Dekito's brief, §4, asked for the shipping table to move into an editable screen. He chose to keep the
-- RULE instead (2026-10-21), because a table of country groups by bottle brackets is about sixteen cells
-- and cannot price the 233 destinations the carrier's zone sheet names — the rule already does, and the
-- examples in his own brief (US 1 bottle US$65, Kuwait 2 bottles US$55) are what the rule produces today.
--
-- So what moves here is what he actually decides: how much of the freight the shop carries, and the rate
-- it converts the carrier's rupiah at. The carrier's own sheet stays in exportRates.js, transcribed —
-- that is not a decision anybody makes from a screen.
--
-- READABLE BY ANYONE, on purpose. The storefront cart has to compute the same figure the Studio quote
-- does, and these two numbers are not a secret: the shipping price they produce is printed on the page.
-- What they are NOT is writable by anyone.

create table if not exists public.storefront_export_shipping_settings (
    id text primary key default 'default',
    support_single_usd integer not null default 30 check (support_single_usd >= 0),
    support_multiple_usd integer not null default 50 check (support_multiple_usd >= 0),
    -- Rupiah per dollar for converting the CARRIER's cost. Not the price rate (usdPrice.js keeps its
    -- own, deliberately under market); this one only turns a freight cost into dollars.
    cost_rate_idr integer not null default 18000 check (cost_rate_idr > 0),
    updated_at timestamptz not null default now()
);

alter table public.storefront_export_shipping_settings enable row level security;

drop policy if exists storefront_export_shipping_read on public.storefront_export_shipping_settings;
create policy storefront_export_shipping_read
    on public.storefront_export_shipping_settings for select
    using (true);

drop policy if exists storefront_export_shipping_write on public.storefront_export_shipping_settings;
create policy storefront_export_shipping_write
    on public.storefront_export_shipping_settings for all
    using (public.is_admin())
    with check (public.is_admin());

-- Seeded with what the shop charges TODAY, so applying this migration changes no price. US$30 on a
-- single bottle and US$50 from two, at 18.000 — the figures the live cart is using as this is written.
insert into public.storefront_export_shipping_settings (id, support_single_usd, support_multiple_usd, cost_rate_idr)
values ('default', 30, 50, 18000)
on conflict (id) do nothing;

-- Verify: one row, and the numbers the cart already shows.
select support_single_usd, support_multiple_usd, cost_rate_idr
  from public.storefront_export_shipping_settings where id = 'default';

-- Rollback:
--   drop table if exists public.storefront_export_shipping_settings;
