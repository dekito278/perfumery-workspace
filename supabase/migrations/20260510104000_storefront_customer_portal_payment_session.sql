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
            c.created_at,
            c.updated_at,
            c.security_question,
            c.security_answer_hash,
            c.security_enabled_at
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
            o.payment_url,
            o.payment_expires_at,
            o.payment_session_id,
            o.source,
            o.bespoke_production_status,
            o.bespoke_production_timeline,
            o.shipment_status,
            o.courier_name,
            o.tracking_number,
            o.tracking_url,
            o.shipped_at,
            o.delivered_at,
            o.packing_notes,
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
            c.created_at,
            c.updated_at,
            c.security_question,
            c.security_answer_hash,
            c.security_enabled_at
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
            o.payment_url,
            o.payment_expires_at,
            o.payment_session_id,
            o.source,
            o.bespoke_production_status,
            o.bespoke_production_timeline,
            o.shipment_status,
            o.courier_name,
            o.tracking_number,
            o.tracking_url,
            o.shipped_at,
            o.delivered_at,
            o.packing_notes,
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
