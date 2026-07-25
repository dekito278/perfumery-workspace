-- DRAFT — finding #3: sharing an invoice link (?code=) hands over the whole account.
-- Give every order an opaque token so an invoice can be opened without the account code.
-- Test on staging, then move into supabase/migrations/ with a real timestamp.

alter table public.storefront_orders
  add column if not exists invoice_token text;

-- Backfill existing rows and enforce presence going forward.
update public.storefront_orders
  set invoice_token = encode(gen_random_bytes(16), 'hex')
  where invoice_token is null;

alter table public.storefront_orders
  alter column invoice_token set default encode(gen_random_bytes(16), 'hex');

create unique index if not exists storefront_orders_invoice_token_idx
  on public.storefront_orders (invoice_token);

-- Returns ONLY the one order that matches order_number + token — not the whole portal.
create or replace function public.storefront_invoice_by_token(p_order_number text, p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(o)
  from public.storefront_orders o
  where o.order_number = upper(trim(p_order_number))
    and o.invoice_token = trim(p_token)
  limit 1;
$$;

grant execute on function public.storefront_invoice_by_token(text, text) to anon, authenticated;

-- FRONTEND: CustomerInvoicePage should link/open with ?token=<invoice_token> and call
-- storefront_invoice_by_token instead of getCustomerPortalByCode. Keep the token OUT of any
-- referrer-leaking context the same way you would a password.
