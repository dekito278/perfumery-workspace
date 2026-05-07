import supabase from '@/lib/supabaseClient.js';

export const CUSTOMERS_STORAGE_KEY = 'dekito.storefront.customers.v1';

const normalizeCustomerCode = (value = '') => value.trim().toUpperCase();
const isCustomerCode = (value = '') => /^SOLI[0-9]{5}$/.test(normalizeCustomerCode(value));

const createLocalCustomerCode = () => `SOLI${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

const normalizeCustomer = (customer = {}) => ({
  id: customer.id || customer.customerCode || customer.customer_code,
  customerCode: customer.customer_code || customer.customerCode || '',
  customerName: customer.customer_name || customer.customerName || 'Customer',
  contact: customer.contact || '-',
  deliveryAddress: customer.delivery_address || customer.deliveryAddress || '',
  deliveryArea: customer.delivery_area || customer.deliveryArea || '',
  notes: customer.notes || '',
  orderCount: Number(customer.order_count || customer.orderCount || 0),
  lastOrderAt: customer.last_order_at || customer.lastOrderAt || '',
  securityQuestion: customer.security_question || customer.securityQuestion || '',
  requiresSecurity: Boolean(customer.requires_security || customer.requiresSecurity),
  securityEnabledAt: customer.security_enabled_at || customer.securityEnabledAt || '',
  persistence: customer.persistence || 'database',
  createdAt: customer.created_at || customer.createdAt || new Date().toISOString(),
  updatedAt: customer.updated_at || customer.updatedAt || customer.created_at || customer.createdAt || new Date().toISOString(),
});

const normalizePortalOrder = (order = {}) => ({
  orderNumber: order.order_number || order.orderNumber || '',
  status: order.status || 'pending_payment',
  items: Array.isArray(order.items) ? order.items : [],
  quantity: Number(order.quantity || 0),
  subtotal: Number(order.subtotal || 0),
  paymentProvider: order.payment_provider || order.paymentProvider || 'manual',
  paymentStatus: order.payment_status || order.paymentStatus || 'unpaid',
  paymentReference: order.payment_reference || order.paymentReference || '',
  source: order.source || 'storefront',
  createdAt: order.created_at || order.createdAt || new Date().toISOString(),
  updatedAt: order.updated_at || order.updatedAt || order.created_at || order.createdAt || new Date().toISOString(),
});

const readCustomers = () => {
  if (typeof window === 'undefined') return [];

  try {
    const value = window.localStorage.getItem(CUSTOMERS_STORAGE_KEY);
    return value ? JSON.parse(value) : [];
  } catch (error) {
    return [];
  }
};

const writeCustomers = (customers) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CUSTOMERS_STORAGE_KEY, JSON.stringify(customers));
  window.dispatchEvent(new CustomEvent('dekito:customers-updated'));
};

const saveLocalCustomer = ({
  customerCode = '',
  customerName,
  contact,
  deliveryAddress = '',
  deliveryArea = '',
  notes = '',
  incrementOrder = false,
}) => {
  const now = new Date().toISOString();
  const normalizedCode = normalizeCustomerCode(customerCode);
  const validCode = isCustomerCode(normalizedCode) ? normalizedCode : '';
  const customers = readCustomers().map(normalizeCustomer);
  const current = customers.find((customer) => (
    (validCode && customer.customerCode === validCode)
    || customer.contact.toLowerCase() === contact.trim().toLowerCase()
  ));
  const nextCode = current?.customerCode || validCode || createLocalCustomerCode();

  const customer = normalizeCustomer({
    ...current,
    id: current?.id || nextCode,
    customerCode: nextCode,
    customerName: customerName?.trim() || current?.customerName || 'Customer',
    contact: contact?.trim() || current?.contact || '-',
    deliveryAddress: deliveryAddress?.trim() || current?.deliveryAddress || '',
    deliveryArea: deliveryArea?.trim() || current?.deliveryArea || '',
    notes: notes?.trim() || current?.notes || '',
    orderCount: Number(current?.orderCount || 0) + (incrementOrder ? 1 : 0),
    lastOrderAt: incrementOrder ? now : current?.lastOrderAt,
    persistence: 'local',
    createdAt: current?.createdAt || now,
    updatedAt: now,
  });

  const nextCustomers = [
    customer,
    ...customers.filter((item) => item.customerCode !== customer.customerCode && item.id !== customer.id),
  ];
  writeCustomers(nextCustomers);
  return customer;
};

export const getLocalCustomers = () => readCustomers().map(normalizeCustomer);

export const getCustomers = async () => {
  try {
    const { data, error } = await supabase
      .from('storefront_customers')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(normalizeCustomer);
  } catch (error) {
    console.warn('Using local storefront customers fallback:', error.message || error);
    return getLocalCustomers();
  }
};

export const lookupCustomerByCode = async (customerCode) => {
  const normalizedCode = normalizeCustomerCode(customerCode);
  if (!normalizedCode) return null;

  try {
    const { data, error } = await supabase.rpc('storefront_lookup_customer', {
      p_customer_code: normalizedCode,
    });

    if (error) throw error;
    return data?.[0] ? normalizeCustomer(data[0]) : null;
  } catch (error) {
    console.warn('Using local customer lookup fallback:', error.message || error);
    return getLocalCustomers().find((customer) => customer.customerCode === normalizedCode) || null;
  }
};

export const getCustomerPortalByCode = async (customerCode) => {
  const normalizedCode = normalizeCustomerCode(customerCode);
  if (!normalizedCode) return null;

  try {
    const { data, error } = await supabase.rpc('storefront_customer_portal', {
      p_customer_code: normalizedCode,
    });

    if (error) throw error;
    const result = data?.[0];
    if (!result?.customer?.customer_code) return null;

    return {
      customer: normalizeCustomer(result.customer),
      orders: Array.isArray(result.orders) ? result.orders.map(normalizePortalOrder) : [],
      requiresSecurity: Boolean(result.customer.requires_security),
      persistence: 'database',
    };
  } catch (error) {
    console.warn('Using local customer portal fallback:', error.message || error);
    const customer = getLocalCustomers().find((item) => item.customerCode === normalizedCode);
    if (!customer) return null;

    const orders = (() => {
      try {
        const value = window.localStorage.getItem('dekito.storefront.orders.v1');
        const localOrders = value ? JSON.parse(value) : [];
        return localOrders
          .filter((order) => (order.customer_code || order.customerCode) === normalizedCode)
          .map(normalizePortalOrder);
      } catch (readError) {
        return [];
      }
    })();

    return { customer, orders, requiresSecurity: false, persistence: 'local' };
  }
};

export const verifyCustomerPortalSecurity = async (customerCode, securityAnswer) => {
  const normalizedCode = normalizeCustomerCode(customerCode);
  if (!normalizedCode || !securityAnswer?.trim()) return null;

  try {
    const { data, error } = await supabase.rpc('storefront_customer_portal_verify', {
      p_customer_code: normalizedCode,
      p_security_answer: securityAnswer.trim(),
    });

    if (error) throw error;
    const result = data?.[0];
    if (!result?.customer?.customer_code) return null;

    return {
      customer: normalizeCustomer(result.customer),
      orders: Array.isArray(result.orders) ? result.orders.map(normalizePortalOrder) : [],
      requiresSecurity: false,
      persistence: 'database',
    };
  } catch (error) {
    console.warn('Customer portal security verification failed:', error.message || error);
    return null;
  }
};

export const setCustomerPortalSecurity = async ({
  customerCode,
  securityQuestion,
  securityAnswer,
  currentAnswer = '',
}) => {
  const normalizedCode = normalizeCustomerCode(customerCode);
  if (!normalizedCode || !securityQuestion?.trim() || !securityAnswer?.trim()) {
    throw new Error('Security question and answer are required');
  }

  const { data, error } = await supabase.rpc('storefront_customer_set_security', {
    p_customer_code: normalizedCode,
    p_security_question: securityQuestion.trim(),
    p_security_answer: securityAnswer.trim(),
    p_current_answer: currentAnswer?.trim() || null,
  });

  if (error) {
    throw error;
  }

  return data?.[0] || null;
};

export const saveCustomer = async ({
  customerCode = '',
  customerName,
  contact,
  deliveryAddress = '',
  deliveryArea = '',
  notes = '',
  incrementOrder = false,
}) => {
  if (!customerName?.trim() || !contact?.trim()) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('storefront_upsert_customer', {
      p_customer_code: isCustomerCode(customerCode) ? normalizeCustomerCode(customerCode) : null,
      p_customer_name: customerName.trim(),
      p_contact: contact.trim(),
      p_delivery_address: deliveryAddress?.trim() || null,
      p_delivery_area: deliveryArea?.trim() || null,
      p_notes: notes?.trim() || null,
      p_increment_order: incrementOrder,
    });

    if (error) throw error;
    const customer = data?.[0] ? normalizeCustomer(data[0]) : null;
    if (customer) {
      saveLocalCustomer({ ...customer, incrementOrder: false });
    }
    return customer;
  } catch (error) {
    console.warn('Saving storefront customer locally because database save failed:', error.message || error);
    return saveLocalCustomer({
      customerCode,
      customerName,
      contact,
      deliveryAddress,
      deliveryArea,
      notes,
      incrementOrder,
    });
  }
};

export const getCustomerSummary = (customers) => ({
  total: customers.length,
  repeat: customers.filter((customer) => Number(customer.orderCount || 0) > 1).length,
  orders: customers.reduce((sum, customer) => sum + Number(customer.orderCount || 0), 0),
});
