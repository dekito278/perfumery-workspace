-- 2026-09-21. The payment page now tells a manual-transfer buyer when their reservation lapses, because
-- api/orders/expire-reservations.js cancels the order 24 hours after created_at and gives the stock back.
-- The buyer was never told, on the one screen where they are about to send money.
--
-- The rule the cron uses needs two fields this anon lookup does not return: inventory_deducted (a
-- stockless or bespoke order without an explicit window is NEVER auto-cancelled, so no deadline may be
-- shown for it) and status (a cancelled order has no deadline at all). Without them the page can only
-- stay silent — which is what it does today, so running this migration is what switches the deadline on.
--
-- Nothing here widens what an anonymous caller can read beyond the order they already named: both fields
-- describe the state of that same order, and the lookup is still keyed by the high-entropy order number
-- and still limited to the three payment providers.
--
-- Rollback: re-run supabase/migrations/20260907050000_payment_session_lookup_returns_items.sql.
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
                'items', o.items,
                'status', o.status,
                'inventory_deducted', o.inventory_deducted,
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

-- VERIFY (run as the anon key, or here — both answer the same question):
--   select (public.storefront_payment_session_lookup('DKT-MU9L5XW2-JNBGGD') ? 'inventory_deducted') as has_flag,
--          (public.storefront_payment_session_lookup('DKT-MU9L5XW2-JNBGGD') ? 'status') as has_status;
--   -- both must be true. A missing order answers '{}' and both are false, so use an order number that exists.
--
-- And that no duplicate overload was created (the PGRST203 trap from 2026-09-20):
--   select proname, count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and proname = 'storefront_payment_session_lookup' group by 1;
--   -- must be exactly 1.
--
-- ROLLBACK: re-run supabase/migrations/20260907050000_payment_session_lookup_returns_items.sql
