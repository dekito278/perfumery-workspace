-- Tiered pricing, step 1 of the plan: the data it stands on.
--
-- Three decisions from Dekito shape this:
--   * member is automatic once an account is linked; reseller is granted by hand
--   * every price is Rupiah — no second currency
--   * member and reseller are Indonesia only; overseas is one price for everyone
--
-- Retail is NOT stored here. It stays where it already lives, on storefront_products.price_number and
-- inside the variants array, so there is only ever one retail price and a missing tier row falls back to
-- it on its own. A tier table that duplicated retail would drift from it within a week.

-- ---------------------------------------------------------------------------------------------------
-- #1 Which tier a customer is on
-- ---------------------------------------------------------------------------------------------------
alter table public.storefront_customers
    add column if not exists tier text not null default 'retail';

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'storefront_customers_tier_check'
    ) then
        alter table public.storefront_customers
            add constraint storefront_customers_tier_check
            check (tier in ('retail', 'member', 'reseller'));
    end if;
end $$;

comment on column public.storefront_customers.tier is
    'retail | member | reseller. Only ever set to reseller by an admin; member is resolved from having a '
    'linked account, so nothing has to write it. Pinning member here is allowed but not required.';

-- ---------------------------------------------------------------------------------------------------
-- #2 The tier prices themselves
-- ---------------------------------------------------------------------------------------------------
create table if not exists public.storefront_product_prices (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.storefront_products (id) on delete cascade,
    -- '' is the product-level price; otherwise the variant's own id, e.g. '30-ml'.
    variant_id text not null default '',
    tier text not null check (tier in ('member', 'reseller', 'overseas')),
    price_number numeric(12, 0) not null check (price_number >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (product_id, variant_id, tier)
);

create index if not exists storefront_product_prices_product_idx
    on public.storefront_product_prices (product_id);

alter table public.storefront_product_prices enable row level security;

-- Direct reads are admin-only. A buyer never selects from this table; they go through the function
-- below, which hands back only the prices they are entitled to. Reseller prices are commercially
-- sensitive and storefront_products_public is readable by anyone with the anon key.
drop policy if exists "storefront product prices admin select" on public.storefront_product_prices;
create policy "storefront product prices admin select"
    on public.storefront_product_prices
    for select
    using (public.is_admin());

drop policy if exists "storefront product prices admin write" on public.storefront_product_prices;
create policy "storefront product prices admin write"
    on public.storefront_product_prices
    for all
    using (public.is_admin())
    with check (public.is_admin());

-- ---------------------------------------------------------------------------------------------------
-- #3 Which tier the caller is on
-- ---------------------------------------------------------------------------------------------------
-- Resolved from the session, never from anything the browser sends. A buyer cannot claim to be a
-- reseller: the only way to be one is a row an admin wrote.
create or replace function public.storefront_my_price_tier()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select case
        when auth.uid() is null then 'retail'
        else coalesce(
            (select case when c.tier = 'reseller' then 'reseller' else 'member' end
               from public.storefront_customers c
              where c.auth_user_id = auth.uid()
              limit 1),
            -- Signed in but no customer row yet — their first order has not happened. Still a member.
            'member'
        )
    end;
$$;

grant execute on function public.storefront_my_price_tier() to anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- #4 The prices the caller may see
-- ---------------------------------------------------------------------------------------------------
-- Returns the caller's own tier plus 'overseas', which is not a customer tier at all — it is chosen by
-- where the parcel is going, so it is public by design. Reseller prices are returned only to resellers.
create or replace function public.storefront_prices_for_me(p_slugs text[] default null)
returns table (
    slug text,
    variant_id text,
    tier text,
    price_number numeric
)
language sql
stable
security definer
set search_path = public
as $$
    select p.slug, pr.variant_id, pr.tier, pr.price_number
      from public.storefront_product_prices pr
      join public.storefront_products p on p.id = pr.product_id
     where (p_slugs is null or p.slug = any (p_slugs))
       and pr.tier in (public.storefront_my_price_tier(), 'overseas')
       and not public.storefront_product_is_draft(p.tags);
$$;

grant execute on function public.storefront_prices_for_me(text[]) to anon, authenticated;

-- Verify (anon key) — an anonymous caller is retail, and sees no member or reseller price:
--   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/storefront_my_price_tier" -H "apikey: $ANON" \
--        -H "Authorization: Bearer $ANON"            # -> "retail"
--   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/storefront_prices_for_me" -H "apikey: $ANON" \
--        -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{}'
--        # -> only rows with tier 'overseas'
--   curl -s "$SUPABASE_URL/rest/v1/storefront_product_prices?select=*" -H "apikey: $ANON" \
--        -H "Authorization: Bearer $ANON"            # -> [] (RLS)
--
-- Rollback:
--   drop function if exists public.storefront_prices_for_me(text[]);
--   drop function if exists public.storefront_my_price_tier();
--   drop table if exists public.storefront_product_prices;
--   alter table public.storefront_customers drop constraint if exists storefront_customers_tier_check;
--   alter table public.storefront_customers drop column if exists tier;
