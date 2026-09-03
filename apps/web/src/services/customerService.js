import supabase from '@/lib/supabaseClient.js';


const normalizeCustomerCode = (value = '') => value.trim().toUpperCase();
const isCustomerCode = (value = '') => /^SOLI[0-9]{5}$/.test(normalizeCustomerCode(value));


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
  masked: Boolean(customer.masked),
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
  source: order.source || 'storefront',
  bespokeProductionStatus: order.bespoke_production_status || order.bespokeProductionStatus || '',
  bespokeProductionTimeline: Array.isArray(order.bespoke_production_timeline || order.bespokeProductionTimeline)
    ? order.bespoke_production_timeline || order.bespokeProductionTimeline
    : [],
  shipmentStatus: order.shipment_status || order.shipmentStatus || 'not_ready',
  courierName: order.courier_name || order.courierName || '',
  trackingNumber: order.tracking_number || order.trackingNumber || '',
  trackingUrl: order.tracking_url || order.trackingUrl || '',
  shippedAt: order.shipped_at || order.shippedAt || '',
  deliveredAt: order.delivered_at || order.deliveredAt || '',
  packingNotes: order.packing_notes || order.packingNotes || '',
  createdAt: order.created_at || order.createdAt || new Date().toISOString(),
  updatedAt: order.updated_at || order.updatedAt || order.created_at || order.createdAt || new Date().toISOString(),
});

const buildLockedPortalCustomer = (customer = {}) => ({
  ...customer,
  customerName: 'Protected customer',
  contact: '',
  deliveryAddress: '',
  deliveryArea: '',
  notes: '',
  orderCount: 0,
  lastOrderAt: '',
  requiresSecurity: true,
});






// Offline fallback for checkout lookup: never return a security-protected record,
// because the security answer can't be verified locally.


export const getCustomers = async () => {
  try {
    const { data, error } = await supabase
      .from('storefront_customers')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(normalizeCustomer);
  } catch (error) {
    // The localStorage mirror this used to fall back to is gone — nothing writes it since the fabricated
    // customer code was removed, so it could only ever have returned an empty list dressed as data.
    console.warn('Failed to load storefront customers:', error.message || error);
    throw new Error(`Daftar pelanggan gagal dimuat: ${error.message || 'coba lagi'}`);
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
    // "Not found" and "lookup failed" must not look the same to the caller, but neither can be served
    // from a cache that nothing writes any more.
    console.warn('Customer lookup failed:', error.message || error);
    return null;
  }
};

export const lookupCheckoutCustomerByCode = async (customerCode, securityAnswer = '') => {
  const normalizedCode = normalizeCustomerCode(customerCode);
  if (!normalizedCode) return null;

  try {
    const { data, error } = await supabase.rpc('storefront_customer_checkout_lookup', {
      p_customer_code: normalizedCode,
      p_security_answer: securityAnswer?.trim() || null,
    });

    if (error) throw error;
    const customer = data?.[0]?.customer;
    if (!customer?.customer_code) return null;

    return normalizeCustomer(customer);
  } catch (error) {
    console.warn('Checkout customer lookup failed:', error.message || error);
    return null;
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

    const customer = normalizeCustomer(result.customer);
    const requiresSecurity = Boolean(result.customer.requires_security || customer.requiresSecurity);

    if (requiresSecurity) {
      return {
        customer: buildLockedPortalCustomer(customer),
        orders: [],
        requiresSecurity: true,
        persistence: 'database',
      };
    }

    return {
      customer,
      orders: Array.isArray(result.orders) ? result.orders.map(normalizePortalOrder) : [],
      requiresSecurity: false,
      persistence: 'database',
    };
  } catch (error) {
    // Serving the portal from localStorage was also a privacy edge: on a shared device it showed whatever
    // customer had last used that browser. There is nothing to serve now, and nothing to leak.
    console.warn('Customer portal lookup failed:', error.message || error);
    return null;
  }
};

const buildAccountPortalResult = (result) => {
  if (!result?.customer?.customer_code) return null;
  return {
    customer: normalizeCustomer(result.customer),
    orders: Array.isArray(result.orders) ? result.orders.map(normalizePortalOrder) : [],
    requiresSecurity: false,
    persistence: 'database',
  };
};

// Load the logged-in customer's portal by their linked account (no code needed).
export const getCustomerAccount = async () => {
  try {
    const { data, error } = await supabase.rpc('storefront_customer_account');
    if (error) throw error;
    return buildAccountPortalResult(data?.[0]);
  } catch (error) {
    console.warn('Customer account lookup failed:', error.message || error);
    return null;
  }
};

// Link an existing SOLIxxxxx code to the logged-in account (security-question gated).
export const claimCustomerCode = async (customerCode, securityAnswer = '') => {
  const { data, error } = await supabase.rpc('storefront_claim_customer_code', {
    p_customer_code: normalizeCustomerCode(customerCode),
    p_security_answer: securityAnswer?.trim() || null,
  });
  if (error) throw new Error(error.message || 'Gagal menautkan kode');
  const result = buildAccountPortalResult(data?.[0]);
  if (!result) throw new Error('Kode customer tidak ditemukan');
  return result;
};

// Save/update the logged-in customer's profile + delivery address (address book).
export const saveCustomerAccount = async ({ customerName, contact, deliveryAddress = '', deliveryArea = '' }) => {
  const { data, error } = await supabase.rpc('storefront_save_customer_account', {
    p_customer_name: customerName?.trim() || null,
    p_contact: contact?.trim() || null,
    p_delivery_address: deliveryAddress?.trim() || null,
    p_delivery_area: deliveryArea?.trim() || null,
  });
  if (error) throw new Error(error.message || 'Gagal menyimpan profil');
  const result = buildAccountPortalResult(data?.[0]);
  if (!result) throw new Error('Gagal menyimpan profil');
  return result;
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

  // No local fallback. It used to invent a code with `SOLI` + five random digits and hand it to the buyer
  // as their customer code — a code that exists in no database, that they would later type into the portal
  // to be told it does not exist, and that can collide with a real one. A checkout that cannot record its
  // customer has to fail, not improvise (audit round 9, CU-1).
  const { data, error } = await supabase.rpc('storefront_upsert_customer', {
    p_customer_code: isCustomerCode(customerCode) ? normalizeCustomerCode(customerCode) : null,
    p_customer_name: customerName.trim(),
    p_contact: contact.trim(),
    p_delivery_address: deliveryAddress?.trim() || null,
    p_delivery_area: deliveryArea?.trim() || null,
    p_notes: notes?.trim() || null,
    p_increment_order: incrementOrder,
  });

  if (error) {
    throw new Error(`Data pelanggan gagal disimpan: ${error.message}. Pesanan belum dibuat — coba lagi.`);
  }

  return data?.[0] ? normalizeCustomer(data[0]) : null;
};

export const getCustomerSummary = (customers) => ({
  total: customers.length,
  repeat: customers.filter((customer) => Number(customer.orderCount || 0) > 1).length,
  orders: customers.reduce((sum, customer) => sum + Number(customer.orderCount || 0), 0),
});
