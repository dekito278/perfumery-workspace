import supabase from '@/lib/supabaseClient.js';
import { isSchemaMissing } from '@/services/tierPricingService.js';

// The SOL-2026-NNN series.
//
// ALLOCATED BY THE DATABASE, never by reading a maximum and adding one: two invoices generated in the
// same minute would both read the same maximum and take the same number, and an invoice number that
// appears twice is the one bookkeeping error nobody can unpick afterwards, because both copies are
// already sent. The function does the update and the read in one statement.
//
// ONCE PER ORDER. The number is written onto the order, so reprinting an invoice reprints the same one
// rather than burning the next number in the series.

export const allocateInvoiceNumber = async (orderKey, existing = '') => {
  if (existing) return existing;

  const { data, error } = await supabase.rpc('storefront_next_invoice_number');
  if (error) {
    if (isSchemaMissing(error)) {
      throw new Error('Penomoran invoice belum ada — jalankan migrasinya dulu.');
    }
    throw new Error(error.message || 'Gagal mengambil nomor invoice');
  }
  const invoiceNumber = String(data || '').trim();
  if (!invoiceNumber) throw new Error('Nomor invoice kosong');

  // Written back immediately, so a failure after this point costs a number but never duplicates one.
  const query = supabase.from('storefront_orders').update({ invoice_number: invoiceNumber });
  const { error: writeError } = await (
    /^[0-9a-f-]{36}$/i.test(String(orderKey))
      ? query.eq('id', orderKey)
      : query.eq('order_number', orderKey)
  ).select('order_number');
  if (writeError) throw new Error(writeError.message || 'Nomor invoice tidak tersimpan di order');

  return invoiceNumber;
};
