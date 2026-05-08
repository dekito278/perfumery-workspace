create or replace function public.storefront_deduct_inventory_for_order(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    target_order public.storefront_orders%rowtype;
    line_item jsonb;
    product_row public.storefront_products%rowtype;
    product_id_text text;
    product_slug_text text;
    variant_id_text text;
    item_size text;
    requested integer;
    match_index integer;
    available integer;
    next_variants jsonb;
    next_stock integer;
    events jsonb := '[]'::jsonb;
    event_payload jsonb;
    batch_key text;
    formula_id text;
    sku text;
    initial_stock numeric;
    movement text;
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

    if auth.role() = 'anon'
       and target_order.created_at < timezone('utc', now()) - interval '1 day' then
        raise exception 'Inventory deduction is only available for current checkout orders';
    end if;

    if target_order.inventory_deducted then
        return coalesce(target_order.inventory_events, '[]'::jsonb);
    end if;

    if jsonb_typeof(coalesce(target_order.items, '[]'::jsonb)) <> 'array' then
        return '[]'::jsonb;
    end if;

    for line_item in
        select value
        from jsonb_array_elements(target_order.items)
    loop
        if line_item->>'type' = 'bespoke_request' then
            continue;
        end if;

        requested := greatest(coalesce(nullif(line_item->>'quantity', '')::numeric, 1)::integer, 0);
        if requested = 0 then
            continue;
        end if;

        product_id_text := coalesce(line_item->>'id', line_item->>'productId', line_item->>'product_id');
        product_slug_text := coalesce(line_item->>'productSlug', line_item->>'product_slug', line_item->>'slug');
        variant_id_text := coalesce(line_item->>'variantId', line_item->>'variant_id', '');
        item_size := coalesce(line_item->>'size', '');

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
            raise exception 'Product % is unavailable', coalesce(line_item->>'name', product_slug_text, product_id_text, 'unknown');
        end if;

        if jsonb_typeof(coalesce(product_row.variants, '[]'::jsonb)) <> 'array'
           or jsonb_array_length(coalesce(product_row.variants, '[]'::jsonb)) = 0 then
            raise exception 'Product % has no sellable variants', product_row.name;
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
            raise exception 'Product % has no matching stock variant', product_row.name;
        end if;

        if available < requested then
            raise exception '% % stock remaining %, cannot fulfill %',
                product_row.name,
                coalesce(nullif(item_size, ''), 'variant'),
                available,
                requested;
        end if;

        select jsonb_agg(
            case
                when ordinality - 1 = match_index then jsonb_set(value, '{stock}', to_jsonb(available - requested), true)
                else value
            end
            order by ordinality
        )
        into next_variants
        from jsonb_array_elements(product_row.variants) with ordinality;

        select coalesce(sum(coalesce(nullif(value->>'stock', '')::numeric, 0))::integer, 0)
        into next_stock
        from jsonb_array_elements(next_variants);

        select trim(replace(tag, 'Batch key:', ''))
        into batch_key
        from jsonb_array_elements_text(coalesce(product_row.tags, '[]'::jsonb)) tag
        where tag like 'Batch key:%'
        limit 1;

        select trim(replace(tag, 'Formula ID:', ''))
        into formula_id
        from jsonb_array_elements_text(coalesce(product_row.tags, '[]'::jsonb)) tag
        where tag like 'Formula ID:%'
        limit 1;

        select trim(replace(tag, 'SKU:', ''))
        into sku
        from jsonb_array_elements_text(coalesce(product_row.tags, '[]'::jsonb)) tag
        where tag like 'SKU:%'
        limit 1;

        select nullif(trim(replace(tag, 'Initial stock:', '')), '')::numeric
        into initial_stock
        from jsonb_array_elements_text(coalesce(product_row.tags, '[]'::jsonb)) tag
        where tag like 'Initial stock:%'
        limit 1;

        select trim(replace(tag, 'Stock movement:', ''))
        into movement
        from jsonb_array_elements_text(coalesce(product_row.tags, '[]'::jsonb)) tag
        where tag like 'Stock movement:%'
        limit 1;

        update public.storefront_products
        set variants = next_variants,
            stock = next_stock
        where id = product_row.id;

        event_payload := jsonb_build_object(
            'productId', product_row.id,
            'productSlug', product_row.slug,
            'productName', product_row.name,
            'variantId', variant_id_text,
            'size', item_size,
            'quantity', requested,
            'batchKey', coalesce(batch_key, ''),
            'formulaId', coalesce(formula_id, ''),
            'sku', coalesce(sku, ''),
            'initialStock', coalesce(initial_stock, 0),
            'movement', coalesce(nullif(movement, ''), 'Order checkout stock deduction'),
            'at', timezone('utc', now())
        );
        events := events || jsonb_build_array(event_payload);
    end loop;

    update public.storefront_orders
    set inventory_deducted = true,
        inventory_events = events
    where id = target_order.id;

    return events;
end;
$$;

grant execute on function public.storefront_deduct_inventory_for_order(text) to anon, authenticated, service_role;
