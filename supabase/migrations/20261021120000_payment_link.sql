-- /pay/<token> — the payment instructions for one order, opened without logging in.
--
-- Dekito's October 2026 brief, §6. Three orders stalled at the payment step in a month because the
-- instructions were retyped by hand every time: Wise asks for an email, his Wise account cannot receive
-- funds, a US bank will not wire to a personal account. The page says it once, per order, correctly.
--
-- WHY A TOKEN AND NOT THE ORDER NUMBER: DKT-MPGB5BF0 is printed on every invoice and quoted in every
-- WhatsApp thread, and it is short enough to walk. A page keyed on it would hand a stranger the amount
-- due on anybody's order. 160 bits of random, generated in the browser that creates the order.
--
-- WHAT THE FUNCTION RETURNS, and what it refuses to: the order number, what is owed, the currency and
-- the method. NOT the customer's name, contact or address. A link that leaks is then worth an amount and
-- an order number, not a person — and those two are on the invoice the buyer already holds.
--
-- IT STOPS ANSWERING once the order is paid or cancelled, which is the brief's expiry rule. A link that
-- keeps working after the money arrives is an invitation to pay twice.

alter table public.storefront_orders
    add column if not exists payment_token text;

-- Unique where present. A partial index rather than a plain unique constraint: every order written
-- before this migration has NULL here, and in Postgres NULLs are distinct — but saying so explicitly is
-- how the intent survives someone reading only the index list.
create unique index if not exists storefront_orders_payment_token_key
    on public.storefront_orders (payment_token)
    where payment_token is not null;

-- The whole point of the column is that it is hard to guess, so anything shorter than the generator
-- produces is a bug somewhere upstream rather than a short link.
alter table public.storefront_orders
    drop constraint if exists storefront_orders_payment_token_len;
alter table public.storefront_orders
    add constraint storefront_orders_payment_token_len
    check (payment_token is null or char_length(payment_token) >= 26);

create or replace function public.storefront_payment_link(p_token text)
returns table (
    order_number text,
    subtotal numeric,
    payment_status text,
    payment_provider text,
    status text,
    created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
    select o.order_number, o.subtotal, o.payment_status, o.payment_provider, o.status, o.created_at
      from public.storefront_orders o
     where o.payment_token is not null
       -- Length-checked before the comparison so a one-character guess costs the same as a full one.
       and char_length(coalesce(p_token, '')) >= 26
       and o.payment_token = p_token
       -- Expiry, the brief's rule: the link goes quiet once the money has arrived or the order is off.
       and coalesce(o.payment_status, 'unpaid') not in ('paid', 'settled', 'refunded')
       and coalesce(o.status, '') not in ('cancelled', 'canceled', 'expired')
     limit 1;
$$;

grant execute on function public.storefront_payment_link(text) to anon, authenticated;

-- Verify (anon key) — a wrong token says nothing, and the table itself stays shut:
--   curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/storefront_payment_link" -H "apikey: $ANON" \
--        -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
--        -d '{"p_token":"00000000000000000000000000000000"}'          # -> []
--   curl -s "$SUPABASE_URL/rest/v1/storefront_orders?select=payment_token" -H "apikey: $ANON" \
--        -H "Authorization: Bearer $ANON"                            # -> [] (RLS)
--
-- Expect 0 before any order has one:
select count(*) as order_dengan_token from public.storefront_orders where payment_token is not null;

-- Rollback:
--   drop function if exists public.storefront_payment_link(text);
--   drop index if exists public.storefront_orders_payment_token_key;
--   alter table public.storefront_orders drop constraint if exists storefront_orders_payment_token_len;
--   alter table public.storefront_orders drop column if exists payment_token;
