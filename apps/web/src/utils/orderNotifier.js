// Tell the owner an order happened.
//
// Nothing in the app did this: api/orders/create inserted the row and returned, and the only WhatsApp code
// is a manual handoff the admin triggers themselves. So the only way to learn an order had arrived was to
// open the studio and look — and a manual-transfer buyer who has already sent money waits until someone
// does.
//
// Deliberately provider-agnostic: one webhook URL, posted as JSON. That works with Telegram, Fonnte and the
// other Indonesian WA gateways, Zapier/Make/n8n, or anything that accepts a POST — so the shop is not
// married to a vendor, and no secret beyond the URL (plus optional headers) lives in this repo.
//
// Silent when unconfigured, and it NEVER fails the order: a checkout must not break because a notification
// endpoint is slow or down.

const TIMEOUT_MS = 4000;

const rupiah = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(Number(value || 0)))}`;

export const buildOrderAlert = ({ order, event = 'created', siteUrl = '' }) => {
  const orderNumber = order?.order_number || order?.orderNumber || '(tanpa nomor)';
  const total = rupiah(order?.subtotal);
  const customer = String(order?.customer_name || order?.customerName || 'Tanpa nama').trim();
  const contact = String(order?.contact || '').trim();
  const provider = String(order?.payment_provider || order?.paymentProvider || '').trim();
  const isManual = ['manual', 'manual_transfer_bca'].includes(provider);

  const heading = event === 'paid'
    ? `PEMBAYARAN MASUK — ${orderNumber}`
    : `ORDER BARU — ${orderNumber}`;

  // The next action is the point of the message. A manual-transfer order needs the owner to review a
  // proof; a paid one needs packing.
  const nextStep = event === 'paid'
    ? 'Siap diproses — cek Orders > Sudah bayar.'
    : isManual
      ? 'Transfer manual: pembeli akan upload bukti. Cek Orders > Review bukti.'
      : 'Menunggu pembayaran gateway.';

  const lines = [
    heading,
    `Total   : ${total}`,
    `Pembeli : ${customer}${contact ? ` (${contact})` : ''}`,
    provider ? `Bayar   : ${provider}` : '',
    '',
    nextStep,
    siteUrl ? `${siteUrl.replace(/\/+$/, '')}/studio/orders` : '',
  ].filter(Boolean);

  const text = lines.join('\n');

  return {
    // Same string under the three field names the common endpoints expect: `text` (Telegram, Slack,
    // n8n), `message` (Fonnte and the other Indonesian WA gateways), `content` (Discord). Cheaper than
    // a per-provider adapter, and it keeps "paste your URL" honest.
    text,
    message: text,
    content: text,
    event,
    orderNumber,
    total: Math.round(Number(order?.subtotal || 0)),
    customer,
    contact,
    paymentProvider: provider,
  };
};

const parseJsonEnv = (raw, name) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    console.warn(`${name} is not valid JSON — ignoring it.`);
    return {};
  }
};

export const sendOrderAlert = async ({ order, event = 'created', env = {} }) => {
  const url = String(env.ORDER_ALERT_WEBHOOK_URL || '').trim();
  if (!url) return { sent: false, reason: 'not_configured' };

  const payload = {
    ...buildOrderAlert({ order, event, siteUrl: env.SITE_URL || '' }),
    // Where the endpoint needs a recipient it cannot infer — Telegram's chat_id, Fonnte's target.
    ...parseJsonEnv(env.ORDER_ALERT_EXTRA, 'ORDER_ALERT_EXTRA'),
  };

  // A slow endpoint must not hold the buyer's checkout open.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...parseJsonEnv(env.ORDER_ALERT_HEADERS, 'ORDER_ALERT_HEADERS') },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`Order alert rejected by webhook (${response.status})`);
      return { sent: false, reason: `http_${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    console.warn('Order alert failed:', error.message || error);
    return { sent: false, reason: 'error' };
  } finally {
    clearTimeout(timer);
  }
};
