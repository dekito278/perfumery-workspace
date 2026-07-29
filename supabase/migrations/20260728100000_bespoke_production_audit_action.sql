-- Allow the bespoke production status change to be audited (orderService.updateOrderBespokeProductionStatus).
-- Without this the insert fails the action CHECK and the audit log silently falls back to localStorage only.
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
            'payment_proof_reviewed',
            'bespoke_production_updated'
        )
    );
