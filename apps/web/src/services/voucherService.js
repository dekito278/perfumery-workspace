export const VOUCHER_STORAGE_KEY = 'dekito.storefront.vouchers.v1';
export const APPLIED_VOUCHER_STORAGE_KEY = 'dekito.storefront.appliedVoucher.v1';
export const VOUCHER_USAGE_STORAGE_KEY = 'dekito.storefront.voucherUsage.v1';
export const VOUCHER_UPDATED_EVENT = 'dekito:vouchers-updated';
export const APPLIED_VOUCHER_UPDATED_EVENT = 'dekito:applied-voucher-updated';

export const VOUCHER_DISCOUNT_TYPES = {
  PERCENT: 'percent',
  FIXED: 'fixed',
};

export const VOUCHER_VALIDATION_REASONS = {
  VALID: 'valid',
  CODE_REQUIRED: 'code_required',
  NOT_FOUND: 'not_found',
  INACTIVE: 'inactive',
  EXPIRED: 'expired',
  MINIMUM_ORDER: 'minimum_order',
  USAGE_LIMIT_REACHED: 'usage_limit_reached',
  INVALID_DISCOUNT: 'invalid_discount',
};

const VALID_DISCOUNT_TYPES = new Set(Object.values(VOUCHER_DISCOUNT_TYPES));

export const normalizeVoucherCode = (code) => String(code || '')
  .trim()
  .toUpperCase()
  .replace(/\s+/g, '');

const makeVoucherId = (code) => `voucher-${normalizeVoucherCode(code).toLowerCase() || Date.now()}`;

const toAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(numeric, 0) : 0;
};

const parseStoredVouchers = (value) => {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readStoredVouchers = () => {
  if (typeof window === 'undefined') return [];
  return parseStoredVouchers(window.localStorage.getItem(VOUCHER_STORAGE_KEY));
};

const writeStoredVouchers = (vouchers) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VOUCHER_STORAGE_KEY, JSON.stringify(vouchers));
  window.dispatchEvent(new CustomEvent(VOUCHER_UPDATED_EVENT));
};

const parseStoredUsageRecords = (value) => {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readStoredUsageRecords = () => {
  if (typeof window === 'undefined') return [];
  return parseStoredUsageRecords(window.localStorage.getItem(VOUCHER_USAGE_STORAGE_KEY));
};

const writeStoredUsageRecords = (records) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VOUCHER_USAGE_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new CustomEvent(VOUCHER_UPDATED_EVENT));
};

export const getAppliedVoucherCode = () => {
  if (typeof window === 'undefined') return '';
  return normalizeVoucherCode(window.localStorage.getItem(APPLIED_VOUCHER_STORAGE_KEY));
};

export const setAppliedVoucherCode = (code) => {
  const normalizedCode = normalizeVoucherCode(code);
  if (typeof window !== 'undefined') {
    if (normalizedCode) {
      window.localStorage.setItem(APPLIED_VOUCHER_STORAGE_KEY, normalizedCode);
    } else {
      window.localStorage.removeItem(APPLIED_VOUCHER_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(APPLIED_VOUCHER_UPDATED_EVENT));
  }
  return normalizedCode;
};

export const clearAppliedVoucherCode = () => setAppliedVoucherCode('');

const getExpiryTime = (expiresAt) => {
  const rawValue = String(expiresAt || '').trim();
  if (!rawValue) return null;

  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawValue)
    ? `${rawValue}T23:59:59.999`
    : rawValue;
  const time = new Date(normalizedDate).getTime();
  return Number.isFinite(time) ? time : null;
};

export const normalizeVoucher = (input = {}, existingVouchers = []) => {
  const code = normalizeVoucherCode(input.code);
  const discountType = VALID_DISCOUNT_TYPES.has(input.discountType || input.discount_type)
    ? (input.discountType || input.discount_type)
    : VOUCHER_DISCOUNT_TYPES.FIXED;
  const currentVoucher = existingVouchers.find((voucher) => (
    voucher.id === input.id || normalizeVoucherCode(voucher.code) === code
  ));
  const createdAt = input.createdAt || input.created_at || currentVoucher?.createdAt || new Date().toISOString();

  return {
    id: input.id || currentVoucher?.id || makeVoucherId(code),
    code,
    discountType,
    discountValue: toAmount(input.discountValue ?? input.discount_value),
    minimumOrder: toAmount(input.minimumOrder ?? input.minimum_order),
    expiresAt: String(input.expiresAt ?? input.expires_at ?? '').trim(),
    active: input.active === undefined ? true : Boolean(input.active),
    usageLimitTotal: toAmount(input.usageLimitTotal ?? input.usage_limit_total),
    usageCount: toAmount(input.usageCount ?? input.usage_count ?? currentVoucher?.usageCount),
    createdAt,
    updatedAt: new Date().toISOString(),
  };
};

export const getLocalVouchers = () => readStoredVouchers().map((voucher, index, vouchers) => (
  normalizeVoucher(voucher, vouchers.slice(0, index))
));

export const getVouchers = () => getLocalVouchers();

export const findVoucherByCode = (code, vouchers = getLocalVouchers()) => {
  const normalizedCode = normalizeVoucherCode(code);
  if (!normalizedCode) return null;
  return vouchers.find((voucher) => normalizeVoucherCode(voucher.code) === normalizedCode) || null;
};

export const saveVoucher = (input) => {
  const storedVouchers = getLocalVouchers();
  const voucher = normalizeVoucher(input, storedVouchers);

  if (!voucher.code) {
    throw new Error('Kode voucher wajib diisi');
  }
  if (voucher.discountValue <= 0) {
    throw new Error('Nilai diskon voucher wajib lebih dari 0');
  }

  const nextVouchers = storedVouchers.some((item) => item.id === voucher.id || normalizeVoucherCode(item.code) === voucher.code)
    ? storedVouchers.map((item) => (
      item.id === voucher.id || normalizeVoucherCode(item.code) === voucher.code
        ? { ...voucher, id: item.id, createdAt: item.createdAt || voucher.createdAt }
        : item
    ))
    : [voucher, ...storedVouchers];

  writeStoredVouchers(nextVouchers);
  return voucher;
};

export const deleteVoucher = (idOrCode) => {
  const targetCode = normalizeVoucherCode(idOrCode);
  const nextVouchers = getLocalVouchers().filter((voucher) => (
    voucher.id !== idOrCode && normalizeVoucherCode(voucher.code) !== targetCode
  ));
  writeStoredVouchers(nextVouchers);
  return nextVouchers;
};

export const resetVouchers = () => {
  writeStoredVouchers([]);
  return [];
};

export const calculateVoucherDiscount = (voucher, subtotal) => {
  const normalizedVoucher = normalizeVoucher(voucher);
  const orderSubtotal = toAmount(subtotal);

  if (orderSubtotal <= 0 || normalizedVoucher.discountValue <= 0) {
    return 0;
  }

  const rawDiscount = normalizedVoucher.discountType === VOUCHER_DISCOUNT_TYPES.PERCENT
    ? orderSubtotal * (Math.min(normalizedVoucher.discountValue, 100) / 100)
    : normalizedVoucher.discountValue;

  return Math.min(Math.round(rawDiscount), orderSubtotal);
};

export const validateVoucher = ({
  code,
  voucher,
  subtotal = 0,
  vouchers,
  now = new Date(),
} = {}) => {
  const normalizedCode = normalizeVoucherCode(code || voucher?.code);
  if (!normalizedCode) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.CODE_REQUIRED,
      message: 'Kode voucher wajib diisi',
      voucher: null,
      discountAmount: 0,
    };
  }

  const matchedVoucher = voucher ? normalizeVoucher(voucher) : findVoucherByCode(normalizedCode, vouchers);
  if (!matchedVoucher) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.NOT_FOUND,
      message: 'Voucher tidak ditemukan',
      voucher: null,
      discountAmount: 0,
    };
  }

  if (normalizeVoucherCode(matchedVoucher.code) !== normalizedCode) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.NOT_FOUND,
      message: 'Voucher tidak ditemukan',
      voucher: null,
      discountAmount: 0,
    };
  }

  if (!matchedVoucher.active) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.INACTIVE,
      message: 'Voucher sedang tidak aktif',
      voucher: matchedVoucher,
      discountAmount: 0,
    };
  }

  const expiryTime = getExpiryTime(matchedVoucher.expiresAt);
  if (expiryTime && expiryTime < now.getTime()) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.EXPIRED,
      message: 'Voucher sudah expired',
      voucher: matchedVoucher,
      discountAmount: 0,
    };
  }

  const orderSubtotal = toAmount(subtotal);
  if (orderSubtotal < matchedVoucher.minimumOrder) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.MINIMUM_ORDER,
      message: `Minimum belanja voucher ini Rp ${new Intl.NumberFormat('id-ID').format(matchedVoucher.minimumOrder)}`,
      voucher: matchedVoucher,
      discountAmount: 0,
    };
  }

  if (matchedVoucher.usageLimitTotal > 0 && matchedVoucher.usageCount >= matchedVoucher.usageLimitTotal) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.USAGE_LIMIT_REACHED,
      message: 'Kuota voucher sudah habis',
      voucher: matchedVoucher,
      discountAmount: 0,
    };
  }

  const discountAmount = calculateVoucherDiscount(matchedVoucher, orderSubtotal);
  if (discountAmount <= 0) {
    return {
      valid: false,
      reason: VOUCHER_VALIDATION_REASONS.INVALID_DISCOUNT,
      message: 'Voucher belum memiliki nilai diskon yang valid',
      voucher: matchedVoucher,
      discountAmount: 0,
    };
  }

  return {
    valid: true,
    reason: VOUCHER_VALIDATION_REASONS.VALID,
    message: 'Voucher berhasil diterapkan',
    voucher: matchedVoucher,
    discountAmount,
    subtotalAfterDiscount: Math.max(orderSubtotal - discountAmount, 0),
  };
};

export const applyVoucherToSubtotal = ({ code, voucher, subtotal = 0, vouchers, now } = {}) => {
  const validation = validateVoucher({ code, voucher, subtotal, vouchers, now });
  const orderSubtotal = toAmount(subtotal);

  return {
    ...validation,
    subtotal: orderSubtotal,
    discountAmount: validation.valid ? validation.discountAmount : 0,
    subtotalAfterDiscount: validation.valid ? Math.max(orderSubtotal - validation.discountAmount, 0) : orderSubtotal,
  };
};

export const incrementVoucherUsage = (idOrCode, amount = 1) => {
  const targetCode = normalizeVoucherCode(idOrCode);
  const usageAmount = Math.max(toAmount(amount), 1);
  let matchedVoucher = null;
  const nextVouchers = getLocalVouchers().map((voucher) => {
    const isTarget = voucher.id === idOrCode || normalizeVoucherCode(voucher.code) === targetCode;
    if (!isTarget) return voucher;

    matchedVoucher = voucher;
    const nextUsageCount = toAmount(voucher.usageCount) + usageAmount;
    if (voucher.usageLimitTotal > 0 && nextUsageCount > voucher.usageLimitTotal) {
      throw new Error('Kuota voucher sudah habis');
    }

    return { ...voucher, usageCount: nextUsageCount, updatedAt: new Date().toISOString() };
  });
  if (!matchedVoucher) {
    throw new Error('Voucher tidak ditemukan');
  }
  writeStoredVouchers(nextVouchers);
  return findVoucherByCode(targetCode, nextVouchers) || nextVouchers.find((voucher) => voucher.id === idOrCode) || null;
};

export const getVoucherUsageRecords = () => readStoredUsageRecords().map((record) => ({
  id: record.id || `${normalizeVoucherCode(record.voucherCode || record.code)}-${record.orderNumber || record.orderId || record.order_id || Date.now()}`,
  voucherCode: normalizeVoucherCode(record.voucherCode || record.code),
  orderId: String(record.orderId || record.order_id || '').trim(),
  orderNumber: String(record.orderNumber || record.order_number || '').trim(),
  amount: Math.max(toAmount(record.amount), 1),
  usedAt: record.usedAt || record.used_at || new Date().toISOString(),
})).filter((record) => record.voucherCode && (record.orderId || record.orderNumber));

export const recordVoucherUsageForOrder = ({
  orderId = '',
  orderNumber = '',
  voucherCode = '',
  voucherSnapshot = null,
  amount = 1,
} = {}) => {
  const code = normalizeVoucherCode(voucherCode || voucherSnapshot?.code);
  const orderIdValue = String(orderId || '').trim();
  const orderNumberValue = String(orderNumber || '').trim();
  const orderKey = orderNumberValue || orderIdValue;
  if (!code || !orderKey) {
    return { tracked: false, alreadyTracked: false, voucher: null };
  }

  const records = getVoucherUsageRecords();
  const existingRecord = records.find((record) => (
    record.voucherCode === code
    && (
      (orderNumberValue && record.orderNumber === orderNumberValue)
      || (orderIdValue && record.orderId === orderIdValue)
    )
  ));
  if (existingRecord) {
    return {
      tracked: false,
      alreadyTracked: true,
      record: existingRecord,
      voucher: findVoucherByCode(code),
    };
  }

  const subtotal = toAmount(voucherSnapshot?.subtotalBeforeDiscount || voucherSnapshot?.subtotal_before_discount);
  const validation = validateVoucher({ code, subtotal });
  if (!validation.valid) {
    throw new Error(validation.message || 'Voucher tidak bisa digunakan');
  }

  const updatedVoucher = incrementVoucherUsage(code, amount);
  const record = {
    id: `${code}-${orderKey}`,
    voucherCode: code,
    orderId: orderIdValue,
    orderNumber: orderNumberValue,
    amount: Math.max(toAmount(amount), 1),
    usedAt: new Date().toISOString(),
  };
  writeStoredUsageRecords([record, ...records].slice(0, 500));

  return {
    tracked: true,
    alreadyTracked: false,
    record,
    voucher: updatedVoucher,
  };
};
