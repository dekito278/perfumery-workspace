-- DRAFT — finding #1 (partial): SOLI##### is only 100k values, brute-forceable.
-- Widen NEW customer codes so they aren't enumerable. Does NOT fix existing short codes
-- (see README) and is NOT a substitute for rate-limiting storefront_customer_portal.

-- New format: SOLI + 8 uppercase hex chars  => 16^8 ≈ 4.3 billion values.
create or replace function public.generate_storefront_customer_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    candidate text;
begin
    loop
        candidate := 'SOLI' || upper(encode(gen_random_bytes(4), 'hex'));  -- 8 hex chars
        exit when not exists (
            select 1 from public.storefront_customers where customer_code = candidate
        );
    end loop;
    return candidate;
end;
$$;

-- FRONTEND: customerService.js `isCustomerCode` is /^SOLI[0-9]{5}$/ and createLocalCustomerCode()
-- also generates the 5-digit form. Update BOTH to accept/generate the new format, e.g.
--   const isCustomerCode = (v) => /^SOLI[A-Z0-9]{5,}$/.test(normalizeCustomerCode(v));
-- Keep accepting the old 5-digit form so existing customers can still log in.
