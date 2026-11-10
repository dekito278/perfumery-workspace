// The shape of a member code, checked in Studio before the database has to. Import-free so the guard runs
// it. Mirrors the CHECK constraints in 20261110120000_member_codes.sql — the database is the authority,
// this only says the same thing in Indonesian before the save is refused.

export const MAX_MEMBER_CODE_PERCENT = 50;

export const normalizeMemberCode = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');

/** What is wrong with a code before it is saved, in words for Dekito, or '' when nothing is. */
export const memberCodeProblem = ({ name = '', code = '', percent = '' } = {}) => {
  const cleanName = String(name || '').trim();
  if (!cleanName) return 'Nama komunitas wajib diisi.';
  if (cleanName.length > 80) return 'Nama paling panjang 80 huruf.';
  if (!/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(normalizeMemberCode(code))) {
    return 'Kode 3–32 karakter: huruf, angka, atau tanda minus, tanpa spasi.';
  }
  const cut = Number(percent);
  if (!Number.isFinite(cut) || cut <= 0) return 'Persen harus lebih dari 0.';
  // A typo guard, not a policy: 51 is far more likely to be 15 than a decision.
  if (cut > MAX_MEMBER_CODE_PERCENT) return `Persen paling besar ${MAX_MEMBER_CODE_PERCENT}%. Cek lagi angkanya.`;
  return '';
};
