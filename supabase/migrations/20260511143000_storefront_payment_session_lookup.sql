create or replace function public.storefront_payment_session_lookup(p_order_number text)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
    select coalesce(
        (
            select jsonb_build_object(
                'order_number', o.order_number,
                'customer_code', o.customer_code,
                'customer_name', o.customer_name,
                'subtotal', o.subtotal,
                'payment_provider', o.payment_provider,
                'payment_status', o.payment_status,
                'payment_reference', o.payment_reference,
                'payment_url', o.payment_url,
                'payment_expires_at', o.payment_expires_at,
                'payment_session_id', o.payment_session_id,
                'payment_response', o.payment_response,
                'payment_proof_url', o.payment_proof_url,
                'payment_proof_file_name', o.payment_proof_file_name,
                'payment_proof_content_type', o.payment_proof_content_type,
                'payment_proof_uploaded_at', o.payment_proof_uploaded_at,
                'payment_proof_status', o.payment_proof_status,
                'payment_proof_notes', o.payment_proof_notes,
                'created_at', o.created_at,
                'updated_at', o.updated_at
            )
            from public.storefront_orders o
            where o.order_number = upper(trim(p_order_number))
                and o.payment_provider in ('manual', 'manual_transfer_bca', 'doku')
            limit 1
        ),
        '{}'::jsonb
    );
$$;

grant execute on function public.storefront_payment_session_lookup(text) to anon, authenticated;
