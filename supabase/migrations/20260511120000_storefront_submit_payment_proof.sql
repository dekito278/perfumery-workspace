create or replace function public.storefront_submit_payment_proof(
    p_order_number text,
    p_payment_proof_url text,
    p_file_name text,
    p_content_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    updated_order public.storefront_orders%rowtype;
begin
    if char_length(trim(coalesce(p_order_number, ''))) = 0 then
        raise exception 'Order number is required';
    end if;

    if char_length(trim(coalesce(p_payment_proof_url, ''))) = 0 then
        raise exception 'Payment proof file is required';
    end if;

    update public.storefront_orders
    set
        payment_proof_url = trim(p_payment_proof_url),
        payment_proof_file_name = nullif(trim(coalesce(p_file_name, '')), ''),
        payment_proof_content_type = nullif(trim(coalesce(p_content_type, '')), ''),
        payment_proof_uploaded_at = timezone('utc', now()),
        payment_proof_status = 'submitted',
        payment_proof_notes = null
    where order_number = upper(trim(p_order_number))
        and payment_provider in ('manual', 'manual_transfer_bca')
        and payment_status in ('unpaid', 'pending')
    returning * into updated_order;

    if updated_order.id is null then
        raise exception 'Manual transfer order not found or already finalized';
    end if;

    return to_jsonb(updated_order);
end;
$$;

grant execute on function public.storefront_submit_payment_proof(text, text, text, text) to anon, authenticated;
