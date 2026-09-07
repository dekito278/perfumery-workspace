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

// This endpoint mass-cancels unpaid orders and releases their stock, so it fails closed everywhere.
//
// It used to require CRON_SECRET only when VERCEL_ENV === 'production'. Preview deployments normally
// inherit the same Supabase env vars, so anyone who found a preview URL could cancel every pending order
// in the live database (audit round 9). Keying the exemption off a Vercel-provided variable is also the
// wrong shape: if "expose system environment variables" is ever off, the exemption silently applies in
// production too. No exemption at all is the only version that cannot be wrong by configuration —
// running it locally just means setting CRON_SECRET in .env, the same as every other secret here.
const assertAuthorized = (request) => {
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  if (!cronSecret) {
    throw Object.assign(new Error('CRON_SECRET is not configured; refusing to sweep'), { statusCode: 401 });
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
  if (!ACTIVE_PAYMENT_STATUSES.includes(order.payment_status)) return false;
  if (['cancelled', 'completed'].includes(order.status)) return false;
  // Manual-transfer buyers sit at payment_status 'pending' until an admin approves their proof.
  // Once proof is submitted, the order is paid-awaiting-review — it must NEVER auto-cancel.
  // Mirrors the client guard in orderService.isOrderReservationExpired.
  if (order.payment_proof_status && !['missing', 'rejected'].includes(order.payment_proof_status)) return false;

  // Deducted (stock-reserving) orders expire on payment_expires_at OR created_at+TTL, so reserved
  // stock is always freed. Non-deducted orders (bespoke / stockless / deduct-failed) have no stock to
  // free and used to never expire → they piled up in "Menunggu bayar" forever. Cancel them too, but
  // ONLY when an EXPLICIT payment deadline lapsed — never auto-cancel an order that was never given a
  // payment window (e.g. a bespoke request still in discussion, no payment_expires_at set).
  const expiresAt = order.inventory_deducted
    ? getReservationExpiryDate(order)
    : (order.payment_expires_at ? new Date(order.payment_expires_at) : null);
  return Boolean(expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime());
};

const fetchExpirableOrders = async () => {
  const { restUrl, headers } = getSupabaseRestConfig();
  // Fetch ALL active-payment-status orders (both stock-reserving and non-deducted) — isExpiredReservation
  // then decides which are actually expired. Previously this filtered inventory_deducted=eq.true, which
  // is why non-deducted (bespoke/stockless) unpaid orders never got cancelled.
  const query = [
    'select=*',
    `payment_status=in.(${ACTIVE_PAYMENT_STATUSES.join(',')})`,
  ].join('&');
  const response = await fetch(`${restUrl}/storefront_orders?${query}`, { headers });

  if (!response.ok) {
    throw new Error(`Failed to read expirable orders: ${await response.text()}`);
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

const appendTimeline = (timeline, now, stockReleased) => {
  const entries = Array.isArray(timeline) ? timeline : [];
  return [
    ...entries,
    {
      status: 'cancelled',
      label: 'Cancelled',
      note: stockReleased
        ? 'Payment reservation expired; stock released automatically'
        : 'Payment reservation expired; order cancelled automatically',
      at: now.toISOString(),
    },
  ];
};

const releaseVoucherUsageForOrder = async (order) => {
  if (!order?.id && !order?.order_number) return;
  try {
    const { restUrl, headers } = getSupabaseRestConfig();
    await fetch(`${restUrl}/rpc/storefront_release_voucher_usage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_order_id: order.id || null,
        p_order_number: order.order_number || null,
      }),
    });
  } catch (error) {
    console.warn('Failed to release voucher usage:', error.message || error);
  }
};

const expireOrder = async (order, now) => {
  const { restUrl, headers } = getSupabaseRestConfig();
  const reason = 'Payment expired stock released automatically';
  // Only stock-reserving orders have anything to restore; non-deducted (bespoke/stockless) orders skip it.
  const restoreEvents = order.inventory_deducted ? await restoreInventoryForOrder(order, reason) : [];
  await releaseVoucherUsageForOrder(order);
  const response = await fetch(`${restUrl}/storefront_orders?order_number=eq.${encodeURIComponent(order.order_number)}`, {
    method: 'PATCH',
    headers: {
      ...headers,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status: 'cancelled',
      payment_status: 'expired',
      status_timeline: appendTimeline(order.status_timeline, now, Boolean(order.inventory_deducted)),
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
    const orders = await fetchExpirableOrders();
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
