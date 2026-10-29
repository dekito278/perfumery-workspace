-- Two code-keyed customer RPCs handed power to anyone who could GUESS a customer code.
--
-- Customer codes are SOLI + five digits: a fixed prefix over a 100,000 keyspace, 44 of them real, and
-- they are printed on every invoice and quoted in every WhatsApp thread — not a secret, by this repo's
-- own words (paymentLinkToken.js). With no rate limit in front of the RPC layer, the whole keyspace is
-- walkable in minutes.
--
-- 1. storefront_customer_checkout_lookup returned the customer's REAL name, contact and delivery address
--    whenever `security_answer_hash is null` — which is all 44 customers, since none has set an answer.
--    It had no grant statement at all, so Postgres left EXECUTE to PUBLIC. An anonymous caller who
--    guessed a code got that person's phone and home address. Its sibling storefront_customer_portal_verify
--    gates the same columns behind `and hash = crypt(answer, hash)` with NO `or hash is null` escape, so
--    this was the one function the 2026-08-19 PII lockdown (customer_lookup_pii_lockdown.sql) missed.
--
--    Fix: PII is returned only to a caller who PROVES they are the customer — a correct security answer,
--    or a logged-in session linked to the account (auth.uid() = auth_user_id). A recognised code with no
--    proof now returns `requires_identity` and nothing personal: the checkout can say "we know this code,
--    type your details or log in" instead of pre-filling a stranger's address. The convenience of
--    code-only address pre-fill for guests is the exact mechanism of the leak and cannot be kept without
--    it; logged-in customers keep pre-fill through the auth branch.
--
-- 2. storefront_customer_set_security let an anonymous caller SET the security answer on any account whose
--    hash was still null (all 44), because the first-time branch checked nothing but the code. That lets
--    a guesser seize the challenge on a stranger's account. It, too, was never revoked from PUBLIC.
--
--    Fix: setting the answer for the FIRST time now requires the same ownership proof — the matching
--    contact (which, after fix #1, no anon RPC discloses) or a linked login. Re-setting an existing
--    answer still requires the current answer, unchanged.
--
-- Both still fail CLOSED and stay callable by anon (the guest flow needs them); the fence is in the body,
-- which is where this project keeps its RPC fences.

-- 1. checkout_lookup ---------------------------------------------------------------------------------
create or replace function public.storefront_customer_checkout_lookup(
    p_customer_code text,
    p_security_answer text default null
)
returns table (customer jsonb)
language sql
security definer
set search_path = public, extensions
as $$
    with matched_customer as (
        select
            c.id, c.customer_code, c.customer_name, c.contact,
            c.delivery_address, c.delivery_area, c.security_question,
            c.security_answer_hash, c.security_enabled_at,
            (
                (
                    c.security_answer_hash is not null
                    and c.security_answer_hash = crypt(lower(trim(coalesce(p_security_answer, ''))), c.security_answer_hash)
                )
                or (c.auth_user_id is not null and c.auth_user_id = auth.uid())
            ) as authorized
        from public.storefront_customers c
        where c.customer_code = upper(trim(p_customer_code))
        limit 1
    )
    select
        coalesce(
            (
                select case
                    when c.authorized then jsonb_build_object(
                        'id', c.id,
                        'customer_code', c.customer_code,
                        'customer_name', c.customer_name,
                        'contact', c.contact,
                        'delivery_address', c.delivery_address,
                        'delivery_area', c.delivery_area,
                        'security_question', c.security_question,
                        'requires_security', false,
                        'security_enabled_at', c.security_enabled_at,
                        'verified', true
                    )
                    when c.security_answer_hash is not null then jsonb_build_object(
                        'customer_code', c.customer_code,
                        'customer_name', c.customer_name,
                        'security_question', c.security_question,
                        'requires_security', true,
                        'security_enabled_at', c.security_enabled_at,
                        'verified', false
                    )
                    else jsonb_build_object(
                        'customer_code', c.customer_code,
                        'customer_name', c.customer_name,
                        'requires_identity', true,
                        'requires_security', false,
                        'verified', false
                    )
                end
                from matched_customer c
            ),
            '{}'::jsonb
        ) as customer;
$$;

revoke execute on function public.storefront_customer_checkout_lookup(text, text) from public;
grant execute on function public.storefront_customer_checkout_lookup(text, text) to anon, authenticated;

-- 2. set_security ------------------------------------------------------------------------------------
-- Drop the old 4-arg signature outright: leaving it in place would leave the unfenced first-time path
-- callable alongside the new one.
drop function if exists public.storefront_customer_set_security(text, text, text, text);

create or replace function public.storefront_customer_set_security(
    p_customer_code text,
    p_security_question text,
    p_security_answer text,
    p_current_answer text default null,
    p_contact text default null
)
returns table (
    customer_code text,
    security_question text,
    security_enabled_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    target_customer public.storefront_customers%rowtype;
    normalized_phone text := public.normalize_phone(p_contact);
begin
    select *
    into target_customer
    from public.storefront_customers
    where storefront_customers.customer_code = upper(trim(p_customer_code))
    limit 1;

    if target_customer.id is null then
        raise exception 'Customer code not found';
    end if;

    if char_length(trim(coalesce(p_security_question, ''))) < 4 then
        raise exception 'Security question is too short';
    end if;

    if char_length(trim(coalesce(p_security_answer, ''))) < 2 then
        raise exception 'Security answer is too short';
    end if;

    if target_customer.security_answer_hash is null then
        -- First-time protection. Knowing the code is not enough: prove ownership with the contact (which
        -- no anon RPC discloses after this migration) or a linked login.
        if not (
            (target_customer.auth_user_id is not null and target_customer.auth_user_id = auth.uid())
            or (
                normalized_phone is not null
                and normalized_phone = public.normalize_phone(target_customer.contact)
            )
            or (
                char_length(trim(coalesce(p_contact, ''))) > 0
                and lower(trim(p_contact)) = lower(trim(coalesce(target_customer.contact, '')))
            )
        ) then
            raise exception 'Contact does not match this code';
        end if;
    elsif target_customer.security_answer_hash
        <> crypt(lower(trim(coalesce(p_current_answer, ''))), target_customer.security_answer_hash)
    then
        raise exception 'Current security answer is incorrect';
    end if;

    update public.storefront_customers
    set
        security_question = trim(p_security_question),
        security_answer_hash = crypt(lower(trim(p_security_answer)), gen_salt('bf')),
        security_enabled_at = timezone('utc', now())
    where id = target_customer.id
    returning storefront_customers.customer_code, storefront_customers.security_question, storefront_customers.security_enabled_at
    into customer_code, security_question, security_enabled_at;

    return next;
end;
$$;

revoke execute on function public.storefront_customer_set_security(text, text, text, text, text) from public;
grant execute on function public.storefront_customer_set_security(text, text, text, text, text) to anon, authenticated;

-- Verify (anon key), after running this:
--   A real code with NO answer set, no login, no contact:
--     select customer from storefront_customer_checkout_lookup('SOLInnnnn');
--     -> customer->>'requires_identity' = 'true', and NO 'contact'/'delivery_address' keys.
--   The same code WITH the matching contact, setting the answer the first time:
--     select * from storefront_customer_set_security('SOLInnnnn','pertanyaan','jawaban', null, '<kontak cocok>');
--     -> one row. A wrong contact -> 'Contact does not match this code'.
