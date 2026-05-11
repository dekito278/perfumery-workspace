import supabase from '@/lib/supabaseClient.js';
import { saveCustomer } from '@/services/customerService.js';
import { deductInventoryForOrder, restoreInventoryForOrder, validateOrderStock } from '@/services/productCatalogService.js';

export const ORDERS_STORAGE_KEY = 'dekito.storefront.orders.v1';
export const ORDER_AUDIT_LOGS_STORAGE_KEY = 'dekito.storefront.orderAuditLogs.v1';
export const ORDER_SYNC_QUEUE_STORAGE_KEY = 'dekito.storefront.orderSyncQueue.v1';

const orderStatusLabels = {
  draft: 'Draft',
  pending_payment: 'Pending payment',
  paid: 'Paid',
  processing: 'Processing',
  shipped: 'Shipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const shipmentStatusLabels = {
  not_ready: 'Not ready',
  packing: 'Packing',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

const bespokeProductionStatusLabels = {
  review_brief: 'Review brief',
  formula: 'Formula',
  sample: 'Sample',
  approval: 'Approval',
  production: 'Production',
  ready: 'Ready',
};

const localOnlyStatuses = {
  new: 'pending_payment',
  confirmed: 'paid',
  preparing: 'processing',
};

const BESPOKE_SOURCE = 'bespoke_request';
const INVENTORY_RESTORE_PAYMENT_STATUSES = ['failed', 'expired', 'refunded'];
export const PAYMENT_RESERVATION_TTL_HOURS = 24;
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
  window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
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
  window.localStorage.setItem(ORDER_AUDIT_LOGS_STORAGE_KEY, JSON.stringify(logs));
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

const createOrderNumber = () => `DKT-${Date.now().toString(36).toUpperCase()}`;
const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

const normalizeTimeline = (timeline) => (
  Array.isArray(timeline)
    ? timeline.map((entry) => ({
      status: entry.status || 'pending_payment',
      label: entry.label || orderStatusLabels[entry.status] || entry.status || 'Pending payment',
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
    notes: order.notes || '',
    items,
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
  const orderNumber = currentOrder?.orderNumber || currentOrder?.order_number || metadata.orderNumber || orderId;
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
}) => ({
  order_number: createOrderNumber(),
  status: 'pending_payment',
  customer_name: customerName?.trim() || 'Walk-in customer',
  customer_code: customerCode || null,
  customer_id: customerId || null,
  contact: contact?.trim() || '-',
  notes: notes?.trim() || '',
  items: items.map((item) => ({ ...item })),
  quantity,
  subtotal,
  checkout_draft: checkoutDraft,
  payment_provider: paymentProvider,
  payment_status: ['manual', 'whatsapp'].includes(paymentProvider) ? 'pending' : 'unpaid',
  source,
  ...(source === BESPOKE_SOURCE ? { bespoke_production_status: 'review_brief' } : {}),
});

const formatLine = (label, value) => `${label}: ${value || '-'}`;

const buildBespokeCheckoutDraft = ({
  customerCode,
  customerName,
  contact,
  referenceProductName,
  mood,
  occasion,
  budget,
  size,
  preferredNotes,
  avoidedNotes,
  story,
  scentDescription,
  capDesign,
  bottleType,
  labelDesign,
  exoticMaterial,
  paymentProvider,
  totalPrice,
}) => [
  'Solivagant Bespoke Request',
  customerCode ? formatLine('Customer code', customerCode) : '',
  formatLine('Customer', customerName),
  formatLine('Contact', contact),
  formatLine('Reference scent', referenceProductName),
  formatLine('Mood', mood),
  formatLine('Occasion', occasion),
  formatLine('Budget', budget),
  formatLine('Size', size),
  formatLine('Preferred aroma', preferredNotes || scentDescription),
  formatLine('Avoided notes', avoidedNotes),
  formatLine('Story', story),
  formatLine('Bottle type', bottleType),
  formatLine('Cap design', capDesign),
  formatLine('Label design', labelDesign),
  formatLine('Exotic material', exoticMaterial),
  totalPrice ? formatLine('Estimated total', `Rp ${new Intl.NumberFormat('id-ID').format(Number(totalPrice || 0))}`) : '',
  formatLine('Payment rail', paymentProvider || 'manual'),
].filter((line) => line !== '').join('\n');

const buildBespokeNotes = ({
  mood,
  occasion,
  budget,
  size,
  preferredNotes,
  avoidedNotes,
  story,
  scentDescription,
  capDesign,
  bottleType,
  labelDesign,
  exoticMaterial,
  totalPrice,
  referenceProductName,
}) => [
  formatLine('Mood', mood),
  formatLine('Occasion', occasion),
  formatLine('Budget', budget),
  formatLine('Size', size),
  formatLine('Preferred aroma', preferredNotes || scentDescription),
  formatLine('Avoided notes', avoidedNotes),
  formatLine('Story', story),
  formatLine('Bottle type', bottleType),
  formatLine('Cap design', capDesign),
  formatLine('Label design', labelDesign),
  formatLine('Exotic material', exoticMaterial),
  totalPrice ? formatLine('Estimated total', `Rp ${new Intl.NumberFormat('id-ID').format(Number(totalPrice || 0))}`) : '',
  formatLine('Reference scent', referenceProductName),
].join('\n');

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
  items: Array.isArray(order.items) ? order.items : [],
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

    if (error) {
      const missingDokuResponseColumn = String(error.message || '').includes('doku_response');
      if (!missingDokuResponseColumn) throw error;
      const retryPayload = { ...payload };
      delete retryPayload.doku_response;
      const { data: retryData, error: retryError } = await supabase
        .from('storefront_orders')
        .upsert(retryPayload, { onConflict: 'order_number' })
        .select('*')
        .single();
      if (retryError) throw retryError;
      const syncedOrder = normalizeOrder(retryData);
      writeOrders(localOrders.filter((order) => order.orderNumber !== localOrder.orderNumber));
      clearOrderSyncIssue(localOrder.orderNumber);
      window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
      return { ok: true, order: syncedOrder };
    }

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

  try {
    const { data, error } = await supabase.rpc('storefront_submit_payment_proof', {
      p_order_number: normalizedOrderNumber,
      p_payment_proof_url: paymentProofUrl,
      p_file_name: fileName || '',
      p_content_type: contentType || '',
    });

    if (error) throw error;

    const normalizedOrder = normalizeOrder(data || {});
    window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
    return normalizedOrder;
  } catch (error) {
    console.warn('Saving payment proof locally:', error.message || error);
    const uploadedAt = new Date().toISOString();
    const currentOrder = readOrders()
      .map(normalizeOrder)
      .find((order) => order.id === normalizedOrderNumber || order.orderNumber === normalizedOrderNumber);
    const nextOrders = readOrders().map(normalizeOrder).map((order) => (
      order.id === normalizedOrderNumber || order.orderNumber === normalizedOrderNumber
        ? {
          ...order,
          paymentProofUrl,
          paymentProofFileName: fileName || '',
          paymentProofContentType: contentType || '',
          paymentProofUploadedAt: uploadedAt,
          paymentProofStatus: 'submitted',
          paymentProofNotes: '',
          updatedAt: uploadedAt,
        }
        : order
    ));
    writeOrders(nextOrders);
    const updatedOrder = nextOrders.find((order) => order.id === normalizedOrderNumber || order.orderNumber === normalizedOrderNumber);
    if (!updatedOrder) {
      throw new Error(error.message || 'Gagal menyimpan bukti transfer ke order');
    }
    await createOrderAuditLog({
      action: 'payment_proof_uploaded',
      currentOrder: currentOrder || updatedOrder,
      orderId: normalizedOrderNumber,
      previousValues: {
        paymentProofStatus: currentOrder?.paymentProofStatus || 'missing',
        paymentProofUrl: currentOrder?.paymentProofUrl || '',
        paymentProofFileName: currentOrder?.paymentProofFileName || '',
        paymentProofContentType: currentOrder?.paymentProofContentType || '',
        paymentProofUploadedAt: currentOrder?.paymentProofUploadedAt || '',
      },
      nextValues: {
        paymentProofStatus: 'submitted',
        paymentProofUrl,
        paymentProofFileName: fileName || '',
        paymentProofContentType: contentType || '',
        paymentProofUploadedAt: uploadedAt,
      },
      metadata: {
        source: 'customer_payment_page',
        persistence: 'local',
      },
    });
    return updatedOrder;
  }
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

  const normalizedNotes = nextStatus === 'rejected'
    ? String(notes || '').trim() || 'Bukti transfer ditolak admin'
    : '';
  const reviewedAt = new Date().toISOString();
  const patch = {
    payment_proof_status: nextStatus,
    payment_proof_notes: normalizedNotes || null,
    payment_proof_uploaded_at: currentOrder.paymentProofUploadedAt || reviewedAt,
    ...(nextStatus === 'rejected' ? {
      payment_status: 'pending',
      status: 'pending_payment',
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

  try {
    const query = supabase
      .from('storefront_orders')
      .update(patch);
    const { error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) throw error;

    window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
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
  } catch (error) {
    console.warn('Reviewing payment proof locally:', error.message || error);
    const nextOrders = readOrders().map(normalizeOrder).map((order) => (
      order.id === orderId || order.orderNumber === orderId
        ? {
          ...order,
          paymentProofStatus: nextStatus,
          paymentProofNotes: normalizedNotes,
          paymentProofUploadedAt: order.paymentProofUploadedAt || reviewedAt,
          ...(nextStatus === 'approved' ? {
            paymentStatus: 'paid',
            status: 'paid',
          } : {}),
          ...(nextStatus === 'rejected' ? {
            paymentStatus: 'pending',
            status: 'pending_payment',
          } : {}),
          updatedAt: reviewedAt,
        }
        : order
    ));
    writeOrders(nextOrders);
    await createOrderAuditLog({
      ...proofAudit,
      metadata: {
        ...proofAudit.metadata,
        persistence: 'local',
      },
    });
    if (paymentStatusChangedByReview) {
      await createOrderAuditLog({
        ...rejectionPaymentAudit,
        metadata: {
          ...rejectionPaymentAudit.metadata,
          persistence: 'local',
        },
      });
    }
    return nextOrders.find((order) => order.id === orderId || order.orderNumber === orderId) || null;
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

export const getAllOrderAuditLogs = async ({ limit = 200 } = {}) => {
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

export const getOrderSummary = (orders) => ({
  total: orders.length,
  active: orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length,
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

  const customer = await saveCustomer({
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
    order = createLocalOrder(payload);
    if (payload.payment_provider === 'doku') {
      throw new Error(`Order ${order.orderNumber} tersimpan sebagai local draft karena database gagal. DOKU checkout diblokir sampai order berhasil sync ke Supabase.`);
    }
  }

  const inventoryEvents = await deductInventoryForOrder(order);
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

export const createBespokeRequest = async (requestData) => {
  const normalizedRequest = {
    ...requestData,
    customerName: requestData.customerName || requestData.name,
  };
  const aromaBrief = normalizedRequest.preferredNotes || normalizedRequest.scentDescription || normalizedRequest.mood || 'Custom aroma brief';
  const totalPrice = Number(normalizedRequest.totalPrice || normalizedRequest.estimatedTotal || 0);
  const item = {
    slug: 'bespoke-perfume-request',
    type: BESPOKE_SOURCE,
    name: 'Bespoke perfume request',
    quantity: 1,
    price: totalPrice ? `Rp ${new Intl.NumberFormat('id-ID').format(totalPrice)}` : normalizedRequest.budget || 'Custom quote',
    priceNumber: totalPrice,
    size: normalizedRequest.size || '-',
    notes: aromaBrief,
    mood: normalizedRequest.mood || '',
    occasion: normalizedRequest.occasion || '',
    budget: normalizedRequest.budget || '',
    totalPrice,
    preferredNotes: normalizedRequest.preferredNotes || normalizedRequest.scentDescription || '',
    avoidedNotes: normalizedRequest.avoidedNotes || '',
    story: normalizedRequest.story || '',
    bottleType: normalizedRequest.bottleType || '',
    capDesign: normalizedRequest.capDesign || '',
    labelDesign: normalizedRequest.labelDesign || '',
    exoticMaterial: normalizedRequest.exoticMaterial || '',
    referenceProductName: normalizedRequest.referenceProductName || '',
    referenceProductSlug: normalizedRequest.referenceProductSlug || '',
  };

  return createOrder({
    customerCode: normalizedRequest.customerCode,
    customerName: normalizedRequest.customerName,
    contact: normalizedRequest.contact,
    deliveryAddress: normalizedRequest.deliveryAddress,
    deliveryArea: normalizedRequest.deliveryArea,
    notes: buildBespokeNotes(normalizedRequest),
    items: [item],
    quantity: 1,
    subtotal: totalPrice,
    checkoutDraft: buildBespokeCheckoutDraft(normalizedRequest),
    paymentProvider: normalizedRequest.paymentProvider || 'manual',
    source: BESPOKE_SOURCE,
  });
};

export const updateOrderStatus = async (orderId, status) => {
  const currentOrder = await getOrderById(orderId, { sweepExpiredReservation: false });
  const statusTimeline = appendStatusTimeline(currentOrder?.statusTimeline, status, 'Status updated from Studio');
  const auditAction = status === 'cancelled' ? 'order_cancelled' : 'order_status_updated';

  try {
    const query = supabase
      .from('storefront_orders')
      .update({ status, status_timeline: statusTimeline });
    const { error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) {
      throw error;
    }

    if (status === 'cancelled' && currentOrder?.inventoryDeducted) {
      await restoreInventoryForOrder(currentOrder, 'Order cancelled stock released');
    }

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
      },
    });

    return getOrders();
  } catch (error) {
    console.warn('Updating local storefront order fallback:', error.message || error);
    let restoredEvents = [];
    if (status === 'cancelled' && currentOrder?.inventoryDeducted) {
      restoredEvents = await restoreInventoryForOrder(currentOrder, 'Order cancelled stock released');
    }
    const nextOrders = readOrders().map(normalizeOrder).map((order) => (
      order.id === orderId || order.orderNumber === orderId
        ? {
          ...order,
          status,
          statusTimeline,
          inventoryDeducted: restoredEvents.length ? false : order.inventoryDeducted,
          inventoryEvents: restoredEvents.length ? [...order.inventoryEvents, ...normalizeInventoryEvents(restoredEvents)] : order.inventoryEvents,
          updatedAt: new Date().toISOString(),
        }
        : order
    ));
    writeOrders(nextOrders);
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
        persistence: 'local',
      },
    });
    return nextOrders;
  }
};

export const updateOrderInternalNotes = async (orderId, internalNotes) => {
  const normalizedNotes = String(internalNotes || '').trim();

  try {
    const query = supabase
      .from('storefront_orders')
      .update({ internal_notes: normalizedNotes });
    const { error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) throw error;

    window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
    return getOrderById(orderId);
  } catch (error) {
    console.warn('Updating local storefront order internal notes fallback:', error.message || error);
    const nextOrders = readOrders().map(normalizeOrder).map((order) => (
      order.id === orderId || order.orderNumber === orderId
        ? { ...order, internalNotes: normalizedNotes, updatedAt: new Date().toISOString() }
        : order
    ));
    writeOrders(nextOrders);
    return nextOrders.find((order) => order.id === orderId || order.orderNumber === orderId) || null;
  }
};

export const updateOrderShipment = async (orderId, shipmentData = {}) => {
  const shipmentStatus = shipmentData.shipmentStatus || 'not_ready';
  const currentOrder = await getOrderById(orderId, { sweepExpiredReservation: false });
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
    ? appendStatusTimeline(currentOrder?.statusTimeline, patch.status, `${shipmentStatusLabels[shipmentStatus]} from fulfillment`)
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

  try {
    const query = supabase
      .from('storefront_orders')
      .update(payload);
    const { error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) throw error;

    window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
    await createOrderAuditLog(shipmentAudit);
    return getOrderById(orderId);
  } catch (error) {
    console.warn('Updating local storefront order shipment fallback:', error.message || error);
    const nextOrders = readOrders().map(normalizeOrder).map((order) => (
      order.id === orderId || order.orderNumber === orderId
        ? {
          ...order,
          shipmentStatus,
          courierName: patch.courier_name || '',
          trackingNumber: patch.tracking_number || '',
          trackingUrl: patch.tracking_url || '',
          shippedAt: patch.shipped_at || '',
          deliveredAt: patch.delivered_at || '',
          packingNotes: patch.packing_notes || '',
          ...(patch.status ? { status: patch.status, statusTimeline } : {}),
          updatedAt: new Date().toISOString(),
        }
        : order
    ));
    writeOrders(nextOrders);
    await createOrderAuditLog({
      ...shipmentAudit,
      metadata: {
        ...shipmentAudit.metadata,
        persistence: 'local',
      },
    });
    return nextOrders.find((order) => order.id === orderId || order.orderNumber === orderId) || null;
  }
};

export const updateOrderBespokeProductionStatus = async (orderId, productionStatus) => {
  const currentOrder = await getOrderById(orderId, { sweepExpiredReservation: false });
  const bespokeProductionTimeline = appendBespokeProductionTimeline(
    currentOrder?.bespokeProductionTimeline,
    productionStatus,
    'Bespoke production updated from Studio',
  );
  const patch = {
    bespoke_production_status: productionStatus,
    bespoke_production_timeline: bespokeProductionTimeline,
    ...(productionStatus === 'production' ? { status: 'processing' } : {}),
  };

  try {
    const query = supabase
      .from('storefront_orders')
      .update(patch);
    const { error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) throw error;

    window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
    return getOrderById(orderId);
  } catch (error) {
    console.warn('Updating local bespoke production fallback:', error.message || error);
    const nextOrders = readOrders().map(normalizeOrder).map((order) => (
      order.id === orderId || order.orderNumber === orderId
        ? {
          ...order,
          bespokeProductionStatus: productionStatus,
          bespokeProductionTimeline,
          ...(patch.status ? { status: patch.status } : {}),
          updatedAt: new Date().toISOString(),
        }
        : order
    ));
    writeOrders(nextOrders);
    return nextOrders.find((order) => order.id === orderId || order.orderNumber === orderId) || null;
  }
};

export const updateOrderProductionLinks = async (orderId, productionLinks = {}) => {
  const normalizedLinks = normalizeProductionLinks({
    ...productionLinks,
    updatedAt: new Date().toISOString(),
  });

  try {
    const query = supabase
      .from('storefront_orders')
      .update({ production_links: normalizedLinks });
    const { error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) throw error;

    window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
    return getOrderById(orderId);
  } catch (error) {
    console.warn('Updating local production links fallback:', error.message || error);
    const nextOrders = readOrders().map(normalizeOrder).map((order) => (
      order.id === orderId || order.orderNumber === orderId
        ? { ...order, productionLinks: normalizedLinks, updatedAt: new Date().toISOString() }
        : order
    ));
    writeOrders(nextOrders);
    return nextOrders.find((order) => order.id === orderId || order.orderNumber === orderId) || null;
  }
};

const markOrderInventoryDeducted = async (orderId, events = []) => {
  const inventoryEvents = normalizeInventoryEvents(events).map((event) => ({
    ...event,
    at: event.at || new Date().toISOString(),
  }));

  try {
    const query = supabase
      .from('storefront_orders')
      .update({
        inventory_deducted: true,
        inventory_events: inventoryEvents,
      });
    const { error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) throw error;
  } catch (error) {
    console.warn('Marking inventory deduction locally:', error.message || error);
    const nextOrders = readOrders().map(normalizeOrder).map((order) => (
      order.id === orderId || order.orderNumber === orderId
        ? { ...order, inventoryDeducted: true, inventoryEvents, updatedAt: new Date().toISOString() }
        : order
    ));
    writeOrders(nextOrders);
  }
};

const markOrderInventoryRestored = async (orderId, currentEvents = [], restoreEvents = []) => {
  const inventoryEvents = [
    ...normalizeInventoryEvents(currentEvents),
    ...normalizeInventoryEvents(restoreEvents),
  ];

  try {
    const query = supabase
      .from('storefront_orders')
      .update({
        inventory_deducted: false,
        inventory_events: inventoryEvents,
      });
    const { error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) throw error;
  } catch (error) {
    console.warn('Marking inventory restore locally:', error.message || error);
    const nextOrders = readOrders().map(normalizeOrder).map((order) => (
      order.id === orderId || order.orderNumber === orderId
        ? { ...order, inventoryDeducted: false, inventoryEvents, updatedAt: new Date().toISOString() }
        : order
    ));
    writeOrders(nextOrders);
  }
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
}) => {
  const currentOrder = await getOrderById(orderId, { sweepExpiredReservation: false });
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
    ...(status ? { status } : {}),
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
      status: status || currentOrder?.status || '',
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

  try {
    const query = supabase
      .from('storefront_orders')
      .update(patch);
    const { error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) {
      const missingDokuResponseColumn = String(error.message || '').includes('doku_response');
      if (missingDokuResponseColumn) {
        const retryPatch = { ...patch };
        delete retryPatch.doku_response;
        const retryQuery = supabase
          .from('storefront_orders')
          .update(retryPatch);
        const { error: retryError } = await (isUuid(orderId) ? retryQuery.eq('id', orderId) : retryQuery.eq('order_number', orderId));
        if (retryError) throw retryError;
        window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
      } else {
      const missingPaymentSessionColumn = ['payment_url', 'payment_expires_at', 'payment_session_id', 'payment_response']
        .some((column) => String(error.message || '').includes(column));
      if (missingPaymentSessionColumn) {
        const legacyPatch = {
          payment_status: paymentStatus,
          payment_provider: paymentProvider,
          payment_reference: paymentReference,
          ...(status ? { status } : {}),
        };
        const retryQuery = supabase
          .from('storefront_orders')
          .update(legacyPatch);
        const { error: retryError } = await (isUuid(orderId) ? retryQuery.eq('id', orderId) : retryQuery.eq('order_number', orderId));
        if (retryError) throw retryError;
        window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
      } else {
        throw error;
      }
      }
    } else {
      window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
    }
    await createOrderAuditLog(paymentAudit);
    if (status === 'cancelled') {
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
  } catch (error) {
    console.warn('Updating local storefront order payment fallback:', error.message || error);
    const nextOrders = readOrders().map(normalizeOrder).map((order) => (
      order.id === orderId || order.orderNumber === orderId
        ? {
          ...order,
          paymentStatus,
          paymentProvider,
          paymentReference: paymentReference ?? order.paymentReference,
          paymentUrl: paymentUrl ?? order.paymentUrl,
          paymentExpiresAt: paymentExpiresAt ?? order.paymentExpiresAt,
          paymentSessionId: paymentSessionId ?? order.paymentSessionId,
          paymentResponse: paymentResponse ?? order.paymentResponse,
          ...(status ? { status } : {}),
          updatedAt: new Date().toISOString(),
        }
        : order
    ));
    writeOrders(nextOrders);
    await createOrderAuditLog({
      ...paymentAudit,
      metadata: {
        ...paymentAudit.metadata,
        persistence: 'local',
      },
    });
    if (status === 'cancelled') {
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
          persistence: 'local',
        },
      });
    }
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
};

export const deleteOrder = async (orderId) => {
  const currentOrder = await getOrderById(orderId, { sweepExpiredReservation: false });
  try {
    const query = supabase
      .from('storefront_orders')
      .delete();
    const { error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) {
      throw error;
    }

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
  } catch (error) {
    console.warn('Deleting local storefront order fallback:', error.message || error);
    const nextOrders = readOrders().map(normalizeOrder).filter((order) => order.id !== orderId && order.orderNumber !== orderId);
    writeOrders(nextOrders);
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
        persistence: 'local',
      },
    });
    return nextOrders;
  }
};

export const clearOrders = () => writeOrders([]);
