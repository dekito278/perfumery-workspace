import { BESPOKE_REQUEST_ITEM_TYPE, VOUCHER_DISCOUNT_ITEM_TYPE } from '@/utils/orderTotals.js';
import supabase from '@/lib/supabaseClient.js';
import { saveCustomer } from '@/services/customerService.js';
import { deductInventoryForOrder, restoreInventoryForOrder, validateOrderStock } from '@/services/productCatalogService.js';
import { releaseVoucherUsageForOrder } from '@/services/voucherService.js';
import { buildBespokeCheckoutDraft, buildBespokeItem, buildBespokeNotes } from '@/utils/bespokeOrder.js';
import { getClientContext, sanitizeClientContext } from '@/utils/clientContext.js';
import { CLOSED_PAYMENT_STATUSES, isOrderClosedForPayment } from '@/utils/orderClosed.js';

export const ORDERS_STORAGE_KEY = 'dekito.storefront.orders.v1';
export const ORDER_AUDIT_LOGS_STORAGE_KEY = 'dekito.storefront.orderAuditLogs.v1';
export const ORDER_SYNC_QUEUE_STORAGE_KEY = 'dekito.storefront.orderSyncQueue.v1';

const orderStatusLabels = {
  draft: 'Draf',
  pending_payment: 'Menunggu bayar',
  paid: 'Sudah dibayar',
  processing: 'Diproses',
  shipped: 'Dikirim',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const shipmentStatusLabels = {
  not_ready: 'Belum siap',
  packing: 'Dikemas',
  shipped: 'Dikirim',
  delivered: 'Terkirim',
};

const bespokeProductionStatusLabels = {
  review_brief: 'Review brief',
  formula: 'Formula',
  sample: 'Sample',
  approval: 'Approval',
  production: 'Produksi',
  ready: 'Siap',
};

const localOnlyStatuses = {
  new: 'pending_payment',
  confirmed: 'paid',
  preparing: 'processing',
};

// Both names come from utils/orderTotals.js, which is where the one list of shop-written line types
// lives. They were spelled out again here, and a rule spelled twice is a rule that holds once.
const BESPOKE_SOURCE = BESPOKE_REQUEST_ITEM_TYPE;
const INVENTORY_RESTORE_PAYMENT_STATUSES = CLOSED_PAYMENT_STATUSES;
// The server cron reads PAYMENT_RESERVATION_TTL_HOURS; this reads VITE_PAYMENT_RESERVATION_TTL_HOURS and
// is baked in at build time. Both actively cancel manual-transfer reservations and the studio prints this
// value as the buyer's deadline, so a mismatch either cancels orders the cron would have kept or shows a
// deadline nobody enforces. assertReservationTtlAgrees() in tools/build.mjs refuses to build when the two
// disagree — this is no longer a comment anyone has to remember.
export const PAYMENT_RESERVATION_TTL_HOURS = Number(import.meta.env?.VITE_PAYMENT_RESERVATION_TTL_HOURS || 24);

// One home for "is this order closed", shared with the invoice's delivery block — see utils/orderClosed.js.
// Imported and then re-exported rather than `export … from`: that form does not bind the name inside
// this module, and two functions below call it.
export { isOrderClosedForPayment };
const ACTIVE_RESERVATION_PAYMENT_STATUSES = ['unpaid', 'pending'];

export const isBespokeOrder = (order) => (
  order?.source === BESPOKE_SOURCE
  || order?.requestType === BESPOKE_SOURCE
  || (Array.isArray(order?.items) && order.items.some((item) => item.type === BESPOKE_SOURCE))
);

export const getBespokeItem = (order) => (
  Array.isArray(order?.items)
    ? order.items.find((item) => item.type === BESPOKE_SOURCE)
    : null
);

const readOrders = () => {
  if (typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(ORDERS_STORAGE_KEY);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    return [];
  }
};

const writeOrders = (orders) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch (error) {
    console.warn('Failed to persist orders locally:', error.message || error);
  }
  window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
};

const readLocalAuditLogs = () => {
  if (typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(ORDER_AUDIT_LOGS_STORAGE_KEY);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    return [];
  }
};

const writeLocalAuditLogs = (logs) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ORDER_AUDIT_LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch (error) {
    console.warn('Failed to persist order audit logs locally:', error.message || error);
  }
  window.dispatchEvent(new CustomEvent('dekito:order-audit-updated'));
};

const readOrderSyncQueue = () => {
  if (typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(ORDER_SYNC_QUEUE_STORAGE_KEY);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
};

const writeOrderSyncQueue = (queue) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ORDER_SYNC_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('dekito:order-sync-updated'));
};

const upsertOrderSyncIssue = ({ order, action = 'sync_required', reason = '', severity = 'warning' }) => {
  const orderNumber = order?.orderNumber || order?.order_number || order?.id;
  if (!orderNumber) return null;

  const issue = {
    id: `sync-${orderNumber}`,
    orderNumber,
    action,
    reason: String(reason || 'Database write failed. Review and retry sync before customer follow-up.'),
    severity,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const currentQueue = readOrderSyncQueue();
  const nextQueue = [
    issue,
    ...currentQueue.filter((item) => item.orderNumber !== orderNumber),
  ].slice(0, 100);
  writeOrderSyncQueue(nextQueue);
  return issue;
};

const clearOrderSyncIssue = (orderNumber) => {
  if (!orderNumber) return;
  writeOrderSyncQueue(readOrderSyncQueue().filter((item) => item.orderNumber !== orderNumber));
};

// Timestamp prefix (sortable) + 6 random base36 chars (~2.2B) so order numbers can't be enumerated by
// guessing sequential timestamps — the anon payment-session lookup RPC keys off this number.
const createOrderNumber = () => `DKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

// Every write to storefront_orders goes through here, and it is loud on both ways a write used to
// disappear (audit round 9):
//
//   1. An RLS refusal is NOT an error in PostgREST. It answers 200 with zero rows and `error === null`,
//      so `if (error) throw` never fired and the caller ran its success path against an unchanged row.
//   2. Every writer wrapped its update in a try/catch whose catch mirrored the change into localStorage
//      and returned normally, so the caller's `toast.success` fired either way. "Tandai lunas" could
//      tell the owner an order was paid while the row never moved, and another device still saw unpaid.
//
// `.select()` makes the affected rows observable, so zero rows is a failure we can name. Reads keep
// their localStorage fallback (a cache is fine); writes must never pretend.
export const ORDER_WRITE_FAILED = 'ORDER_WRITE_FAILED';

const orderWriteError = (message) => Object.assign(new Error(message), { code: ORDER_WRITE_FAILED });

export const assertOrderWriteApplied = (rows, orderId) => {
  if (!rows?.length) {
    throw orderWriteError(`Perubahan order ${orderId} tidak tersimpan. Muat ulang halaman dan coba lagi — kalau tetap gagal, sesi admin mungkin sudah kedaluwarsa.`);
  }
  return rows[0];
};

const updateOrderRow = async (orderId, patch) => {
  const query = supabase.from('storefront_orders').update(patch).select('order_number');
  const { data, error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));
  if (error) {
    throw orderWriteError(error.message || `Gagal menyimpan perubahan order ${orderId}`);
  }
  assertOrderWriteApplied(data, orderId);
  window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
  return data[0];
};

const normalizeTimeline = (timeline) => (
  Array.isArray(timeline)
    ? timeline.map((entry) => ({
      status: entry.status || 'pending_payment',
      label: entry.label || orderStatusLabels[entry.status] || entry.status || 'Menunggu bayar',
      note: entry.note || '',
      at: entry.at || entry.created_at || new Date().toISOString(),
    })).filter((entry) => entry.status)
    : []
);

const appendStatusTimeline = (timeline, status, note = '') => [
  ...normalizeTimeline(timeline),
  {
    status,
    label: orderStatusLabels[status] || status,
    note,
    at: new Date().toISOString(),
  },
];

const normalizeBespokeProductionTimeline = (timeline) => (
  Array.isArray(timeline)
    ? timeline.map((entry) => ({
      status: entry.status || 'review_brief',
      label: entry.label || bespokeProductionStatusLabels[entry.status] || entry.status || 'Review brief',
      note: entry.note || '',
      at: entry.at || entry.created_at || new Date().toISOString(),
    })).filter((entry) => entry.status)
    : []
);

const normalizeInventoryEvents = (events) => (
  Array.isArray(events)
    ? events.map((event) => ({
      productId: event.productId || event.product_id || '',
      productSlug: event.productSlug || event.product_slug || '',
      productName: event.productName || event.product_name || 'Product',
      variantId: event.variantId || event.variant_id || '',
      size: event.size || '',
      quantity: Number(event.quantity || 0),
      type: event.type || (event.direction === 'in' ? 'restore' : 'deduct'),
      direction: event.direction || (event.type === 'restore' ? 'in' : 'out'),
      batchKey: event.batchKey || event.batch_key || '',
      formulaId: event.formulaId || event.formula_id || '',
      sku: event.sku || '',
      initialStock: Number(event.initialStock || event.initial_stock || 0),
      movement: event.movement || '',
      restoredAt: event.restoredAt || event.restored_at || '',
      at: event.at || event.created_at || new Date().toISOString(),
    })).filter((event) => event.productName && event.quantity > 0)
    : []
);

const normalizeProductionLinks = (links) => (
  links && typeof links === 'object' && !Array.isArray(links)
    ? {
      batchReference: links.batchReference || links.batch_reference || '',
      formulaId: links.formulaId || links.formula_id || '',
      formulaCode: links.formulaCode || links.formula_code || '',
      formulaName: links.formulaName || links.formula_name || '',
      materialReferences: links.materialReferences || links.material_references || '',
      notes: links.notes || '',
      sourceOrderId: links.sourceOrderId || links.source_order_id || '',
      sourceOrderNumber: links.sourceOrderNumber || links.source_order_number || '',
      updatedAt: links.updatedAt || links.updated_at || '',
    }
    : {
      batchReference: '',
      formulaId: '',
      formulaCode: '',
      formulaName: '',
      materialReferences: '',
      notes: '',
      sourceOrderId: '',
      sourceOrderNumber: '',
      updatedAt: '',
    }
);

const formatOrderRupiah = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const normalizeVoucherSnapshot = (input = {}) => {
  if (!input || typeof input !== 'object') return null;

  const code = String(input.code || input.voucherCode || input.voucher_code || '').trim().toUpperCase();
  const discountAmount = Math.max(Number(input.discountAmount || input.discount_amount || 0), 0);
  if (!code || discountAmount <= 0) return null;

  const subtotalBeforeDiscount = Math.max(Number(input.subtotalBeforeDiscount || input.subtotal_before_discount || 0), 0);
  const subtotalAfterDiscount = Number.isFinite(Number(input.subtotalAfterDiscount || input.subtotal_after_discount))
    ? Math.max(Number(input.subtotalAfterDiscount || input.subtotal_after_discount), 0)
    : Math.max(subtotalBeforeDiscount - discountAmount, 0);

  return {
    code,
    discountType: input.discountType || input.discount_type || '',
    discountValue: Number(input.discountValue || input.discount_value || 0),
    discountAmount,
    subtotalBeforeDiscount,
    subtotalAfterDiscount,
    eligibleSubtotal: Math.max(Number(input.eligibleSubtotal || input.eligible_subtotal || 0), 0),
    eligibleQuantity: Math.max(Number(input.eligibleQuantity || input.eligible_quantity || 0), 0),
    minimumOrder: Math.max(Number(input.minimumOrder || input.minimum_order || 0), 0),
    minimumQuantity: Math.max(Number(input.minimumQuantity || input.minimum_quantity || 0), 0),
    eligibleProductSlugs: input.eligibleProductSlugs || input.eligible_product_slugs || [],
    eligibleCategories: input.eligibleCategories || input.eligible_categories || [],
    appliedAt: input.appliedAt || input.applied_at || new Date().toISOString(),
  };
};

const createVoucherDiscountItem = (voucherSnapshot) => ({
  id: `voucher-${voucherSnapshot.code}`,
  slug: `voucher-${voucherSnapshot.code.toLowerCase()}`,
  type: VOUCHER_DISCOUNT_ITEM_TYPE,
  name: `Voucher ${voucherSnapshot.code}`,
  category: 'Voucher',
  size: '-',
  price: `-${formatOrderRupiah(voucherSnapshot.discountAmount)}`,
  priceNumber: -voucherSnapshot.discountAmount,
  quantity: 1,
  voucherCode: voucherSnapshot.code,
  discountType: voucherSnapshot.discountType,
  discountValue: voucherSnapshot.discountValue,
  discountAmount: voucherSnapshot.discountAmount,
  subtotalBeforeDiscount: voucherSnapshot.subtotalBeforeDiscount,
  subtotalAfterDiscount: voucherSnapshot.subtotalAfterDiscount,
  eligibleSubtotal: voucherSnapshot.eligibleSubtotal,
  eligibleQuantity: voucherSnapshot.eligibleQuantity,
  minimumOrder: voucherSnapshot.minimumOrder,
  minimumQuantity: voucherSnapshot.minimumQuantity,
  eligibleProductSlugs: voucherSnapshot.eligibleProductSlugs,
  eligibleCategories: voucherSnapshot.eligibleCategories,
  voucherSnapshot,
});

const extractVoucherSnapshot = (order = {}, items = []) => {
  const voucherItem = items.find((item) => item.type === VOUCHER_DISCOUNT_ITEM_TYPE);
  return normalizeVoucherSnapshot(
    order.voucherSnapshot
    || order.voucher_snapshot
    || voucherItem?.voucherSnapshot
    || voucherItem,
  );
};

const withVoucherDiscountItem = (items = [], voucherSnapshotInput = null) => {
  const productItems = (Array.isArray(items) ? items : [])
    .filter((item) => item.type !== VOUCHER_DISCOUNT_ITEM_TYPE)
    .map((item) => ({ ...item }));
  const voucherSnapshot = normalizeVoucherSnapshot(voucherSnapshotInput);
  return voucherSnapshot ? [...productItems, createVoucherDiscountItem(voucherSnapshot)] : productItems;
};

const appendBespokeProductionTimeline = (timeline, status, note = '') => [
  ...normalizeBespokeProductionTimeline(timeline),
  {
    status,
    label: bespokeProductionStatusLabels[status] || status,
    note,
    at: new Date().toISOString(),
  },
];

const normalizeOrder = (order) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const voucherSnapshot = extractVoucherSnapshot(order, items);
  const source = order.source || (items.some((item) => item.type === BESPOKE_SOURCE) ? BESPOKE_SOURCE : 'storefront');

  return {
    id: order.id,
    orderNumber: order.order_number || order.orderNumber || order.id,
    status: localOnlyStatuses[order.status] || order.status || 'pending_payment',
    source,
    requestType: source === BESPOKE_SOURCE ? BESPOKE_SOURCE : 'storefront',
    customerName: order.customer_name || order.customerName || 'Walk-in customer',
    customerCode: order.customer_code || order.customerCode || '',
    customerId: order.customer_id || order.customerId || '',
    contact: order.contact || '-',
    clientContext: order.client_context || order.clientContext || {},
    notes: order.notes || '',
    items,
    voucherSnapshot,
    quantity: Number(order.quantity || 0),
    subtotal: Number(order.subtotal || 0),
    checkoutDraft: order.checkout_draft || order.checkoutDraft || '',
    paymentProvider: order.payment_provider || order.paymentProvider || 'manual',
    paymentStatus: order.payment_status || order.paymentStatus || 'unpaid',
    paymentReference: order.payment_reference || order.paymentReference || '',
    paymentUrl: order.payment_url || order.paymentUrl || '',
    paymentExpiresAt: order.payment_expires_at || order.paymentExpiresAt || '',
    paymentSessionId: order.payment_session_id || order.paymentSessionId || '',
    paymentResponse: order.doku_response || order.payment_response || order.paymentResponse || {},
    paymentProofUrl: order.payment_proof_url || order.paymentProofUrl || '',
    paymentProofFileName: order.payment_proof_file_name || order.paymentProofFileName || '',
    paymentProofContentType: order.payment_proof_content_type || order.paymentProofContentType || '',
    paymentProofUploadedAt: order.payment_proof_uploaded_at || order.paymentProofUploadedAt || '',
    paymentProofStatus: order.payment_proof_status || order.paymentProofStatus || 'missing',
    paymentProofNotes: order.payment_proof_notes || order.paymentProofNotes || '',
    inventoryDeducted: Boolean(order.inventory_deducted || order.inventoryDeducted),
    inventoryEvents: normalizeInventoryEvents(order.inventory_events || order.inventoryEvents),
    productionLinks: normalizeProductionLinks(order.production_links || order.productionLinks),
    internalNotes: order.internal_notes || order.internalNotes || '',
    statusTimeline: normalizeTimeline(order.status_timeline || order.statusTimeline),
    bespokeProductionStatus: order.bespoke_production_status || order.bespokeProductionStatus || (source === BESPOKE_SOURCE ? 'review_brief' : ''),
    bespokeProductionTimeline: normalizeBespokeProductionTimeline(order.bespoke_production_timeline || order.bespokeProductionTimeline),
    shipmentStatus: order.shipment_status || order.shipmentStatus || 'not_ready',
    courierName: order.courier_name || order.courierName || '',
    trackingNumber: order.tracking_number || order.trackingNumber || '',
    trackingUrl: order.tracking_url || order.trackingUrl || '',
    shippedAt: order.shipped_at || order.shippedAt || '',
    deliveredAt: order.delivered_at || order.deliveredAt || '',
    packingNotes: order.packing_notes || order.packingNotes || '',
    persistence: order.persistence || 'database',
    syncStatus: order.sync_status || order.syncStatus || (order.persistence === 'local' ? 'sync_required' : 'synced'),
    syncReason: order.sync_reason || order.syncReason || '',
    createdAt: order.created_at || order.createdAt || new Date().toISOString(),
    updatedAt: order.updated_at || order.updatedAt || order.created_at || order.createdAt || new Date().toISOString(),
  };
};

const normalizePaymentLog = (log = {}) => ({
  id: log.id || `${log.request_id || 'doku'}-${log.created_at || log.received_at || Date.now()}`,
  orderNumber: log.order_number || log.orderNumber || '',
  requestId: log.request_id || log.requestId || '',
  originalRequestId: log.original_request_id || log.originalRequestId || '',
  transactionStatus: log.transaction_status || log.transactionStatus || '',
  mappedOrderStatus: log.mapped_order_status || log.mappedOrderStatus || '',
  mappedPaymentStatus: log.mapped_payment_status || log.mappedPaymentStatus || '',
  processingStatus: log.processing_status || log.processingStatus || 'received',
  httpStatus: Number(log.http_status || log.httpStatus || 0),
  signatureValid: typeof log.signature_valid === 'boolean' ? log.signature_valid : log.signatureValid,
  headers: log.headers && typeof log.headers === 'object' ? log.headers : {},
  payload: log.payload && typeof log.payload === 'object' ? log.payload : {},
  rawBody: log.raw_body || log.rawBody || '',
  errorMessage: log.error_message || log.errorMessage || '',
  receivedAt: log.received_at || log.receivedAt || log.created_at || log.createdAt || '',
  createdAt: log.created_at || log.createdAt || log.received_at || log.receivedAt || '',
});

const normalizeAuditLog = (log = {}) => ({
  id: log.id || `${log.order_number || log.orderNumber || 'order'}-${log.action || 'audit'}-${log.created_at || log.createdAt || Date.now()}`,
  orderId: log.order_id || log.orderId || '',
  orderNumber: log.order_number || log.orderNumber || '',
  action: log.action || '',
  actorId: log.actor_id || log.actorId || '',
  actorEmail: log.actor_email || log.actorEmail || '',
  actorName: log.actor_name || log.actorName || '',
  previousValues: log.previous_values || log.previousValues || {},
  nextValues: log.next_values || log.nextValues || {},
  metadata: log.metadata || {},
  createdAt: log.created_at || log.createdAt || new Date().toISOString(),
});

const getCurrentAdminActor = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const user = data?.user;
    if (!user) {
      return {
        actorId: null,
        actorEmail: 'system',
        actorName: 'System',
      };
    }

    return {
      actorId: user.id || null,
      actorEmail: user.email || 'admin',
      actorName: user.user_metadata?.name || user.user_metadata?.full_name || user.email || 'Admin',
    };
  } catch (error) {
    return {
      actorId: null,
      actorEmail: 'system',
      actorName: 'System',
    };
  }
};

const toAuditDbValues = (values = {}) => (
  Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined))
);

const saveLocalAuditLog = (log) => {
  const normalizedLog = normalizeAuditLog({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...log,
    createdAt: new Date().toISOString(),
  });
  writeLocalAuditLogs([normalizedLog, ...readLocalAuditLogs().map(normalizeAuditLog)].slice(0, 300));
  return normalizedLog;
};

const createOrderAuditLog = async ({
  action,
  currentOrder,
  orderId,
  previousValues = {},
  nextValues = {},
  metadata = {},
}) => {
  const orderNumber = currentOrder?.orderNumber || metadata.orderNumber || orderId;
  if (!orderNumber || !action) return null;

  const actor = await getCurrentAdminActor();
  const log = {
    orderId: isUuid(currentOrder?.id) ? currentOrder.id : null,
    orderNumber,
    action,
    actorId: actor.actorId,
    actorEmail: actor.actorEmail,
    actorName: actor.actorName,
    previousValues: toAuditDbValues(previousValues),
    nextValues: toAuditDbValues(nextValues),
    metadata: {
      ...metadata,
      orderId: currentOrder?.id || orderId || '',
    },
  };

  if (currentOrder?.persistence === 'local') {
    return saveLocalAuditLog(log);
  }

  try {
    const { data, error } = await supabase
      .from('storefront_order_audit_logs')
      .insert({
        order_id: log.orderId,
        order_number: log.orderNumber,
        action: log.action,
        actor_id: log.actorId,
        actor_email: log.actorEmail,
        actor_name: log.actorName,
        previous_values: log.previousValues,
        next_values: log.nextValues,
        metadata: log.metadata,
      })
      .select('*')
      .single();

    if (error) throw error;
    window.dispatchEvent(new CustomEvent('dekito:order-audit-updated'));
    return normalizeAuditLog(data);
  } catch (error) {
    console.warn('Saving order audit log locally:', error.message || error);
    return saveLocalAuditLog(log);
  }
};

const buildOrderPayload = ({
  customerName,
  customerCode = '',
  customerId = '',
  contact,
  notes,
  items,
  subtotal,
  quantity,
  checkoutDraft,
  paymentProvider = 'manual',
  source = 'storefront',
  voucherSnapshot,
  clientContext = {},
}) => ({
  order_number: createOrderNumber(),
  status: 'pending_payment',
  customer_name: customerName?.trim() || 'Walk-in customer',
  customer_code: customerCode || null,
  customer_id: customerId || null,
  contact: contact?.trim() || '-',
  notes: notes?.trim() || '',
  items: withVoucherDiscountItem(items, voucherSnapshot),
  quantity,
  subtotal,
  checkout_draft: checkoutDraft,
  payment_provider: paymentProvider,
  // Manual transfer starts 'pending' (awaiting proof); gateway (DOKU) starts 'unpaid'. The real provider
  // ids are 'manual_transfer_bca'/'doku' — the old ['manual','whatsapp'] literals never matched, so every
  // manual order was inserted 'unpaid' and relied on a follow-up patch.
  payment_status: ['manual_transfer_bca', 'manual'].includes(paymentProvider) ? 'pending' : 'unpaid',
  source,
  // Which shop the order came from. The endpoint path has recorded this since the buyer's browser
  // started sending it; this path — the direct insert — wrote nothing, so an order created here had no
  // shop at all and every message about it went out in Indonesian by default. Through the same
  // whitelist the server uses, so the two cannot drift.
  client_context: sanitizeClientContext(clientContext),
  ...(source === BESPOKE_SOURCE ? { bespoke_production_status: 'review_brief' } : {}),
});

const createLocalOrder = (payload) => {
  const createdAt = new Date().toISOString();
  const order = normalizeOrder({
    id: payload.order_number,
    ...payload,
    persistence: 'local',
    sync_status: 'sync_required',
    created_at: createdAt,
    updated_at: createdAt,
  });

  const nextOrders = [order, ...readOrders().map(normalizeOrder)];
  writeOrders(nextOrders);
  upsertOrderSyncIssue({
    order,
    action: payload.payment_provider === 'doku' ? 'payment_blocked_until_sync' : 'sync_required',
    reason: payload.payment_provider === 'doku'
      ? 'Order tersimpan sebagai local draft karena database gagal. DOKU checkout diblokir sampai sync berhasil.'
      : 'Order tersimpan lokal karena database gagal. Retry sync dari dashboard sebelum follow-up customer.',
    severity: payload.payment_provider === 'doku' ? 'critical' : 'warning',
  });
  return order;
};

export const getOrderStatusLabels = () => orderStatusLabels;
export const getShipmentStatusLabels = () => shipmentStatusLabels;
export const getBespokeProductionStatusLabels = () => bespokeProductionStatusLabels;

/**
 * The bespoke workflow, in order, from the one place that defines it.
 *
 * It was written out again as a literal array in CustomerPortalPage and in MobileOrderDetailPage — so the
 * buyer's progress bar and the owner's checklist each had their own idea of how many steps there are, and
 * the portal's `grid-cols-6` had a third. All four agreed only because nobody had added a step yet; a
 * seventh would have been dropped silently from both screens and overflowed the grid.
 *
 * Insertion order is the workflow order, which is what makes indexOf() a progress index.
 */
export const BESPOKE_PRODUCTION_STEPS = Object.keys(bespokeProductionStatusLabels);

export const getLocalOrders = () => readOrders().map(normalizeOrder);
export const getOrderSyncQueue = () => readOrderSyncQueue();

const toOrderDatabasePayload = (order) => ({
  order_number: order.orderNumber,
  status: order.status || 'pending_payment',
  customer_name: order.customerName || 'Walk-in customer',
  customer_code: order.customerCode || null,
  customer_id: isUuid(order.customerId) ? order.customerId : null,
  contact: order.contact || '-',
  notes: order.notes || '',
  items: withVoucherDiscountItem(order.items, order.voucherSnapshot),
  quantity: Number(order.quantity || 0),
  subtotal: Number(order.subtotal || 0),
  checkout_draft: order.checkoutDraft || '',
  payment_provider: order.paymentProvider || 'manual',
  payment_status: order.paymentStatus || 'unpaid',
  payment_reference: order.paymentReference || null,
  payment_url: order.paymentUrl || null,
  payment_expires_at: order.paymentExpiresAt || null,
  payment_session_id: order.paymentSessionId || null,
  payment_response: order.paymentResponse && typeof order.paymentResponse === 'object' ? order.paymentResponse : null,
  doku_response: order.paymentResponse && typeof order.paymentResponse === 'object' ? order.paymentResponse : null,
  inventory_deducted: Boolean(order.inventoryDeducted),
  inventory_events: normalizeInventoryEvents(order.inventoryEvents),
  production_links: normalizeProductionLinks(order.productionLinks),
  internal_notes: order.internalNotes || null,
  status_timeline: normalizeTimeline(order.statusTimeline),
  source: order.source || 'storefront',
  // Which shop the order came from, carried through the RECOVERY path too.
  //
  // buildOrderPayload already writes this on the direct insert, and its comment says what was at stake:
  // without it "an order created here had no shop at all and every message about it went out in
  // Indonesian by default". When that insert FAILS the order is kept locally and re-sent from here — so
  // the one path that exists for the worst moment was the one that quietly dropped the hint again.
  //
  // Through the same whitelist the other two writers use, and not merely copied: this value has been
  // sitting in localStorage, where the buyer can edit it.
  client_context: sanitizeClientContext(order.clientContext || {}),
  bespoke_production_status: order.bespokeProductionStatus || null,
  bespoke_production_timeline: normalizeBespokeProductionTimeline(order.bespokeProductionTimeline),
  shipment_status: order.shipmentStatus || 'not_ready',
  courier_name: order.courierName || null,
  tracking_number: order.trackingNumber || null,
  tracking_url: order.trackingUrl || null,
  shipped_at: order.shippedAt || null,
  delivered_at: order.deliveredAt || null,
  packing_notes: order.packingNotes || null,
});

export const retryLocalOrderSync = async (orderIdOrNumber) => {
  const localOrders = readOrders().map(normalizeOrder);
  const localOrder = localOrders.find((order) => order.id === orderIdOrNumber || order.orderNumber === orderIdOrNumber);
  if (!localOrder) {
    clearOrderSyncIssue(orderIdOrNumber);
    return { ok: true, order: null, removed: true };
  }

  try {
    const payload = toOrderDatabasePayload(localOrder);
    const { data, error } = await supabase
      .from('storefront_orders')
      .upsert(payload, { onConflict: 'order_number' })
      .select('*')
      .single();

    if (error) throw error;

    const syncedOrder = normalizeOrder(data);
    writeOrders(localOrders.filter((order) => order.orderNumber !== localOrder.orderNumber));
    clearOrderSyncIssue(localOrder.orderNumber);
    window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
    return { ok: true, order: syncedOrder };
  } catch (error) {
    upsertOrderSyncIssue({
      order: localOrder,
      action: localOrder.paymentProvider === 'doku' ? 'payment_blocked_until_sync' : 'sync_failed',
      reason: error.message || 'Retry sync failed',
      severity: localOrder.paymentProvider === 'doku' ? 'critical' : 'warning',
    });
    throw error;
  }
};

export const retryOrderSyncQueue = async () => {
  const queue = readOrderSyncQueue();
  const results = [];
  for (const item of queue) {
    try {
      results.push(await retryLocalOrderSync(item.orderNumber));
    } catch (error) {
      results.push({ ok: false, orderNumber: item.orderNumber, message: error.message || 'Retry failed' });
    }
  }
  return results;
};

const getReservationExpiryDate = (order = {}) => {
  if (!order || typeof order !== 'object') return null;

  const explicitExpiry = order.paymentExpiresAt ? new Date(order.paymentExpiresAt) : null;
  if (explicitExpiry && Number.isFinite(explicitExpiry.getTime())) {
    return explicitExpiry;
  }

  const createdAt = order.createdAt ? new Date(order.createdAt) : null;
  if (createdAt && Number.isFinite(createdAt.getTime())) {
    return new Date(createdAt.getTime() + (PAYMENT_RESERVATION_TTL_HOURS * 60 * 60 * 1000));
  }

  return null;
};

export const getOrderReservationExpiresAt = (order = {}) => (
  getReservationExpiryDate(order)?.toISOString() || ''
);

export const isOrderReservationExpired = (order = {}, now = new Date()) => {
  if (!order?.inventoryDeducted) return false;
  if (!ACTIVE_RESERVATION_PAYMENT_STATUSES.includes(order.paymentStatus)) return false;
  if (['cancelled', 'completed'].includes(order.status)) return false;
  // Manual-transfer buyers sit at paymentStatus 'pending' until an admin approves their proof.
  // Once proof is submitted, the order is paid-awaiting-review — it must NEVER auto-cancel.
  if (order.paymentProofStatus && !['missing', 'rejected'].includes(order.paymentProofStatus)) return false;
  // Waiting on US for a shipping figure. The clock starts when the quote is sent, not when the order is
  // written — otherwise an international buyer loses their order to our slowness, having never been shown
  // an amount to pay. Mirrored in api/orders/expire-reservations.js.
  if (order.paymentResponse?.shippingQuotePending) return false;

  const expiresAt = getReservationExpiryDate(order);
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
};

const getOrdersFromSource = async () => {
  try {
    const { data, error } = await supabase
      .from('storefront_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(normalizeOrder);
  } catch (error) {
    console.warn('Using local storefront orders fallback:', error.message || error);
    return getLocalOrders();
  }
};

export const sweepExpiredOrderReservations = async (orders = null, now = new Date()) => {
  const sourceOrders = Array.isArray(orders) ? orders : await getOrdersFromSource();
  const expiredOrders = sourceOrders.filter((order) => isOrderReservationExpired(order, now));

  for (const order of expiredOrders) {
    await updateOrderPaymentStatus(order.id || order.orderNumber, {
      paymentStatus: 'expired',
      paymentProvider: order.paymentProvider || 'doku',
      paymentReference: order.paymentReference || '',
      paymentUrl: order.paymentUrl || '',
      paymentExpiresAt: order.paymentExpiresAt || '',
      paymentSessionId: order.paymentSessionId || '',
      paymentResponse: order.paymentResponse || null,
      status: 'cancelled',
    });
  }

  return {
    expiredOrders,
    orders: expiredOrders.length ? await getOrdersFromSource() : sourceOrders,
  };
};

export const getOrders = async ({ sweepExpiredReservations = true } = {}) => {
  const orders = await getOrdersFromSource();
  if (!sweepExpiredReservations) return orders;
  const result = await sweepExpiredOrderReservations(orders);
  return result.orders;
};

export const getOrderById = async (orderId, { sweepExpiredReservation = true } = {}) => {
  const localMatch = getLocalOrders().find((order) => order.id === orderId || order.orderNumber === orderId);

  try {
    const query = supabase
      .from('storefront_orders')
      .select('*')
      .limit(1);
    const { data, error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) throw error;
    const order = data?.[0] ? normalizeOrder(data[0]) : localMatch || null;
    if (order && sweepExpiredReservation && isOrderReservationExpired(order)) {
      await updateOrderPaymentStatus(order.id || order.orderNumber, {
        paymentStatus: 'expired',
        paymentProvider: order.paymentProvider || 'doku',
        paymentReference: order.paymentReference || '',
        paymentUrl: order.paymentUrl || '',
        paymentExpiresAt: order.paymentExpiresAt || '',
        paymentSessionId: order.paymentSessionId || '',
        paymentResponse: order.paymentResponse || null,
        status: 'cancelled',
      });
      return getOrderById(orderId, { sweepExpiredReservation: false });
    }
    return order;
  } catch (error) {
    console.warn('Using local storefront order detail fallback:', error.message || error);
    if (localMatch && sweepExpiredReservation && isOrderReservationExpired(localMatch)) {
      await updateOrderPaymentStatus(localMatch.id || localMatch.orderNumber, {
        paymentStatus: 'expired',
        paymentProvider: localMatch.paymentProvider || 'doku',
        paymentReference: localMatch.paymentReference || '',
        paymentUrl: localMatch.paymentUrl || '',
        paymentExpiresAt: localMatch.paymentExpiresAt || '',
        paymentSessionId: localMatch.paymentSessionId || '',
        paymentResponse: localMatch.paymentResponse || null,
        status: 'cancelled',
      });
      return getOrderById(orderId, { sweepExpiredReservation: false });
    }
    return localMatch || null;
  }
};

export const getOrderPaymentLogs = async (orderIdOrNumber) => {
  const order = await getOrderById(orderIdOrNumber, { sweepExpiredReservation: false });
  const orderNumber = order?.orderNumber || orderIdOrNumber;

  if (!orderNumber) return [];

  try {
    const { data, error } = await supabase
      .from('storefront_doku_payment_logs')
      .select('*')
      .eq('order_number', orderNumber)
      .order('received_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(normalizePaymentLog);
  } catch (error) {
    console.warn('Using empty DOKU payment log fallback:', error.message || error);
    return [];
  }
};

export const submitOrderPaymentProof = async (orderNumber, {
  paymentProofUrl,
  fileName,
  contentType,
} = {}) => {
  const normalizedOrderNumber = String(orderNumber || '').trim();
  if (!normalizedOrderNumber) {
    throw new Error('Order number is required');
  }
  if (!paymentProofUrl) {
    throw new Error('Bukti transfer belum diupload');
  }

  // No local fallback. The buyer reads the result of this call as "bukti transfer terkirim"; mirroring it
  // into their own browser's localStorage told them the shop had been notified when the order row never
  // recorded the proof, and the owner had nothing to review (audit round 9).
  const { data, error } = await supabase.rpc('storefront_submit_payment_proof', {
    p_order_number: normalizedOrderNumber,
    p_payment_proof_url: paymentProofUrl,
    p_file_name: fileName || '',
    p_content_type: contentType || '',
  });

  if (error) {
    throw new Error(error.message || 'Bukti transfer belum tersimpan ke pesanan. Coba upload ulang — jangan tutup halaman ini sebelum berhasil.');
  }
  if (!data) {
    throw new Error(`Pesanan ${normalizedOrderNumber} tidak ditemukan, bukti transfer belum tersimpan. Periksa nomor pesanan lalu coba lagi.`);
  }

  const normalizedOrder = normalizeOrder(data);
  window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
  return normalizedOrder;
};

export const getPublicOrderPaymentSession = async (orderNumber) => {
  const normalizedOrderNumber = String(orderNumber || '').trim();
  if (!normalizedOrderNumber) return null;

  // Throws when the lookup itself fails; returns null only when the RPC answered and had no such order.
  // Collapsing both into null let PaymentPage tell a buyer their real order did not exist whenever the
  // network hiccuped — the opposite mistake to the one it was fixing.
  const { data, error } = await supabase.rpc('storefront_payment_session_lookup', {
    p_order_number: normalizedOrderNumber,
  });

  if (error) throw new Error(error.message || 'Gagal memuat sesi pembayaran');
  return data?.order_number ? normalizeOrder(data) : null;
};

export const reviewOrderPaymentProof = async (orderId, {
  paymentProofStatus,
  notes = '',
} = {}) => {
  const nextStatus = String(paymentProofStatus || '').trim();
  if (!['approved', 'rejected'].includes(nextStatus)) {
    throw new Error('Status bukti transfer tidak valid');
  }

  const currentOrder = await getOrderById(orderId, { sweepExpiredReservation: false });
  if (!currentOrder?.paymentProofUrl) {
    throw new Error('Bukti transfer belum tersedia');
  }
  // Approving writes payment_status='paid' directly, which is exactly the transition updateOrderPaymentStatus
  // refuses on a closed order — but the follow-up call reads the row this function just wrote, so it saw
  // 'paid' and never fired. The order ended up paid with inventory_deducted still false, i.e. sold twice.
  if (nextStatus === 'approved' && isOrderClosedForPayment(currentOrder)) {
    throw new Error('Order ini sudah dibatalkan atau kedaluwarsa. Stoknya sudah dilepas — buat order baru sebelum menyetujui bukti transfer.');
  }

  const normalizedNotes = nextStatus === 'rejected'
    ? String(notes || '').trim() || 'Bukti transfer ditolak admin'
    : '';
  const reviewedAt = new Date().toISOString();
  const patch = {
    payment_proof_status: nextStatus,
    payment_proof_notes: normalizedNotes || null,
    payment_proof_uploaded_at: currentOrder.paymentProofUploadedAt || reviewedAt,
    // A proof is usually reviewed more than TTL hours after checkout, so leaving the original deadline in
    // place handed the order straight to the expiry sweep — it got cancelled before the buyer could upload
    // a clearer photo, while the rejection message told them the order was still pending.
    ...(nextStatus === 'rejected' ? {
      payment_status: 'pending',
      status: 'pending_payment',
      payment_expires_at: new Date(Date.now() + (PAYMENT_RESERVATION_TTL_HOURS * 60 * 60 * 1000)).toISOString(),
    } : {}),
    // Approve proof + mark paid in the SAME write, so a failure of the follow-up updateOrderPaymentStatus
    // can't leave the order stuck at "proof approved but payment still pending". The follow-up call below
    // is then just an idempotent backstop for inventory/metadata/audit.
    ...(nextStatus === 'approved' && currentOrder.paymentStatus !== 'paid' ? {
      payment_status: 'paid',
      status: 'paid',
    } : {}),
  };
  const proofAudit = {
    action: nextStatus === 'approved' ? 'payment_proof_approved' : 'payment_proof_rejected',
    currentOrder,
    orderId,
    previousValues: {
      paymentProofStatus: currentOrder.paymentProofStatus || 'missing',
      paymentProofNotes: currentOrder.paymentProofNotes || '',
      paymentProofUploadedAt: currentOrder.paymentProofUploadedAt || '',
    },
    nextValues: {
      paymentProofStatus: nextStatus,
      paymentProofNotes: normalizedNotes,
      paymentProofUploadedAt: currentOrder.paymentProofUploadedAt || reviewedAt,
    },
    metadata: {
      source: 'admin_order_detail',
      hasPaymentProofUrl: Boolean(currentOrder.paymentProofUrl),
    },
  };
  const paymentStatusChangedByReview = nextStatus === 'rejected'
    && ((currentOrder.paymentStatus || '') !== 'pending' || (currentOrder.status || '') !== 'pending_payment');
  const rejectionPaymentAudit = {
    action: 'payment_status_updated',
    currentOrder,
    orderId,
    previousValues: {
      status: currentOrder.status || '',
      paymentStatus: currentOrder.paymentStatus || '',
    },
    nextValues: {
      status: 'pending_payment',
      paymentStatus: 'pending',
    },
    metadata: {
      source: 'payment_proof_rejected',
      reason: normalizedNotes,
    },
  };

  {
    // Approving a proof marks money received. If the write does not land, the caller must hear about it.
    await updateOrderRow(orderId, patch);
    await createOrderAuditLog(proofAudit);
    if (paymentStatusChangedByReview) {
      await createOrderAuditLog(rejectionPaymentAudit);
    }
    if (nextStatus === 'approved' && currentOrder.paymentStatus !== 'paid') {
      await updateOrderPaymentStatus(orderId, {
        paymentStatus: 'paid',
        paymentProvider: currentOrder.paymentProvider || 'manual_transfer_bca',
        paymentReference: currentOrder.paymentReference || '',
        paymentUrl: currentOrder.paymentUrl || '',
        paymentExpiresAt: currentOrder.paymentExpiresAt || '',
        paymentSessionId: currentOrder.paymentSessionId || '',
        paymentResponse: currentOrder.paymentResponse || {},
        status: 'paid',
      });
    }
    return getOrderById(orderId, { sweepExpiredReservation: false });
  }
};

export const getOrderAuditLogs = async (orderIdOrNumber) => {
  const order = await getOrderById(orderIdOrNumber, { sweepExpiredReservation: false });
  const orderNumber = order?.orderNumber || orderIdOrNumber;
  const localLogs = readLocalAuditLogs()
    .map(normalizeAuditLog)
    .filter((log) => log.orderNumber === orderNumber || log.orderId === orderIdOrNumber);

  if (!orderNumber) return localLogs;

  try {
    const { data, error } = await supabase
      .from('storefront_order_audit_logs')
      .select('*')
      .eq('order_number', orderNumber)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const remoteLogs = (data || []).map(normalizeAuditLog);
    const seenIds = new Set(remoteLogs.map((log) => log.id));
    return [
      ...remoteLogs,
      ...localLogs.filter((log) => !seenIds.has(log.id)),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('Using local storefront order audit logs fallback:', error.message || error);
    return localLogs;
  }
};

/**
 * How many audit entries the Studio feed loads at once.
 *
 * Exported because the screen has to be able to SAY it. Measured 2026-10-02: 558 rows in production, so
 * this window covers the newest 200 and the other 358 — everything before 2 August — is not loaded. The
 * dashboard then derived its event and admin filters from the rows it had, which offered 5 of the 7 event
 * types and 2 of the 4 actors, and said nothing about either.
 */
export const ORDER_AUDIT_LOG_PAGE_SIZE = 200;

export const getAllOrderAuditLogs = async ({ limit = ORDER_AUDIT_LOG_PAGE_SIZE } = {}) => {
  const localLogs = readLocalAuditLogs().map(normalizeAuditLog);

  try {
    const { data, error } = await supabase
      .from('storefront_order_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    const remoteLogs = (data || []).map(normalizeAuditLog);
    const seenIds = new Set(remoteLogs.map((log) => log.id));
    return [
      ...remoteLogs,
      ...localLogs.filter((log) => !seenIds.has(log.id)),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  } catch (error) {
    console.warn('Using local storefront order audit logs fallback:', error.message || error);
    return localLogs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }
};

// No `active` here. It was a FOURTH definition of the word — "anything not completed or cancelled" —
// living beside the three that utils/orderWorkflow.js was written to unify, and whose own header says a
// list and its count can no longer disagree about the same tab. It could, from here: measured on this
// shop, 20 against the order list's 1. Deleted rather than corrected, so the next screen that wants the
// number has to take it from matchesOrderFilter like everyone else.
export const getOrderSummary = (orders) => ({
  total: orders.length,
  completed: orders.filter((order) => order.status === 'completed').length,
  revenue: orders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + Number(order.subtotal || 0), 0),
});

export const createOrder = async (orderData) => {
  const stockValidation = await validateOrderStock(orderData.items || []);
  if (!stockValidation.ok) {
    const firstIssue = stockValidation.issues[0];
    throw new Error(`${firstIssue.productName}${firstIssue.variantName ? ` ${firstIssue.variantName}` : ''} stok tersisa ${firstIssue.available}, tidak cukup untuk ${firstIssue.requested}.`);
  }

  // saveCustomer with no customer code resolves the row from the SIGNED-IN account, because that is what
  // the checkout wants: the buyer is the person at the keyboard. In Studio the person at the keyboard is
  // Dekito, and the buyer is someone in Kuala Lumpur — so recording an export order overwrote HIS OWN
  // customer row with the buyer's name, contact and address. Measured, on the real one: SOLI89523 came
  // back reading "UJI TOKO EN" with a Malaysian address.
  //
  // An order written FOR someone else therefore writes no customer row at all. The buyer's details live
  // on the order itself, which is where they are read from anyway; a customer record that belongs to the
  // wrong person is worse than none.
  const customer = orderData.skipCustomerRecord ? null : await saveCustomer({
    customerCode: orderData.customerCode,
    customerName: orderData.customerName,
    contact: orderData.contact,
    deliveryAddress: orderData.deliveryAddress,
    deliveryArea: orderData.deliveryArea,
    notes: orderData.customerNotes,
    incrementOrder: true,
  });
  const payload = buildOrderPayload({
    ...orderData,
    customerCode: customer?.customerCode || orderData.customerCode || '',
    customerId: isUuid(customer?.id) ? customer.id : '',
  });

  let order;
  try {
    const { error } = await supabase
      .from('storefront_orders')
      .insert(payload);

    if (error) {
      throw error;
    }

    window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
    order = normalizeOrder({
      id: payload.order_number,
      ...payload,
      persistence: 'database',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Saving storefront order locally because database save failed:', error.message || error);
    // Keep a local draft for recovery, but NEVER report a customer checkout as
    // successful when the order never reached the database — otherwise the buyer
    // can transfer money (manual/DOKU) for an order the merchant never sees.
    order = createLocalOrder(payload);
    throw new Error(`Order ${order.orderNumber} gagal tersimpan ke server. Coba lagi sebentar dan jangan lakukan pembayaran sampai order berhasil dibuat.`);
  }

  // Mirror api/orders/create.js: if reserving stock fails the just-inserted row must not survive as a
  // never-payable, never-expiring order — the cron only cancels orders that reserved stock or were given
  // an explicit payment window, and this one has neither.
  let inventoryEvents;
  try {
    inventoryEvents = await deductInventoryForOrder(order);
  } catch (stockError) {
    // Best-effort cleanup: the stock error is what the buyer must see, so a failed cancel is logged, not
    // thrown. It still goes through updateOrderRow so a silent no-op shows up in the console.
    try {
      await updateOrderRow(order.orderNumber || payload.order_number, { status: 'cancelled', payment_status: 'expired' });
    } catch (cancelError) {
      console.warn('Failed to cancel order after stock reservation failed:', cancelError.message || cancelError);
    }
    throw stockError;
  }
  if (inventoryEvents.length) {
    await markOrderInventoryDeducted(order.id || order.orderNumber, inventoryEvents);
    return {
      ...order,
      inventoryDeducted: true,
      inventoryEvents: normalizeInventoryEvents(inventoryEvents),
    };
  }

  return order;
};

// Rollout flag for authoritative (server-priced) order creation via /api/orders/create.
// ON by default (audit round 7, finding #1): the client-priced insert lets anyone craft their own
// subtotal, so it is now the exception, not the default. Set VITE_AUTHORITATIVE_ORDERS=false only as an
// emergency escape hatch — and note that it stops working entirely once anon INSERT on storefront_orders
// is revoked (docs/server-side-drafts/07_orders_anon_insert_revoke.sql).
// See docs/server-side-drafts/05_create_order_design.md and 08_rollout_runbook.md.
export const authoritativeOrdersEnabled = () => {
  try {
    return import.meta.env?.VITE_AUTHORITATIVE_ORDERS !== 'false';
  } catch {
    return true;
  }
};

// POST references (never prices) to the authoritative endpoint, which recomputes every price from the DB
// and inserts via the service role. Returns a normalized order, or throws so the caller can fall back to
// the direct-insert path.
const postAuthoritativeOrder = async (body) => {
  // Attached here rather than at each call site: this is the single choke point every order goes
  // through, cart checkout and bespoke alike, so neither path can forget it.
  // The buyer's own token, so the endpoint can tell a member from a reseller without trusting the
  // customer code in the payload — that code is printed on every invoice.
  const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: null }));
  const accessToken = sessionData?.session?.access_token;

  const response = await fetch('/api/orders/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ ...body, client: getClientContext() }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.order) {
    throw new Error(data?.message || 'Authoritative order endpoint failed');
  }
  return normalizeOrder(data.order);
};

const createBespokeOrderViaEndpoint = (request) => postAuthoritativeOrder({
  source: 'bespoke',
  customer: { name: request.customerName || '', code: request.customerCode || '', contact: request.contact || '' },
  delivery: { address: request.deliveryAddress || '', area: request.deliveryArea || '' },
  bespoke: {
    optionIds: request.optionIds || {},
    perfumeName: request.perfumeName || '',
    scentDescription: request.scentDescription || request.preferredNotes || '',
    preferredNotes: request.preferredNotes || request.scentDescription || '',
    occasion: request.occasion || '',
    avoidedNotes: request.avoidedNotes || '',
    story: request.story || '',
    referenceProductName: request.referenceProductName || '',
    referenceProductSlug: request.referenceProductSlug || '',
    preorderAcknowledged: Boolean(request.preorderAcknowledged),
  },
  shipping: {
    destinationId: request.shippingDestinationId || '',
    destination: request.shippingDestination || null,
    courier: request.shippingCourier || '',
    service: request.shippingService || '',
  },
  voucherCode: request.voucherCode || '',
  paymentProvider: request.paymentProvider || 'manual',
});

// Catalog cart checkout via the authoritative endpoint. `orderData` is what createOrder receives today;
// `refs` carries the shipping selection + voucher code the endpoint needs to re-price server-side.
export const createCatalogOrderViaEndpoint = (orderData, refs = {}) => postAuthoritativeOrder({
  source: orderData.source || 'storefront',
  customer: { name: orderData.customerName || '', code: orderData.customerCode || '', contact: orderData.contact || '' },
  delivery: { address: orderData.deliveryAddress || '', area: orderData.deliveryArea || '' },
  items: (orderData.items || []).filter((item) => item.type !== VOUCHER_DISCOUNT_ITEM_TYPE),
  notes: orderData.notes || '',
  checkoutDraft: orderData.checkoutDraft || '',
  shipping: {
    destinationId: refs.shippingDestinationId || '',
    destination: refs.shippingDestination || null,
    courier: refs.shippingCourier || '',
    service: refs.shippingService || '',
  },
  voucherCode: refs.voucherCode || '',
  paymentProvider: orderData.paymentProvider || 'manual',
});

export const createBespokeRequest = async (requestData) => {
  const normalizedRequest = {
    ...requestData,
    customerName: requestData.customerName || requestData.name,
  };
  const totalPrice = Number(normalizedRequest.totalPrice || normalizedRequest.estimatedTotal || 0);

  // No fallback on failure: falling back re-opened the price-tampering path the endpoint exists to close
  // (audit round 7, finding #1). A failing endpoint must surface as a failed checkout, not as a silently
  // client-priced order.
  if (authoritativeOrdersEnabled()) {
    return createBespokeOrderViaEndpoint(normalizedRequest);
  }

  return createOrder({
    customerCode: normalizedRequest.customerCode,
    customerName: normalizedRequest.customerName,
    contact: normalizedRequest.contact,
    deliveryAddress: normalizedRequest.deliveryAddress,
    deliveryArea: normalizedRequest.deliveryArea,
    notes: buildBespokeNotes(normalizedRequest),
    items: [buildBespokeItem(normalizedRequest)],
    quantity: 1,
    subtotal: totalPrice,
    checkoutDraft: buildBespokeCheckoutDraft(normalizedRequest),
    paymentProvider: normalizedRequest.paymentProvider || 'manual',
    source: BESPOKE_SOURCE,
    voucherSnapshot: normalizedRequest.voucherSnapshot || null,
  });
};

export const updateOrderStatus = async (orderId, status) => {
  const currentOrder = await getOrderById(orderId, { sweepExpiredReservation: false });
  // Fulfillment requires payment: never ship/complete an order that isn't paid.
  if (['shipped', 'completed'].includes(status) && currentOrder?.paymentStatus !== 'paid') {
    throw new Error('Order belum lunas — tandai pembayaran "paid" dulu sebelum kirim atau selesaikan order.');
  }
  const statusTimeline = appendStatusTimeline(currentOrder?.statusTimeline, status, 'Status updated from Studio');
  const auditAction = status === 'cancelled' ? 'order_cancelled' : 'order_status_updated';
  // Cancelling an unpaid/pending order must also close its payment window, otherwise a cancelled DOKU
  // order keeps a live payment_url and a buyer could still pay for it (stock already released). Mirror
  // the reservation sweep, which pairs status:'cancelled' with payment_status:'expired'. Never touch a
  // 'paid' order's payment status here (that would be a refund, handled elsewhere).
  const expirePayment = status === 'cancelled' && ['unpaid', 'pending'].includes(currentOrder?.paymentStatus);

  {
    const updatePayload = { status, status_timeline: statusTimeline };
    if (expirePayment) {
      updatePayload.payment_status = 'expired';
    }
    await updateOrderRow(orderId, updatePayload);

    if (status === 'cancelled' && currentOrder?.inventoryDeducted) {
      const restoreEvents = await restoreInventoryForOrder(currentOrder, 'Order cancelled stock released');
      // Clear the deducted flag so a later refund/cancel can't restore the same stock twice.
      if (restoreEvents.length) {
        await markOrderInventoryRestored(orderId, currentOrder.inventoryEvents, restoreEvents);
      }
    }

    // Give the reserved voucher quota back (no-op if the order used no voucher). Never allowed to throw:
    // a voucher release must not be what stops an order from being cancelled.
    //
    // But it must not vanish either. For months this returned { released: false } on EVERY order, because
    // two functions in the database shared the name storefront_release_voucher_usage and PostgREST refused
    // to pick one (PGRST203). The only trace was a console.warn nobody was reading, while one-time codes
    // stayed burned on accounts whose orders had been cancelled. So the answer goes into the order's own
    // audit log, which Studio already shows on the order page.
    const voucherRelease = status === 'cancelled'
      ? await releaseVoucherUsageForOrder({ orderId: currentOrder?.id, orderNumber: currentOrder?.orderNumber || orderId })
      : null;

    await createOrderAuditLog({
      action: auditAction,
      currentOrder,
      orderId,
      previousValues: {
        status: currentOrder?.status || '',
      },
      nextValues: {
        status,
      },
      metadata: {
        source: 'studio',
        // voucherSnapshot, not voucherCode: normalizeOrder has never produced a `voucherCode` field, so
        // this condition was undefined on every order and the answer above reached the audit log exactly
        // never — the same silence the comment was written to end.
        ...(voucherRelease && currentOrder?.voucherSnapshot?.code
          ? { voucherRelease: voucherRelease.released ? 'released' : 'FAILED' }
          : {}),
      },
    });

    return getOrders();
  }
};

export const updateOrderInternalNotes = async (orderId, internalNotes) => {
  const normalizedNotes = String(internalNotes || '').trim();

  await updateOrderRow(orderId, { internal_notes: normalizedNotes });
  return getOrderById(orderId);
};

export const updateOrderShipment = async (orderId, shipmentData = {}) => {
  const shipmentStatus = shipmentData.shipmentStatus || 'not_ready';
  const currentOrder = await getOrderById(orderId, { sweepExpiredReservation: false });
  // Shipping/delivery moves status to shipped/completed — same paid-first rule as updateOrderStatus.
  if (['shipped', 'delivered'].includes(shipmentStatus) && currentOrder?.paymentStatus !== 'paid') {
    throw new Error('Order belum lunas — tandai pembayaran "paid" dulu sebelum mengirim order.');
  }
  const shippedAt = shipmentData.shippedAt
    || currentOrder?.shippedAt
    || (shipmentStatus === 'shipped' ? new Date().toISOString() : null);
  const deliveredAt = shipmentData.deliveredAt
    || currentOrder?.deliveredAt
    || (shipmentStatus === 'delivered' ? new Date().toISOString() : null);
  const patch = {
    shipment_status: shipmentStatus,
    courier_name: String(shipmentData.courierName || '').trim() || null,
    tracking_number: String(shipmentData.trackingNumber || '').trim() || null,
    tracking_url: String(shipmentData.trackingUrl || '').trim() || null,
    shipped_at: shippedAt,
    delivered_at: deliveredAt,
    packing_notes: String(shipmentData.packingNotes || '').trim() || null,
    ...(shipmentStatus === 'shipped' ? { status: 'shipped' } : {}),
    ...(shipmentStatus === 'delivered' ? { status: 'completed' } : {}),
  };
  const statusTimeline = ['shipped', 'delivered'].includes(shipmentStatus)
    ? appendStatusTimeline(currentOrder?.statusTimeline, patch.status, `${shipmentStatusLabels[shipmentStatus]} dari fulfillment`)
    : currentOrder?.statusTimeline || [];
  const payload = {
    ...patch,
    status_timeline: statusTimeline,
  };
  const shipmentAudit = {
    action: 'shipment_updated',
    currentOrder,
    orderId,
    previousValues: {
      status: currentOrder?.status || '',
      shipmentStatus: currentOrder?.shipmentStatus || '',
      courierName: currentOrder?.courierName || '',
      trackingNumber: currentOrder?.trackingNumber || '',
      trackingUrl: currentOrder?.trackingUrl || '',
      shippedAt: currentOrder?.shippedAt || '',
      deliveredAt: currentOrder?.deliveredAt || '',
      packingNotes: currentOrder?.packingNotes || '',
    },
    nextValues: {
      status: patch.status || currentOrder?.status || '',
      shipmentStatus,
      courierName: patch.courier_name || '',
      trackingNumber: patch.tracking_number || '',
      trackingUrl: patch.tracking_url || '',
      shippedAt: patch.shipped_at || '',
      deliveredAt: patch.delivered_at || '',
      packingNotes: patch.packing_notes || '',
    },
    metadata: {
      source: 'fulfillment',
      trackingChanged: (currentOrder?.trackingNumber || '') !== (patch.tracking_number || ''),
    },
  };

  await updateOrderRow(orderId, payload);
  await createOrderAuditLog(shipmentAudit);
  return getOrderById(orderId);
};

// The order statuses this side effect is allowed to replace: the ones that come BEFORE production.
//
// An ALLOWLIST, deliberately, rather than a list of the finished ones — a status added later is then
// protected by default instead of being demoted by a rule nobody remembered to extend.
const ORDER_STATUSES_BEFORE_PRODUCTION = ['pending_payment', 'paid', 'processing'];

export const updateOrderBespokeProductionStatus = async (orderId, productionStatus) => {
  const currentOrder = await getOrderById(orderId, { sweepExpiredReservation: false });
  const bespokeProductionTimeline = appendBespokeProductionTimeline(
    currentOrder?.bespokeProductionTimeline,
    productionStatus,
    'Bespoke production updated from Studio',
  );
  // Reaching production moves the ORDER to processing — forwards only. What Dekito touched is the
  // bespoke workflow dropdown; the order's own status is a side effect of it, and a side effect must
  // never undo a decision further along than itself. Unguarded, setting the workflow back to "Produksi"
  // on an order already shipped or completed took it out of the finished queue and back into the active
  // one, and the audit entry below said only that the workflow field had changed.
  //
  // Measured on the live shop: eleven of the seventeen bespoke orders are already shipped or completed,
  // and all seventeen still sit at review_brief — so the first time this dropdown is used in anger is
  // exactly when it would be used on orders that have already shipped.
  const advancesOrderStatus = productionStatus === 'production'
    && ORDER_STATUSES_BEFORE_PRODUCTION.includes(currentOrder?.status)
    && currentOrder?.status !== 'processing';
  const patch = {
    bespoke_production_status: productionStatus,
    bespoke_production_timeline: bespokeProductionTimeline,
    ...(advancesOrderStatus ? { status: 'processing' } : {}),
  };

  await updateOrderRow(orderId, patch);
  await createOrderAuditLog({
    action: 'bespoke_production_updated',
    currentOrder,
    orderId,
    // The status goes in the record whenever this write moves it. Every other path that writes the order
    // status names it on both sides of its audit entry; this one wrote the column and reported only the
    // workflow field, so the move had no trace anywhere.
    previousValues: {
      bespokeProductionStatus: currentOrder?.bespokeProductionStatus || '',
      ...(advancesOrderStatus ? { status: currentOrder?.status || '' } : {}),
    },
    nextValues: {
      bespokeProductionStatus: productionStatus,
      ...(advancesOrderStatus ? { status: 'processing' } : {}),
    },
    metadata: { source: 'studio' },
  });
  return getOrderById(orderId);
};

export const updateOrderProductionLinks = async (orderId, productionLinks = {}) => {
  const normalizedLinks = normalizeProductionLinks({
    ...productionLinks,
    updatedAt: new Date().toISOString(),
  });

  await updateOrderRow(orderId, { production_links: normalizedLinks });
  return getOrderById(orderId);
};

const markOrderInventoryDeducted = async (orderId, events = []) => {
  const inventoryEvents = normalizeInventoryEvents(events).map((event) => ({
    ...event,
    at: event.at || new Date().toISOString(),
  }));

  // The deduction already happened in the DB; if this flag does not land the order looks un-deducted and
  // a later cancel would restore stock that was never held. Never swallow it.
  await updateOrderRow(orderId, {
    inventory_deducted: true,
    inventory_events: inventoryEvents,
  });
};

const markOrderInventoryRestored = async (orderId, currentEvents = [], restoreEvents = []) => {
  const inventoryEvents = [
    ...normalizeInventoryEvents(currentEvents),
    ...normalizeInventoryEvents(restoreEvents),
  ];

  // Mirror of markOrderInventoryDeducted: if the flag stays true after stock was restored, a second
  // cancel would restore the same units again.
  await updateOrderRow(orderId, {
    inventory_deducted: false,
    inventory_events: inventoryEvents,
  });
};

// Which order statuses a PAYMENT write may replace, per status it wants to write.
//
// Allowlists, the way ORDER_STATUSES_BEFORE_PRODUCTION is one: a status added later is protected by
// default, and a status this map does not name is not written at all rather than written blindly.
//
// The order's own status is a SIDE EFFECT here — the admin marked a payment, not a fulfilment step —
// and four screens carry a bulk "tandai lunas" that maps this over a whole selection. On the shipments
// screen that selection is shipped orders by definition, so select-all on the "Dikirim" tab and mark
// paid rewrote `shipped` to `paid` on every one of them, quietly emptying the shipped queue. Measured on
// the live shop: 11 shipped and 7 completed orders, 22 of 33 already paid, so re-marking any of them
// paid was a no-op for the payment and a demotion for the order.
//
// `cancelled` is the exception and needs no list: a refund or an expiry closes an order wherever it had
// got to, which is the one direction that must always be allowed.
const ORDER_STATUS_REPLACEABLE_BY_PAYMENT = {
  cancelled: null,
  paid: ['pending_payment', 'paid'],
  // Correcting a payment on an order that has already shipped leaves it shipped: it HAS shipped, and
  // saying otherwise in the queue is the same lie in the other direction.
  pending_payment: ['pending_payment', 'paid'],
};

export const updateOrderPaymentStatus = async (orderId, {
  paymentStatus,
  paymentProvider = 'doku',
  paymentReference,
  paymentUrl,
  paymentExpiresAt,
  paymentSessionId,
  paymentResponse,
  status,
  audit = true,
}) => {
  const currentOrder = await getOrderById(orderId, { sweepExpiredReservation: false });

  // Symmetric guard (mirrors the DOKU webhook): never mark a cancelled/expired order paid. Its stock
  // was restored on cancel and may already be resold; re-flipping to paid re-deducts stock and
  // resurrects a dead order. Reviving a closed order must be a deliberate manual re-order, not this path.
  // Throw rather than return: every call site follows the await with toast.success, so a silent refusal
  // told the admin the order was marked paid when nothing had changed.
  if (paymentStatus === 'paid' && isOrderClosedForPayment(currentOrder)) {
    throw new Error(`Order ${currentOrder?.orderNumber || orderId} sudah ${currentOrder?.status === 'cancelled' ? 'dibatalkan' : currentOrder?.paymentStatus}. Stoknya sudah dilepas — buat order baru, jangan tandai paid.`);
  }

  const replaceable = ORDER_STATUS_REPLACEABLE_BY_PAYMENT[status];
  const writesStatus = Boolean(status)
    && (replaceable === null || (replaceable || []).includes(currentOrder?.status));

  const patch = {
    payment_status: paymentStatus,
    payment_provider: paymentProvider,
    ...(paymentReference !== undefined ? { payment_reference: paymentReference } : {}),
    ...(paymentUrl !== undefined ? { payment_url: paymentUrl || null } : {}),
    ...(paymentExpiresAt !== undefined ? { payment_expires_at: paymentExpiresAt || null } : {}),
    ...(paymentSessionId !== undefined ? { payment_session_id: paymentSessionId || null } : {}),
    ...(paymentResponse !== undefined && paymentResponse && typeof paymentResponse === 'object' ? {
      payment_response: paymentResponse,
      doku_response: paymentResponse,
    } : {}),
    ...(writesStatus ? { status } : {}),
  };
  const paymentAudit = {
    action: 'payment_status_updated',
    currentOrder,
    orderId,
    previousValues: {
      status: currentOrder?.status || '',
      paymentStatus: currentOrder?.paymentStatus || '',
      paymentProvider: currentOrder?.paymentProvider || '',
      paymentReference: currentOrder?.paymentReference || '',
      paymentUrl: currentOrder?.paymentUrl || '',
      paymentExpiresAt: currentOrder?.paymentExpiresAt || '',
      paymentSessionId: currentOrder?.paymentSessionId || '',
    },
    nextValues: {
      // What the row will actually say, not what the caller asked for: a status this write declined to
      // move must not appear in the record as though it had moved.
      status: (writesStatus ? status : currentOrder?.status) || '',
      paymentStatus,
      paymentProvider,
      paymentReference: paymentReference ?? currentOrder?.paymentReference ?? '',
      paymentUrl: paymentUrl ?? currentOrder?.paymentUrl ?? '',
      paymentExpiresAt: paymentExpiresAt ?? currentOrder?.paymentExpiresAt ?? '',
      paymentSessionId: paymentSessionId ?? currentOrder?.paymentSessionId ?? '',
    },
    metadata: {
      source: 'payment',
      hasPaymentResponse: Boolean(paymentResponse),
    },
  };

  // This used to shed doku_response, or fall back to a FOUR-FIELD patch, whenever the error message
  // happened to mention one of six column names — an accommodation for databases where those columns had
  // not been added yet. Measured 2026-10-02: all six exist in production and all 33 orders carry a
  // doku_response, so the accommodation was dead, and dead code that reads like a safeguard is worse than
  // none. It matched on a SUBSTRING of the message, so any error merely naming one of those columns — a
  // constraint, a bad jsonb value, a value too long — silently dropped the gateway's own record of the
  // payment, or the payment URL and its expiry, and returned as if the write had succeeded. This function
  // is what "tandai lunas" calls: a failure here must reach the owner, not be patched around.
  await updateOrderRow(orderId, patch);

  if (audit) {
    await createOrderAuditLog(paymentAudit);
  }
  if (writesStatus && status === 'cancelled') {
    await createOrderAuditLog({
      action: 'order_cancelled',
      currentOrder,
      orderId,
      previousValues: {
        status: currentOrder?.status || '',
        paymentStatus: currentOrder?.paymentStatus || '',
      },
      nextValues: {
        status,
        paymentStatus,
      },
      metadata: {
        source: 'payment',
      },
    });
  }

  if (paymentStatus === 'paid' && currentOrder && !currentOrder.inventoryDeducted) {
    const inventoryEvents = await deductInventoryForOrder(currentOrder);
    if (inventoryEvents.length) {
      await markOrderInventoryDeducted(orderId, inventoryEvents);
      window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
    }
  }

  if (INVENTORY_RESTORE_PAYMENT_STATUSES.includes(paymentStatus) && currentOrder?.inventoryDeducted) {
    const restoreEvents = await restoreInventoryForOrder(currentOrder, `Payment ${paymentStatus} stock released`);
    if (restoreEvents.length) {
      await markOrderInventoryRestored(orderId, currentOrder.inventoryEvents, restoreEvents);
      window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
    }
  }

  if (INVENTORY_RESTORE_PAYMENT_STATUSES.includes(paymentStatus) || status === 'cancelled') {
    // Release reserved voucher quota when payment fails/expires or the order is cancelled.
    await releaseVoucherUsageForOrder({ orderId: currentOrder?.id, orderNumber: currentOrder?.orderNumber || orderId });
  }
};

export const deleteOrder = async (orderId) => {
  const currentOrder = await getOrderById(orderId, { sweepExpiredReservation: false });
  // Hard-delete strands any stock still reserved for this order; give it back first. The restore RPC is
  // addressed by order, so it cannot wait until after the row is gone.
  //
  // And the flag has to come down with it, exactly as the cancel and the payment-expiry paths do — every
  // other path in this file that hands stock back pairs the restore with markOrderInventoryRestored, and
  // that function's own comment says why: a flag left true lets a second cancel restore the same units
  // again. This path skipped it on the reasoning that the row is about to disappear. It is not, whenever
  // the delete below is refused — and the comment at that very line says how that arrives: 200 with zero
  // rows, no error. The order then survived claiming to hold stock this function had already returned.
  if (currentOrder?.inventoryDeducted) {
    const restoreEvents = await restoreInventoryForOrder(currentOrder, 'Order deleted stock released');
    if (restoreEvents.length) {
      await markOrderInventoryRestored(orderId, currentOrder.inventoryEvents, restoreEvents);
    }
  }
  // The voucher quota is the other half of the same sentence, and the half where the loss is permanent:
  // cancelling gives it back and so does an expiry, but nothing gives it back after a delete — there is no
  // screen left that names this order. So it is released BEFORE the row goes, and stays that way.
  //
  // Not because the record would be destroyed with it. It would not: the RPC reads
  // storefront_voucher_usage_records, which carries order_id/order_number as plain columns with NO foreign
  // key to storefront_orders and no cascade, so it outlives the order and p_order_number would still find
  // it. The reason is the weaker one, which is the one that holds: releasing first depends on nothing
  // surviving, and this is a path with no second chance.
  // A no-op on an order that used no voucher.
  await releaseVoucherUsageForOrder({ orderId: currentOrder?.id, orderNumber: currentOrder?.orderNumber || orderId });

  const query = supabase.from('storefront_orders').delete().select('order_number');
  const { data, error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));
  if (error) {
    throw orderWriteError(error.message || `Gagal menghapus order ${orderId}`);
  }
  // A delete refused by RLS also comes back as 200 with zero rows. Dropping the row from localStorage and
  // reporting success made the order vanish from this browser while it stayed live everywhere else.
  assertOrderWriteApplied(data, orderId);
  window.dispatchEvent(new CustomEvent('dekito:orders-updated'));

  await createOrderAuditLog({
    action: 'order_deleted',
    currentOrder: currentOrder ? { ...currentOrder, id: null } : currentOrder,
    orderId,
    previousValues: {
      status: currentOrder?.status || '',
      paymentStatus: currentOrder?.paymentStatus || '',
      shipmentStatus: currentOrder?.shipmentStatus || '',
    },
    nextValues: {
      deleted: true,
    },
    metadata: {
      source: 'studio',
    },
  });
  return getOrders();
};

export const clearOrders = () => writeOrders([]);
