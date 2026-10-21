import supabase from '@/lib/supabaseClient.js';
import { isPaymentToken } from '@/utils/paymentLinkToken.js';

// Reading one order by its payment token.
//
// Through the RPC, never the table: storefront_orders is shut to anon by RLS, and it has to stay that
// way — it holds every buyer's name, contact and address. The function hands back the four facts the
// page needs and refuses the rest, and it answers nothing once the order is paid or cancelled.
//
// A MISSING LINK AND A WRONG ONE GET THE SAME ANSWER. Distinguishing them would turn the page into an
// oracle for guessing tokens, and would tell whoever is guessing when they are close.

export const findOrderByPaymentToken = async (token) => {
  if (!isPaymentToken(token)) return null;

  const { data, error } = await supabase.rpc('storefront_payment_link', { p_token: token });
  if (error) {
    // A missing function means the migration has not been applied yet. That is not something to show a
    // buyer as an error — the page falls back to "we are sending the details by WhatsApp", which is
    // what happened before this page existed.
    console.warn('Payment link lookup failed:', error?.message || error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.order_number) return null;

  return {
    orderNumber: row.order_number,
    amountIdr: Number(row.subtotal) || 0,
    paymentStatus: row.payment_status || 'unpaid',
    paymentProvider: row.payment_provider || 'manual',
    status: row.status || '',
    createdAt: row.created_at || null,
  };
};
