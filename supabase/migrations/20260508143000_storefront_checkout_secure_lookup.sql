create or replace function public.storefront_customer_checkout_lookup(
    p_customer_code text,
    p_security_answer text default null
)
returns table (
    customer jsonb
)
language sql
security definer
set search_path = public, extensions
as $$
    with matched_customer as (
        select
            c.id,
            c.customer_code,
            c.customer_name,
            c.contact,
            c.delivery_address,
            c.delivery_area,
            c.security_question,
            c.security_answer_hash,
            c.security_enabled_at,
            (
                c.security_answer_hash is null
                or c.security_answer_hash = crypt(lower(trim(coalesce(p_security_answer, ''))), c.security_answer_hash)
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
                    else jsonb_build_object(
                        'customer_code', c.customer_code,
                        'customer_name', c.customer_name,
                        'security_question', c.security_question,
                        'requires_security', true,
                        'security_enabled_at', c.security_enabled_at,
                        'verified', false
                    )
                end
                from matched_customer c
            ),
            '{}'::jsonb
        ) as customer;
$$;
