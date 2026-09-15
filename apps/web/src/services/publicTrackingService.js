import supabase from '@/lib/supabaseClient.js';
import { ORDERS_STORAGE_KEY } from '@/services/orderService.js';

const normalizeLookup = (value = '') => String(value || '').trim();

const maskCustomerName = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return 'Customer';
  const [firstWord = 'Customer'] = text.split(/\s+/);
  return `${firstWord.charAt(0).toUpperCase()}${firstWord.length > 1 ? '***' : ''}`;
};

const normalizePublicTrackingOrder = (order = {}) => ({
  orderNumber: order.order_number || order.orderNumber || '',
  customerName: order.customer_name_masked || order.customerNameMasked || maskCustomerName(order.customer_name || order.customerName),
  status: order.status || 'pending_payment',
  paymentStatus: order.payment_status || order.paymentStatus || 'unpaid',
  shipmentStatus: order.shipment_status || order.shipmentStatus || 'not_ready',
  courierName: order.courier_name || order.courierName || '',
  trackingNumber: order.tracking_number || order.trackingNumber || '',
  trackingUrl: order.tracking_url || order.trackingUrl || '',
  shippedAt: order.shipped_at || order.shippedAt || '',
  deliveredAt: order.delivered_at || order.deliveredAt || '',
  createdAt: order.created_at || order.createdAt || '',
  updatedAt: order.updated_at || order.updatedAt || '',
  itemCount: Number(order.item_count || order.itemCount || order.quantity || 0),
  matchedBy: order.matched_by || order.matchedBy || '',
});

const getLocalTrackingOrder = (lookup) => {
  if (typeof window === 'undefined') return null;

  try {
    const normalized = normalizeLookup(lookup).toLowerCase();
    if (!normalized) return null;
    const orders = JSON.parse(window.localStorage.getItem(ORDERS_STORAGE_KEY) || '[]');
    const match = orders.find((order) => [
      order.order_number,
      order.orderNumber,
      order.tracking_number,
      order.trackingNumber,
    ].some((value) => String(value || '').trim().toLowerCase() === normalized));

    return match ? normalizePublicTrackingOrder({ ...match, matchedBy: 'local' }) : null;
  } catch {
    return null;
  }
};

export const buildPublicTrackingPath = (orderNumber = '') => {
  const code = normalizeLookup(orderNumber);
  return code ? `/track/${encodeURIComponent(code)}` : '/track';
};

export const buildPublicTrackingUrl = (orderNumber = '') => {
  const path = buildPublicTrackingPath(orderNumber);
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
};

export const buildCourierTrackingSearchUrl = ({ courierName = '', trackingNumber = '' } = {}) => {
  const tracking = normalizeLookup(trackingNumber);
  if (!tracking) return '';

  const courier = normalizeLookup(courierName);
  const query = courier
    ? `${courier} cek resi ${tracking}`
    : `cek resi ${tracking}`;

  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
};

export const getPublicTrackingOrder = async (lookup) => {
  const normalizedLookup = normalizeLookup(lookup);
  if (!normalizedLookup) return null;

  try {
    const { data, error } = await supabase.rpc('storefront_public_tracking_lookup', {
      p_lookup: normalizedLookup,
    });

    if (error) throw error;
    // The server ANSWERED and has no such order. Falling through to the local copy is still right — a
    // buyer who ordered on this device can see their own order while the row is still propagating — and
    // null here is an honest "we looked, it is not there".
    if (!data?.order_number) return getLocalTrackingOrder(normalizedLookup);
    return normalizePublicTrackingOrder(data);
  } catch (error) {
    // The lookup FAILED — offline, Supabase down, RPC renamed. The local copy may still have it, and if
    // it does that is a real answer worth giving.
    const local = getLocalTrackingOrder(normalizedLookup);
    if (local) {
      console.warn('Using local public tracking fallback:', error.message || error);
      return local;
    }
    // But with nothing local, returning null said "your order does not exist" about a lookup that never
    // happened. A buyer on a flaky connection was told their real order was not found — and the tracking
    // page's own catch could never fire, because this swallowed everything. Rethrow: not knowing is not
    // the same as knowing there is nothing.
    throw error;
  }
};
