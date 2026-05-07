create or replace function public.storefront_customer_portal(p_customer_code text)
returns table (
    customer jsonb,
    orders jsonb
)
language sql
security definer
set search_path = public
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
