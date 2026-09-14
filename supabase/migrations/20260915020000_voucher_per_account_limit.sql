-- One-time-per-account voucher codes, for the code printed on the greeting card.
--
-- MANUAL APPLY. Do not run this from the app.
--
-- storefront_vouchers has only a GLOBAL quota (usage_limit_total). A code printed on a card needs a
-- different limit: once per person, however many people hold one. With only the global quota, a code
-- meant as "one free first order each" is either unlimited per person or exhausted by the first buyer
-- who redeems it repeatedly.
--
-- THE RULE THAT MAKES IT WORK, and the reason this is enforced here rather than in the browser:
-- a per-account voucher REFUSES a buyer with no account. An anonymous buyer has no identity to count
-- against, so allowing them would make the limit bypassable by simply not signing in. Refusing is also
-- the point commercially: the card asks people to sign in, which is what the member price is for.
--
-- SAFE TO DELAY. The app ships knowing this may not be applied:
--   * no column -> every voucher reads usage_limit_per_account 0 -> unlimited -> exactly today's behaviour
--   * old function signature -> api/orders/create.js retries without p_auth_user_id and logs it
--   * the Studio field drops out of the write and retries, so vouchers keep saving
-- Nothing changes until it is applied; then the field appears in Studio and the rule takes effect.

begin;

alter table public.storefront_vouchers
    add column if not exists usage_limit_per_account integer not null default 0;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'storefront_vouchers_usage_limit_per_account_non_negative') then
        alter table public.storefront_vouchers
            add constraint storefront_vouchers_usage_limit_per_account_non_negative
            check (usage_limit_per_account >= 0);
    end if;
end $$;

-- Who redeemed. Nullable: anonymous checkouts and every record written before today have no account,
-- and backfilling them with a guess would invent redemptions that never happened.
alter table public.storefront_voucher_usage_records
    add column if not exists auth_user_id uuid;

create index if not exists storefront_voucher_usage_account_idx
    on public.storefront_voucher_usage_records (voucher_code, auth_user_id)
    where auth_user_id is not null;

-- The authority. The per-account count is taken INSIDE the same `for update` lock that already guards the
-- global quota — a read-then-write outside it would let two simultaneous checkouts by one account both
-- pass. Everything above the existing early return is unchanged, so idempotency per order still holds:
-- retrying the same order does not consume a second redemption.
create or replace function public.storefront_record_voucher_usage(
    p_voucher_code text,
    p_order_id uuid default null,
    p_order_number text default null,
    p_amount integer default 1,
    p_auth_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text := upper(regexp_replace(trim(coalesce(p_voucher_code, '')), '\s+', '', 'g'));
    v_amount integer := greatest(coalesce(p_amount, 1), 1);
    v_voucher public.storefront_vouchers%rowtype;
    v_record public.storefront_voucher_usage_records%rowtype;
    v_existing public.storefront_voucher_usage_records%rowtype;
    v_account_used integer;
begin
    if v_code = '' then
        raise exception 'Kode voucher wajib diisi';
    end if;

    select * into v_voucher from public.storefront_vouchers where code = v_code for update;
    if not found then
        raise exception 'Voucher tidak ditemukan';
    end if;

    select * into v_existing
    from public.storefront_voucher_usage_records
    where voucher_code = v_code
      and ((p_order_id is not null and order_id = p_order_id)
        or (coalesce(p_order_number, '') <> '' and order_number = p_order_number))
    limit 1;

    if found then
        return jsonb_build_object('tracked', false, 'already_tracked', true,
            'record', to_jsonb(v_existing), 'voucher', to_jsonb(v_voucher));
    end if;

    if v_voucher.usage_limit_total > 0 and v_voucher.usage_count + v_amount > v_voucher.usage_limit_total then
        raise exception 'Kuota voucher sudah habis';
    end if;

    if v_voucher.usage_limit_per_account > 0 then
        -- No account, no counting. A per-account limit that anonymous buyers can walk past is not a limit.
        if p_auth_user_id is null then
            raise exception 'Voucher % hanya untuk pembeli yang masuk ke akunnya', v_code;
        end if;

        select coalesce(sum(amount), 0) into v_account_used
        from public.storefront_voucher_usage_records
        where voucher_code = v_code and auth_user_id = p_auth_user_id;

        if v_account_used + v_amount > v_voucher.usage_limit_per_account then
            raise exception 'Voucher % sudah dipakai di akun ini', v_code;
        end if;
    end if;

    insert into public.storefront_voucher_usage_records
        (voucher_id, voucher_code, order_id, order_number, amount, auth_user_id)
    values (v_voucher.id, v_code, p_order_id, nullif(trim(coalesce(p_order_number, '')), ''), v_amount, p_auth_user_id)
    returning * into v_record;

    update public.storefront_vouchers
       set usage_count = usage_count + v_amount, updated_at = timezone('utc', now())
     where id = v_voucher.id
    returning * into v_voucher;

    return jsonb_build_object('tracked', true, 'already_tracked', false,
        'record', to_jsonb(v_record), 'voucher', to_jsonb(v_voucher));
end;
$$;

revoke execute on function public.storefront_record_voucher_usage(text, uuid, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.storefront_record_voucher_usage(text, uuid, text, integer, uuid) to service_role;

-- Advisory only, so checkout can say "you have used this" BEFORE the buyer fills the whole form. It reads
-- auth.uid() and nothing else — a caller cannot ask about anyone but themselves, and the function above
-- remains the only thing that decides. Returns 0 for an anonymous caller.
create or replace function public.storefront_voucher_redeemed_by_me(p_code text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(sum(amount), 0)::integer
    from public.storefront_voucher_usage_records
    where auth_user_id = auth.uid()
      and auth.uid() is not null
      and voucher_code = upper(regexp_replace(trim(coalesce(p_code, '')), '\s+', '', 'g'));
$$;

grant execute on function public.storefront_voucher_redeemed_by_me(text) to anon, authenticated, service_role;

commit;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- -- 1. The column exists and defaults to unlimited:
-- select column_name, column_default from information_schema.columns
--  where table_name = 'storefront_vouchers' and column_name = 'usage_limit_per_account';
--
-- -- 2. Old records keep no account, and nothing was invented:
-- select count(*) filter (where auth_user_id is null) as without_account,
--        count(*) filter (where auth_user_id is not null) as with_account
--   from public.storefront_voucher_usage_records;
--
-- -- 3. The advisory RPC tells an anonymous caller nothing (expect 0), with the ANON key:
-- --   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/storefront_voucher_redeemed_by_me" \
-- --     -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"p_code":"KARTU1"}'   -> 0
--
-- -- 4. The authority is still service-role only (expect 42501 with the anon key):
-- --   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/storefront_record_voucher_usage" \
-- --     -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"p_voucher_code":"X"}'
--
-- -- 5. End to end, after making a voucher with usage_limit_per_account = 1:
-- --    sign in, check out with it (succeeds), then try a second order with the same code
-- --    -> refused, "sudah dipakai di akun ini". Signed out -> refused, "hanya untuk pembeli yang masuk".

-- ============================================================================
-- ROLLBACK — restores the 4-argument function and drops the per-account rule.
-- Redemption history is kept; only the limit stops being enforced.
-- ============================================================================
-- begin;
-- drop function if exists public.storefront_voucher_redeemed_by_me(text);
-- drop function if exists public.storefront_record_voucher_usage(text, uuid, text, integer, uuid);
-- -- then re-run the function body from 20260519120000_storefront_vouchers.sql (4 args), and:
-- alter table public.storefront_vouchers drop column if exists usage_limit_per_account;
-- -- keep storefront_voucher_usage_records.auth_user_id: it is history, not configuration.
-- commit;
