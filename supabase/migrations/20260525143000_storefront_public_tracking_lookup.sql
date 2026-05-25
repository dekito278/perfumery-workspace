create or replace function public.storefront_public_tracking_lookup(p_lookup text)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
    with normalized as (
        select upper(trim(coalesce(p_lookup, ''))) as value
    )
    select coalesce(
        (
            select jsonb_build_object(
                'order_number', o.order_number,
                'customer_name_masked',
                    case
                        when nullif(trim(o.customer_name), '') is null then 'Customer'
                        else upper(left(trim(o.customer_name), 1)) || '***'
                    end,
                'status', o.status,
                'payment_status', o.payment_status,
                'shipment_status', o.shipment_status,
                'courier_name', o.courier_name,
                'tracking_number', o.tracking_number,
                'tracking_url', o.tracking_url,
                'shipped_at', o.shipped_at,
                'delivered_at', o.delivered_at,
                'created_at', o.created_at,
                'updated_at', o.updated_at,
                'item_count', coalesce(jsonb_array_length(o.items), o.quantity, 0),
                'matched_by',
                    case
                        when upper(trim(o.order_number)) = normalized.value then 'internal_order'
                        else 'courier_tracking'
                    end
            )
            from public.storefront_orders o
            cross join normalized
            where normalized.value <> ''
                and (
                    upper(trim(o.order_number)) = normalized.value
                    or upper(trim(coalesce(o.tracking_number, ''))) = normalized.value
                )
            order by o.updated_at desc nulls last
            limit 1
        ),
        '{}'::jsonb
    );
$$;

grant execute on function public.storefront_public_tracking_lookup(text) to anon, authenticated;
