import supabase from '@/lib/supabaseClient.js';
import { isSchemaMissing } from '@/services/tierPricingService.js';
import { normalizeMemberCode } from '@/utils/memberCode.js';

// Member codes for Studio. The tables arrive with 20261110120000_member_codes.sql, applied by hand, so
// every read says whether they exist yet — Studio must say so plainly rather than show an empty list
// that looks like "no codes".

const fromRow = (row) => ({
  id: row.id,
  name: row.name || '',
  code: row.code || '',
  percent: Number(row.discount_percent) || 0,
  active: row.active !== false,
  createdAt: row.created_at || null,
});

export const listMemberCodes = async () => {
  const { data, error } = await supabase
    .from('storefront_member_codes')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    if (isSchemaMissing(error)) return { codes: [], schemaReady: false };
    throw new Error(error.message || 'Kode member gagal dimuat.');
  }
  return { codes: (data || []).map(fromRow), schemaReady: true };
};

/** { [codeId]: { accounts, paidOrders } }, plus '' for members without a code (accounts that existed). */
export const getMemberCodeStats = async () => {
  const { data, error } = await supabase.rpc('storefront_member_code_stats');
  if (error) {
    if (isSchemaMissing(error)) return {};
    throw new Error(error.message || 'Angka kode member gagal dimuat.');
  }
  return Object.fromEntries((data || []).map((row) => [
    row.member_code_id || '',
    { accounts: Number(row.accounts) || 0, paidOrders: Number(row.paid_orders) || 0 },
  ]));
};

export const saveMemberCode = async ({ id = null, name, code, percent }) => {
  const payload = {
    name: String(name || '').trim(),
    code: normalizeMemberCode(code),
    discount_percent: Number(percent),
    updated_at: new Date().toISOString(),
  };
  const query = id
    ? supabase.from('storefront_member_codes').update(payload).eq('id', id).select('*')
    : supabase.from('storefront_member_codes').insert(payload).select('*');
  const { data, error } = await query;
  if (error) {
    if (error.code === '23505') throw new Error(`Kode ${payload.code} sudah dipakai komunitas lain.`);
    throw new Error(error.message || 'Kode member gagal disimpan.');
  }
  // RLS answers a refused write with zero rows, not an error: that is not "tersimpan".
  if (!data?.length) throw new Error('Kode member tidak tersimpan — akun ini tidak punya izin admin.');
  return fromRow(data[0]);
};

export const setMemberCodeActive = async (id, active) => {
  const { data, error } = await supabase
    .from('storefront_member_codes')
    .update({ active: Boolean(active), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*');
  if (error) throw new Error(error.message || 'Status kode gagal diubah.');
  if (!data?.length) throw new Error('Status kode tidak berubah — akun ini tidak punya izin admin.');
  return fromRow(data[0]);
};
