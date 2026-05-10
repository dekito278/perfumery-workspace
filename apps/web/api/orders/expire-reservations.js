import process from 'node:process';

const PAYMENT_RESERVATION_TTL_HOURS = Number(process.env.PAYMENT_RESERVATION_TTL_HOURS || 24);
const ACTIVE_PAYMENT_STATUSES = ['unpaid', 'pending'];

const jsonResponse = (response, status, body) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
};

const getHeader = (request, name) => (
  request.headers?.[name.toLowerCase()] || request.headers?.[name] || ''
);

const assertAuthorized = (request) => {
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  if (!cronSecret) {
    if (process.env.VERCEL_ENV === 'production') {
      throw Object.assign(new Error('CRON_SECRET is required in production'), { statusCode: 401 });
    }
    return;
  }

  const authorization = String(getHeader(request, 'authorization') || '').trim();
  if (authorization !== `Bearer ${cronSecret}`) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
};

const getSupabaseRestConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    restUrl: `${supabaseUrl.replace(/\/$/, '')}/rest/v1`,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
  };
};

const getReservationExpiryDate = (order) => {
  const paymentExpiry = order.payment_expires_at ? new Date(order.payment_expires_at) : null;
  if (paymentExpiry && Number.isFinite(paymentExpiry.getTime())) {
    return paymentExpiry;
  }

  const createdAt = order.created_at ? new Date(order.created_at) : null;
  if (createdAt && Number.isFinite(createdAt.getTime())) {
    return new Date(createdAt.getTime() + (PAYMENT_RESERVATION_TTL_HOURS * 60 * 60 * 1000));
  }

  return null;
};

const isExpiredReservation = (order, now) => {
  if (!order?.inventory_deducted) return false;
  if (!ACTIVE_PAYMENT_STATUSES.includes(order.payment_status)) return false;
  if (['cancelled', 'completed'].includes(order.status)) return false;

  const expiresAt = getReservationExpiryDate(order);
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
};

const fetchReservableOrders = async () => {
  const { restUrl, headers } = getSupabaseRestConfig();
  const query = [
    'select=*',
    'inventory_deducted=eq.true',
    `payment_status=in.(${ACTIVE_PAYMENT_STATUSES.join(',')})`,
  ].join('&');
  const response = await fetch(`${restUrl}/storefront_orders?${query}`, { headers });

  if (!response.ok) {
    throw new Error(`Failed to read reservable orders: ${await response.text()}`);
  }

  return response.json();
};

const restoreInventoryForOrder = async (order, reason) => {
  const { restUrl, headers } = getSupabaseRestConfig();
  const orderId = order.id || order.order_number;
  if (!orderId) return [];

  const response = await fetch(`${restUrl}/rpc/storefront_restore_inventory_for_order`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_order_id: orderId,
      p_reason: reason,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to restore inventory for ${order.order_number || order.id}: ${await response.text()}`);
  }

  return response.json();
};

const appendTimeline = (timeline, now) => {
  const entries = Array.isArray(timeline) ? timeline : [];
  return [
    ...entries,
    {
      status: 'cancelled',
      label: 'Cancelled',
      note: 'Payment reservation expired; stock released automatically',
      at: now.toISOString(),
    },
  ];
};

const expireOrder = async (order, now) => {
  const { restUrl, headers } = getSupabaseRestConfig();
  const reason = 'Payment expired stock released automatically';
  const restoreEvents = await restoreInventoryForOrder(order, reason);
  const response = await fetch(`${restUrl}/storefront_orders?order_number=eq.${encodeURIComponent(order.order_number)}`, {
    method: 'PATCH',
    headers: {
      ...headers,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status: 'cancelled',
      payment_status: 'expired',
      status_timeline: appendTimeline(order.status_timeline, now),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to expire order ${order.order_number}: ${await response.text()}`);
  }

  return {
    orderNumber: order.order_number,
    restoreEvents: Array.isArray(restoreEvents) ? restoreEvents.length : 0,
    expiredAt: now.toISOString(),
  };
};

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return jsonResponse(response, 405, { message: 'Method not allowed' });
  }

  try {
    assertAuthorized(request);
    const now = new Date();
    const orders = await fetchReservableOrders();
    const expiredOrders = orders.filter((order) => isExpiredReservation(order, now));
    const expired = [];
    const errors = [];

    for (const order of expiredOrders) {
      try {
        expired.push(await expireOrder(order, now));
      } catch (error) {
        errors.push({
          orderNumber: order.order_number || order.id,
          message: error.message || 'Failed to expire order',
        });
      }
    }

    return jsonResponse(response, errors.length ? 207 : 200, {
      ok: errors.length === 0,
      checked: orders.length,
      expired,
      errors,
      ttlHours: PAYMENT_RESERVATION_TTL_HOURS,
    });
  } catch (error) {
    return jsonResponse(response, error.statusCode || 500, {
      ok: false,
      message: error.message || 'Failed to expire payment reservations',
    });
  }
}
