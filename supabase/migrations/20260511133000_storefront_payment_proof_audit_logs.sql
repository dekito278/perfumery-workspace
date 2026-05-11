alter table public.storefront_order_audit_logs
    drop constraint if exists storefront_order_audit_logs_action_check;

alter table public.storefront_order_audit_logs
    add constraint storefront_order_audit_logs_action_check
    check (
        action in (
            'order_status_updated',
            'payment_status_updated',
            'shipment_updated',
            'order_cancelled',
            'order_deleted',
            'payment_proof_uploaded',
            'payment_proof_approved',
            'payment_proof_rejected',
            'payment_proof_reviewed'
        )
    );

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
    existing_order public.storefront_orders%rowtype;
    updated_order public.storefront_orders%rowtype;
    uploaded_at timestamptz := timezone('utc', now());
begin
    if char_length(trim(coalesce(p_order_number, ''))) = 0 then
        raise exception 'Order number is required';
    end if;

    if char_length(trim(coalesce(p_payment_proof_url, ''))) = 0 then
        raise exception 'Payment proof file is required';
    end if;

    select *
    into existing_order
    from public.storefront_orders
    where order_number = upper(trim(p_order_number))
        and payment_provider in ('manual', 'manual_transfer_bca')
        and payment_status in ('unpaid', 'pending')
    for update;

    if existing_order.id is null then
        raise exception 'Manual transfer order not found or already finalized';
    end if;

    update public.storefront_orders
    set
        payment_proof_url = trim(p_payment_proof_url),
        payment_proof_file_name = nullif(trim(coalesce(p_file_name, '')), ''),
        payment_proof_content_type = nullif(trim(coalesce(p_content_type, '')), ''),
        payment_proof_uploaded_at = uploaded_at,
        payment_proof_status = 'submitted',
        payment_proof_notes = null
    where id = existing_order.id
    returning * into updated_order;

    insert into public.storefront_order_audit_logs (
        order_id,
        order_number,
        action,
        actor_id,
        actor_email,
        actor_name,
        previous_values,
        next_values,
        metadata
    ) values (
        updated_order.id,
        updated_order.order_number,
        'payment_proof_uploaded',
        auth.uid(),
        coalesce(auth.jwt() ->> 'email', 'customer'),
        'Customer',
        jsonb_build_object(
            'paymentProofStatus', coalesce(existing_order.payment_proof_status, 'missing'),
            'paymentProofUrl', coalesce(existing_order.payment_proof_url, ''),
            'paymentProofFileName', coalesce(existing_order.payment_proof_file_name, ''),
            'paymentProofContentType', coalesce(existing_order.payment_proof_content_type, ''),
            'paymentProofUploadedAt', coalesce(existing_order.payment_proof_uploaded_at::text, '')
        ),
        jsonb_build_object(
            'paymentProofStatus', 'submitted',
            'paymentProofUrl', coalesce(updated_order.payment_proof_url, ''),
            'paymentProofFileName', coalesce(updated_order.payment_proof_file_name, ''),
            'paymentProofContentType', coalesce(updated_order.payment_proof_content_type, ''),
            'paymentProofUploadedAt', coalesce(updated_order.payment_proof_uploaded_at::text, '')
        ),
        jsonb_build_object(
            'source', 'customer_payment_page',
            'orderId', updated_order.id,
            'fileName', coalesce(updated_order.payment_proof_file_name, ''),
            'contentType', coalesce(updated_order.payment_proof_content_type, '')
        )
    );

    return to_jsonb(updated_order);
end;
$$;

grant execute on function public.storefront_submit_payment_proof(text, text, text, text) to anon, authenticated;
