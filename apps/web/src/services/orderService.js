import supabase from '@/lib/supabaseClient.js';

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

const normalizeOrder = (order) => ({
  id: order.id,
  orderNumber: order.order_number || order.orderNumber || order.id,
  status: localOnlyStatuses[order.status] || order.status || 'pending_payment',
  customerName: order.customer_name || order.customerName || 'Walk-in customer',
  contact: order.contact || '-',
  notes: order.notes || '',
  items: Array.isArray(order.items) ? order.items : [],
  quantity: Number(order.quantity || 0),
  subtotal: Number(order.subtotal || 0),
  checkoutDraft: order.checkout_draft || order.checkoutDraft || '',
  paymentProvider: order.payment_provider || order.paymentProvider || 'manual',
  paymentStatus: order.payment_status || order.paymentStatus || 'unpaid',
  paymentReference: order.payment_reference || order.paymentReference || '',
  persistence: order.persistence || 'database',
  createdAt: order.created_at || order.createdAt || new Date().toISOString(),
  updatedAt: order.updated_at || order.updatedAt || order.created_at || order.createdAt || new Date().toISOString(),
});

const buildOrderPayload = ({
  customerName,
  contact,
  notes,
  items,
  subtotal,
  quantity,
  checkoutDraft,
  paymentProvider = 'manual',
}) => ({
  order_number: createOrderNumber(),
  status: 'pending_payment',
  customer_name: customerName?.trim() || 'Walk-in customer',
  contact: contact?.trim() || '-',
  notes: notes?.trim() || '',
  items: items.map((item) => ({ ...item })),
  quantity,
  subtotal,
  checkout_draft: checkoutDraft,
  payment_provider: paymentProvider,
  payment_status: paymentProvider === 'manual' ? 'pending' : 'unpaid',
  source: 'storefront',
});

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
  const payload = buildOrderPayload(orderData);

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
