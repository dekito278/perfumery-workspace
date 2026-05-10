import supabase from '@/lib/supabaseClient.js';
import { saveCustomer } from '@/services/customerService.js';
import { deductInventoryForOrder, restoreInventoryForOrder, validateOrderStock } from '@/services/productCatalogService.js';

export const ORDERS_STORAGE_KEY = 'dekito.storefront.orders.v1';

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
    created_at: createdAt,
    updated_at: createdAt,
  });

  const nextOrders = [order, ...readOrders().map(normalizeOrder)];
  writeOrders(nextOrders);
  return order;
};

export const getOrderStatusLabels = () => orderStatusLabels;
export const getShipmentStatusLabels = () => shipmentStatusLabels;
export const getBespokeProductionStatusLabels = () => bespokeProductionStatusLabels;

export const getLocalOrders = () => readOrders().map(normalizeOrder);

export const getOrders = async () => {
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

export const getOrderById = async (orderId) => {
  const localMatch = getLocalOrders().find((order) => order.id === orderId || order.orderNumber === orderId);

  try {
    const query = supabase
      .from('storefront_orders')
      .select('*')
      .limit(1);
    const { data, error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) throw error;
    return data?.[0] ? normalizeOrder(data[0]) : localMatch || null;
  } catch (error) {
    console.warn('Using local storefront order detail fallback:', error.message || error);
    return localMatch || null;
  }
};

export const getOrderPaymentLogs = async (orderIdOrNumber) => {
  const order = await getOrderById(orderIdOrNumber);
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
  const currentOrder = await getOrderById(orderId);
  const statusTimeline = appendStatusTimeline(currentOrder?.statusTimeline, status, 'Status updated from Studio');

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
  const currentOrder = await getOrderById(orderId);
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

  try {
    const query = supabase
      .from('storefront_orders')
      .update(payload);
    const { error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) throw error;

    window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
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
    return nextOrders.find((order) => order.id === orderId || order.orderNumber === orderId) || null;
  }
};

export const updateOrderBespokeProductionStatus = async (orderId, productionStatus) => {
  const currentOrder = await getOrderById(orderId);
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
  paymentReference = '',
  paymentUrl = '',
  paymentExpiresAt = '',
  paymentSessionId = '',
  paymentResponse = null,
  status,
}) => {
  const currentOrder = await getOrderById(orderId);
  const patch = {
    payment_status: paymentStatus,
    payment_provider: paymentProvider,
    payment_reference: paymentReference,
    ...(paymentUrl ? { payment_url: paymentUrl } : {}),
    ...(paymentExpiresAt ? { payment_expires_at: paymentExpiresAt } : {}),
    ...(paymentSessionId ? { payment_session_id: paymentSessionId } : {}),
    ...(paymentResponse && typeof paymentResponse === 'object' ? {
      payment_response: paymentResponse,
      doku_response: paymentResponse,
    } : {}),
    ...(status ? { status } : {}),
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
  } catch (error) {
    console.warn('Updating local storefront order payment fallback:', error.message || error);
    const nextOrders = readOrders().map(normalizeOrder).map((order) => (
      order.id === orderId || order.orderNumber === orderId
        ? {
          ...order,
          paymentStatus,
          paymentProvider,
          paymentReference,
          paymentUrl,
          paymentExpiresAt,
          paymentSessionId,
          paymentResponse: paymentResponse || order.paymentResponse,
          ...(status ? { status } : {}),
          updatedAt: new Date().toISOString(),
        }
        : order
    ));
    writeOrders(nextOrders);
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
  try {
    const query = supabase
      .from('storefront_orders')
      .delete();
    const { error } = await (isUuid(orderId) ? query.eq('id', orderId) : query.eq('order_number', orderId));

    if (error) {
      throw error;
    }

    return getOrders();
  } catch (error) {
    console.warn('Deleting local storefront order fallback:', error.message || error);
    const nextOrders = readOrders().map(normalizeOrder).filter((order) => order.id !== orderId && order.orderNumber !== orderId);
    writeOrders(nextOrders);
    return nextOrders;
  }
};

export const clearOrders = () => writeOrders([]);
