create extension if not exists pgcrypto with schema extensions;

alter table public.storefront_customers
    add column if not exists security_question text,
    add column if not exists security_answer_hash text,
    add column if not exists security_enabled_at timestamptz;

create or replace function public.storefront_customer_portal(p_customer_code text)
returns table (
    customer jsonb,
    orders jsonb
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
            c.delivery_area,
            c.order_count,
            c.last_order_at,
            c.security_question,
            c.security_answer_hash,
            c.security_enabled_at,
            c.created_at,
            c.updated_at
        from public.storefront_customers c
        where c.customer_code = upper(trim(p_customer_code))
        limit 1
    ),
    matched_orders as (
        select
            o.order_number,
            o.status,
            o.items,
            o.quantity,
            o.subtotal,
            o.payment_provider,
            o.payment_status,
            o.payment_reference,
            o.source,
            o.created_at,
            o.updated_at
        from public.storefront_orders o
        join matched_customer c
            on o.customer_id = c.id
            or o.customer_code = c.customer_code
        where c.security_answer_hash is null
        order by o.created_at desc
    )
    select
        coalesce(
            (
                select case
                    when c.security_answer_hash is not null then jsonb_build_object(
                        'customer_code', c.customer_code,
                        'customer_name', c.customer_name,
                        'security_question', c.security_question,
                        'requires_security', true,
                        'security_enabled_at', c.security_enabled_at
                    )
                    else jsonb_build_object(
                        'id', c.id,
                        'customer_code', c.customer_code,
                        'customer_name', c.customer_name,
                        'contact', c.contact,
                        'delivery_area', c.delivery_area,
                        'order_count', c.order_count,
                        'last_order_at', c.last_order_at,
                        'security_question', c.security_question,
                        'requires_security', false,
                        'security_enabled_at', c.security_enabled_at,
                        'created_at', c.created_at,
                        'updated_at', c.updated_at
                    )
                end
                from matched_customer c
            ),
            '{}'::jsonb
        ) as customer,
        coalesce(
            (
                select jsonb_agg(to_jsonb(o))
                from matched_orders o
            ),
            '[]'::jsonb
        ) as orders;
$$;

create or replace function public.storefront_customer_portal_verify(
    p_customer_code text,
    p_security_answer text
)
returns table (
    customer jsonb,
    orders jsonb
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
            c.delivery_area,
            c.order_count,
            c.last_order_at,
            c.security_question,
            c.security_answer_hash,
            c.security_enabled_at,
            c.created_at,
            c.updated_at
        from public.storefront_customers c
        where c.customer_code = upper(trim(p_customer_code))
            and c.security_answer_hash = crypt(lower(trim(p_security_answer)), c.security_answer_hash)
        limit 1
    ),
    matched_orders as (
        select
            o.order_number,
            o.status,
            o.items,
            o.quantity,
            o.subtotal,
            o.payment_provider,
            o.payment_status,
            o.payment_reference,
            o.source,
            o.created_at,
            o.updated_at
        from public.storefront_orders o
        join matched_customer c
            on o.customer_id = c.id
            or o.customer_code = c.customer_code
        order by o.created_at desc
    )
    select
        coalesce(
            (
                select jsonb_build_object(
                    'id', c.id,
                    'customer_code', c.customer_code,
                    'customer_name', c.customer_name,
                    'contact', c.contact,
                    'delivery_area', c.delivery_area,
                    'order_count', c.order_count,
                    'last_order_at', c.last_order_at,
                    'security_question', c.security_question,
                    'requires_security', false,
                    'security_enabled_at', c.security_enabled_at,
                    'created_at', c.created_at,
                    'updated_at', c.updated_at
                )
                from matched_customer c
            ),
            '{}'::jsonb
        ) as customer,
        coalesce(
            (
                select jsonb_agg(to_jsonb(o))
                from matched_orders o
            ),
            '[]'::jsonb
        ) as orders;
$$;

create or replace function public.storefront_customer_set_security(
    p_customer_code text,
    p_security_question text,
    p_security_answer text,
    p_current_answer text default null
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

    if target_customer.security_answer_hash is not null
        and target_customer.security_answer_hash <> crypt(lower(trim(coalesce(p_current_answer, ''))), target_customer.security_answer_hash)
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
