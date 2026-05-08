create or replace function public.storefront_restore_inventory_for_order(
    p_order_id text,
    p_reason text default 'Order cancelled/payment failed stock restored'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    target_order public.storefront_orders%rowtype;
    event_item jsonb;
    product_row public.storefront_products%rowtype;
    product_id_text text;
    product_slug_text text;
    variant_id_text text;
    item_size text;
    restore_quantity integer;
    match_index integer;
    available integer;
    next_variants jsonb;
    next_stock integer;
    restore_events jsonb := '[]'::jsonb;
    restore_payload jsonb;
begin
    select *
    into target_order
    from public.storefront_orders
    where id::text = p_order_id
       or order_number = p_order_id
    for update;

    if not found then
        raise exception 'Order % not found', p_order_id;
    end if;

    if not target_order.inventory_deducted then
        return '[]'::jsonb;
    end if;

    if jsonb_typeof(coalesce(target_order.inventory_events, '[]'::jsonb)) <> 'array' then
        return '[]'::jsonb;
    end if;

    for event_item in
        select value
        from jsonb_array_elements(target_order.inventory_events)
    loop
        if coalesce(event_item->>'type', '') = 'restore'
           or coalesce(event_item->>'direction', '') = 'in' then
            continue;
        end if;

        restore_quantity := greatest(coalesce(nullif(event_item->>'quantity', '')::numeric, 0)::integer, 0);
        if restore_quantity = 0 then
            continue;
        end if;

        product_id_text := coalesce(event_item->>'productId', event_item->>'product_id');
        product_slug_text := coalesce(event_item->>'productSlug', event_item->>'product_slug');
        variant_id_text := coalesce(event_item->>'variantId', event_item->>'variant_id', '');
        item_size := coalesce(event_item->>'size', '');

        if product_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
            select *
            into product_row
            from public.storefront_products
            where id = product_id_text::uuid
            for update;
        else
            select *
            into product_row
            from public.storefront_products
            where slug = product_slug_text
            for update;
        end if;

        if not found then
            continue;
        end if;

        if jsonb_typeof(coalesce(product_row.variants, '[]'::jsonb)) <> 'array'
           or jsonb_array_length(coalesce(product_row.variants, '[]'::jsonb)) = 0 then
            continue;
        end if;

        match_index := null;
        available := null;

        if variant_id_text <> '' then
            select ordinality - 1, coalesce(nullif(value->>'stock', '')::numeric, 0)::integer
            into match_index, available
            from jsonb_array_elements(product_row.variants) with ordinality
            where value->>'id' = variant_id_text
            order by ordinality
            limit 1;
        end if;

        if match_index is null and item_size <> '' then
            select ordinality - 1, coalesce(nullif(value->>'stock', '')::numeric, 0)::integer
            into match_index, available
            from jsonb_array_elements(product_row.variants) with ordinality
            where value->>'size' = item_size
            order by ordinality
            limit 1;
        end if;

        if match_index is null then
            select ordinality - 1, coalesce(nullif(value->>'stock', '')::numeric, 0)::integer
            into match_index, available
            from jsonb_array_elements(product_row.variants) with ordinality
            order by ordinality
            limit 1;
        end if;

        if match_index is null then
            continue;
        end if;

        select jsonb_agg(
            case
                when ordinality - 1 = match_index then jsonb_set(value, '{stock}', to_jsonb(available + restore_quantity), true)
                else value
            end
            order by ordinality
        )
        into next_variants
        from jsonb_array_elements(product_row.variants) with ordinality;

        select coalesce(sum(coalesce(nullif(value->>'stock', '')::numeric, 0))::integer, 0)
        into next_stock
        from jsonb_array_elements(next_variants);

        update public.storefront_products
        set variants = next_variants,
            stock = next_stock
        where id = product_row.id;

        restore_payload := event_item
            || jsonb_build_object(
                'type', 'restore',
                'direction', 'in',
                'quantity', restore_quantity,
                'movement', coalesce(nullif(p_reason, ''), 'Order cancelled/payment failed stock restored'),
                'restoredAt', timezone('utc', now()),
                'at', timezone('utc', now())
            );
        restore_events := restore_events || jsonb_build_array(restore_payload);
    end loop;

    update public.storefront_orders
    set inventory_deducted = false,
        inventory_events = coalesce(target_order.inventory_events, '[]'::jsonb) || restore_events
    where id = target_order.id;

    return restore_events;
end;
$$;

grant execute on function public.storefront_restore_inventory_for_order(text, text) to anon, authenticated, service_role;
