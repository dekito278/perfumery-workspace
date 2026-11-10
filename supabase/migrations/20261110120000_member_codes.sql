-- Member codes: signing in no longer makes an account a member on its own.
--
-- MANUAL APPLY. Run the whole file once in the Supabase SQL editor. Safe to run twice.
--
-- WHY. Since member prices were filled in on 15 Sep 2026, any Google account was a member the moment it
-- signed in, so nobody paid retail: 0 of the items in the 9 orders that followed. Retail had become a
-- number on the page that nobody was charged. Dekito decided on 10 Nov 2026 who IS a member:
--
--   * an account that redeemed a member code — one per community (Jakarta Fragrance Club, Indramayu
--     Fragrance Club, the card in marketplace parcels, ...), each with its OWN percentage, set in Studio;
--   * an account whose linked customer record has a paid web order ("pernah belanja");
--   * every account that already exists when this runs ("legacy"), so nobody loses a price they have;
--   * a customer an admin set to 'member' by hand, as before. Resellers are unchanged.
--
-- Anyone else who signs in is retail.
--
-- ONE RULE, TWO READERS. storefront_member_status(uuid) is the only place the rule is written. The
-- storefront reads it through storefront_my_price_tier()/storefront_my_member_status() (the caller's own
-- session) and api/orders/create.js reads it with the service-role key for the verified buyer. A buyer
-- shown one price and charged another is the failure this shape exists to prevent.
--
-- SAFE TO DELAY. The app ships first and asks for storefront_my_member_status / storefront_member_status;
-- while they are missing it falls back to the old rule (signed in = member) in BOTH readers, so display
-- and charge keep agreeing. Running this file switches both at the same moment.

begin;

-- 1. The codes ------------------------------------------------------------------------------------------
create table if not exists public.storefront_member_codes (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    code text not null,
    discount_percent numeric(5,2) not null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint storefront_member_codes_name_present check (char_length(btrim(name)) between 1 and 80),
    -- Stored upper-case; the redeem function upper-cases what the buyer types, so case never matters.
    constraint storefront_member_codes_code_shape check (code ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'),
    -- 50 is a typo guard, not a policy: a community discount above half the price is far more likely to be
    -- 15 typed as 51 than a decision. The Studio form says the same before the database has to.
    constraint storefront_member_codes_percent_range check (discount_percent > 0 and discount_percent <= 50)
);

create unique index if not exists storefront_member_codes_code_key on public.storefront_member_codes (code);

-- 2. Who is a member, and through which code ------------------------------------------------------------
-- One row per account. A code that is switched off keeps its members and their percentage: switching a
-- leaked code off stops NEW redemptions, it does not take the price away from people already in the club.
create table if not exists public.storefront_member_accounts (
    auth_user_id uuid primary key references auth.users (id) on delete cascade,
    member_code_id uuid references public.storefront_member_codes (id) on delete set null,
    source text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint storefront_member_accounts_source check (source in ('code', 'legacy'))
);

create index if not exists storefront_member_accounts_code_idx
    on public.storefront_member_accounts (member_code_id);

-- 3. Wrong guesses, for the rate limit. Codes are meant to be easy to say out loud in a group chat, which
-- also makes them easy to guess, so an account gets ten wrong tries an hour.
create table if not exists public.storefront_member_code_attempts (
    id bigint generated always as identity primary key,
    auth_user_id uuid not null,
    attempted_at timestamptz not null default now()
);

create index if not exists storefront_member_code_attempts_account_idx
    on public.storefront_member_code_attempts (auth_user_id, attempted_at desc);

alter table public.storefront_member_codes enable row level security;
alter table public.storefront_member_accounts enable row level security;
alter table public.storefront_member_code_attempts enable row level security;

-- Codes are admin-only to read: a list a buyer could fetch would be a list of discounts to try.
drop policy if exists "storefront member codes admin all" on public.storefront_member_codes;
create policy "storefront member codes admin all" on public.storefront_member_codes
    for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "storefront member accounts admin select" on public.storefront_member_accounts;
create policy "storefront member accounts admin select" on public.storefront_member_accounts
    for select using (public.is_admin());
-- No policy on the attempts table: only the security-definer function below touches it.

-- 4. The rule -------------------------------------------------------------------------------------------
create or replace function public.storefront_member_status(p_auth_user_id uuid)
returns table (tier text, member_percent numeric, code_name text)
language sql
stable
security definer
set search_path = public
as $$
    with account as (
        select k.discount_percent, k.name
          from public.storefront_member_accounts a
          left join public.storefront_member_codes k on k.id = a.member_code_id
         where a.auth_user_id = p_auth_user_id
    ),
    customer as (
        select c.id, c.tier
          from public.storefront_customers c
         where c.auth_user_id = p_auth_user_id
    )
    select
        case
            when p_auth_user_id is null then 'retail'
            when exists (select 1 from customer where customer.tier = 'reseller') then 'reseller'
            when exists (select 1 from account)
              or exists (select 1 from customer where customer.tier = 'member')
              or exists (
                    select 1
                      from public.storefront_orders o
                      join customer on customer.id = o.customer_id
                     where o.payment_status = 'paid'
                       and o.status <> 'cancelled'
                 )
            then 'member'
            else 'retail'
        end,
        (select account.discount_percent from account),
        (select account.name from account);
$$;

-- Anyone's status is not for anyone to ask: only the order endpoint (service role) passes an id.
revoke all on function public.storefront_member_status(uuid) from public, anon, authenticated;
grant execute on function public.storefront_member_status(uuid) to service_role;

-- The caller's own status, for the storefront and the account page.
create or replace function public.storefront_my_member_status()
returns table (tier text, member_percent numeric, code_name text)
language sql
stable
security definer
set search_path = public
as $$
    select s.tier, s.member_percent, s.code_name from public.storefront_member_status(auth.uid()) s;
$$;

grant execute on function public.storefront_my_member_status() to anon, authenticated;

-- Same name and shape as before, so storefront_prices_for_me (which calls it) needs no change.
create or replace function public.storefront_my_price_tier()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select s.tier from public.storefront_member_status(auth.uid()) s;
$$;

grant execute on function public.storefront_my_price_tier() to anon, authenticated;

-- 5. Redeeming a code -----------------------------------------------------------------------------------
-- Answers with a result word instead of raising: a raise would roll back the logged wrong guess, and
-- the rate limit would never count anything.
create or replace function public.storefront_redeem_member_code(p_code text)
returns table (result text, code_name text, member_percent numeric)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    caller uuid := auth.uid();
    wanted text := upper(btrim(coalesce(p_code, '')));
    matched public.storefront_member_codes%rowtype;
    recent_failures integer;
begin
    if caller is null then
        return query select 'signin'::text, null::text, null::numeric;
        return;
    end if;

    select count(*) into recent_failures
      from public.storefront_member_code_attempts t
     where t.auth_user_id = caller
       and t.attempted_at > now() - interval '1 hour';
    if recent_failures >= 10 then
        return query select 'too_many'::text, null::text, null::numeric;
        return;
    end if;

    select * into matched
      from public.storefront_member_codes k
     where k.code = wanted
       and k.active;
    if not found then
        insert into public.storefront_member_code_attempts (auth_user_id) values (caller);
        return query select 'unknown'::text, null::text, null::numeric;
        return;
    end if;

    -- The latest code wins. Holding two codes has no meaning, and the percentage has to come from one.
    insert into public.storefront_member_accounts (auth_user_id, member_code_id, source)
    values (caller, matched.id, 'code')
    on conflict (auth_user_id) do update
        set member_code_id = excluded.member_code_id,
            source = 'code',
            updated_at = now();

    return query select 'ok'::text, matched.name, matched.discount_percent;
end;
$$;

revoke all on function public.storefront_redeem_member_code(text) from public, anon;
grant execute on function public.storefront_redeem_member_code(text) to authenticated;

-- 6. What each code brought in, for Studio. Paid orders count from the moment the account joined.
-- A null member_code_id is the row for members without a code (legacy).
create or replace function public.storefront_member_code_stats()
returns table (member_code_id uuid, accounts bigint, paid_orders bigint)
language sql
stable
security definer
set search_path = public
as $$
    select a.member_code_id,
           count(distinct a.auth_user_id),
           count(distinct o.id)
      from public.storefront_member_accounts a
      left join public.storefront_customers c on c.auth_user_id = a.auth_user_id
      left join public.storefront_orders o
             on o.customer_id = c.id
            and o.payment_status = 'paid'
            and o.status <> 'cancelled'
            and o.created_at >= a.created_at
     where public.is_admin()
     group by a.member_code_id;
$$;

revoke all on function public.storefront_member_code_stats() from public, anon;
grant execute on function public.storefront_member_code_stats() to authenticated;

-- 7. Nobody loses a price they already have ---------------------------------------------------------------
insert into public.storefront_member_accounts (auth_user_id, source)
select u.id, 'legacy' from auth.users u
on conflict (auth_user_id) do nothing;

commit;

-- Verify (read-only), after running:
--   select source, count(*) from public.storefront_member_accounts group by source;
--     -> one 'legacy' row per account that existed before this ran
--   select tier, member_percent, code_name from public.storefront_member_status(null);
--     -> retail, null, null
--   select proname, proacl from pg_proc where proname = 'storefront_member_status';
--     -> service_role only
--
-- Rollback (puts back "signed in = member"):
--   create or replace function public.storefront_my_price_tier() returns text language sql stable
--   security definer set search_path = public as $$
--     select case when auth.uid() is null then 'retail' else coalesce((select case when c.tier = 'reseller'
--     then 'reseller' else 'member' end from public.storefront_customers c where c.auth_user_id = auth.uid()
--     limit 1), 'member') end; $$;
--   drop function if exists public.storefront_my_member_status();
--   drop function if exists public.storefront_member_status(uuid);
--   (api/orders/create.js falls back to the same old rule once storefront_member_status is gone.)
