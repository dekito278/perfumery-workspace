import supabase from '@/lib/supabaseClient.js';
import { saveCustomer } from '@/services/customerService.js';

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

const localOnlyStatuses = {
  new: 'pending_payment',
  confirmed: 'paid',
  preparing: 'processing',
};

const BESPOKE_SOURCE = 'bespoke_request';

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
    persistence: order.persistence || 'database',
    createdAt: order.created_at || order.createdAt || new Date().toISOString(),
    updatedAt: order.updated_at || order.updatedAt || order.created_at || order.createdAt || new Date().toISOString(),
  };
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
  exoticMaterial,
  paymentProvider,
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
  formatLine('Cap design', capDesign),
  formatLine('Exotic material', exoticMaterial),
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
  exoticMaterial,
  referenceProductName,
}) => [
  formatLine('Mood', mood),
  formatLine('Occasion', occasion),
  formatLine('Budget', budget),
  formatLine('Size', size),
  formatLine('Preferred aroma', preferredNotes || scentDescription),
  formatLine('Avoided notes', avoidedNotes),
  formatLine('Story', story),
  formatLine('Cap design', capDesign),
  formatLine('Exotic material', exoticMaterial),
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

export const getOrderSummary = (orders) => ({
  total: orders.length,
  active: orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length,
  completed: orders.filter((order) => order.status === 'completed').length,
  revenue: orders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + Number(order.subtotal || 0), 0),
});

export const createOrder = async (orderData) => {
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

  try {
    const { error } = await supabase
      .from('storefront_orders')
      .insert(payload);

    if (error) {
      throw error;
    }

    window.dispatchEvent(new CustomEvent('dekito:orders-updated'));
    return normalizeOrder({
      id: payload.order_number,
      ...payload,
      persistence: 'database',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Saving storefront order locally because database save failed:', error.message || error);
    return createLocalOrder(payload);
  }
};

export const createBespokeRequest = async (requestData) => {
  const normalizedRequest = {
    ...requestData,
    customerName: requestData.customerName || requestData.name,
  };
  const aromaBrief = normalizedRequest.preferredNotes || normalizedRequest.scentDescription || normalizedRequest.mood || 'Custom aroma brief';
  const item = {
    slug: 'bespoke-perfume-request',
    type: BESPOKE_SOURCE,
    name: 'Bespoke perfume request',
    quantity: 1,
    price: normalizedRequest.budget || 'Custom quote',
    size: normalizedRequest.size || '-',
    notes: aromaBrief,
    mood: normalizedRequest.mood || '',
    occasion: normalizedRequest.occasion || '',
    budget: normalizedRequest.budget || '',
    preferredNotes: normalizedRequest.preferredNotes || normalizedRequest.scentDescription || '',
    avoidedNotes: normalizedRequest.avoidedNotes || '',
    story: normalizedRequest.story || '',
    capDesign: normalizedRequest.capDesign || '',
    exoticMaterial: normalizedRequest.exoticMaterial || '',
    referenceProductName: normalizedRequest.referenceProductName || '',
    referenceProductSlug: normalizedRequest.referenceProductSlug || '',
  };

  return createOrder({
    customerCode: normalizedRequest.customerCode,
    customerName: normalizedRequest.customerName,
    contact: normalizedRequest.contact,
    notes: buildBespokeNotes(normalizedRequest),
    items: [item],
    quantity: 1,
    subtotal: 0,
    checkoutDraft: buildBespokeCheckoutDraft(normalizedRequest),
    paymentProvider: normalizedRequest.paymentProvider || 'manual',
    source: BESPOKE_SOURCE,
  });
};

export const updateOrderStatus = async (orderId, status) => {
  try {
    const { error } = await supabase
      .from('storefront_orders')
      .update({ status })
      .eq('id', orderId);

    if (error) {
      throw error;
    }

    return getOrders();
  } catch (error) {
    console.warn('Updating local storefront order fallback:', error.message || error);
    const nextOrders = readOrders().map(normalizeOrder).map((order) => (
      order.id === orderId || order.orderNumber === orderId
        ? { ...order, status, updatedAt: new Date().toISOString() }
        : order
    ));
    writeOrders(nextOrders);
    return nextOrders;
  }
};

export const deleteOrder = async (orderId) => {
  try {
    const { error } = await supabase
      .from('storefront_orders')
      .delete()
      .eq('id', orderId);

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
