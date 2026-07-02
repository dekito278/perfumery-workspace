-- Release voucher quota that was reserved at order creation when an order is later
-- cancelled or its payment fails/expires. Without this, abandoned pending orders
-- permanently burn voucher usage_count (see storefront_record_voucher_usage, which
-- records usage BEFORE payment is confirmed).
--
-- Policy decision (adjust if desired): quota is released for cancelled/failed/expired
-- orders. Mirrors the record RPC: SECURITY DEFINER, row-locked (FOR UPDATE), idempotent,
-- and never drops usage_count below zero.

create or replace function public.storefront_release_voucher_usage(
    p_order_id uuid default null,
    p_order_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_order_number text := nullif(trim(coalesce(p_order_number, '')), '');
    v_record public.storefront_voucher_usage_records%rowtype;
    v_released integer := 0;
begin
    if p_order_id is null and v_order_number is null then
        raise exception 'Order id atau order number wajib diisi';
    end if;

    for v_record in
        select *
        from public.storefront_voucher_usage_records
        where (p_order_id is not null and order_id = p_order_id)
           or (v_order_number is not null and order_number = v_order_number)
    loop
        -- Lock the voucher row before adjusting its counter to keep the decrement atomic.
        perform 1
        from public.storefront_vouchers
        where id = v_record.voucher_id
        for update;

        delete from public.storefront_voucher_usage_records
        where id = v_record.id;

        update public.storefront_vouchers
        set usage_count = greatest(usage_count - coalesce(v_record.amount, 1), 0)
        where id = v_record.voucher_id;

        v_released := v_released + 1;
    end loop;

    return jsonb_build_object('released', v_released > 0, 'count', v_released);
end;
$$;

grant execute on function public.storefront_release_voucher_usage(uuid, text) to anon, authenticated, service_role;
