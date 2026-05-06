export const ORDERS_STORAGE_KEY = 'dekito.storefront.orders.v1';

const orderStatusLabels = {
  new: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  completed: 'Completed',
  cancelled: 'Cancelled',
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

export const getOrderStatusLabels = () => orderStatusLabels;

export const getOrders = () => readOrders();

export const getOrderSummary = (orders) => ({
  total: orders.length,
  active: orders.filter((order) => !['completed', 'cancelled'].includes(order.status)).length,
  completed: orders.filter((order) => order.status === 'completed').length,
  revenue: orders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + Number(order.subtotal || 0), 0),
});

export const createOrder = ({ customerName, contact, notes, items, subtotal, quantity, checkoutDraft }) => {
  const createdAt = new Date().toISOString();
  const order = {
    id: `DKT-${Date.now().toString(36).toUpperCase()}`,
    status: 'new',
    customerName: customerName?.trim() || 'Walk-in customer',
    contact: contact?.trim() || '-',
    notes: notes?.trim() || '',
    items: items.map((item) => ({ ...item })),
    quantity,
    subtotal,
    checkoutDraft,
    createdAt,
    updatedAt: createdAt,
  };

  const nextOrders = [order, ...readOrders()];
  writeOrders(nextOrders);
  return order;
};

export const updateOrderStatus = (orderId, status) => {
  const nextOrders = readOrders().map((order) => (
    order.id === orderId
      ? { ...order, status, updatedAt: new Date().toISOString() }
      : order
  ));
  writeOrders(nextOrders);
  return nextOrders;
};

export const deleteOrder = (orderId) => {
  const nextOrders = readOrders().filter((order) => order.id !== orderId);
  writeOrders(nextOrders);
  return nextOrders;
};

export const clearOrders = () => writeOrders([]);
