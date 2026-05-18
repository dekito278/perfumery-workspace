import { useEffect, useMemo, useState } from 'react';
import {
  APPLIED_VOUCHER_UPDATED_EVENT,
  applyVoucherToSubtotal,
  clearAppliedVoucherCode,
  getAppliedVoucherCode,
  normalizeVoucherCode,
  setAppliedVoucherCode,
  VOUCHER_UPDATED_EVENT,
} from '@/services/voucherService.js';

export const useAppliedVoucher = (subtotal = 0) => {
  const [voucherCode, setVoucherCode] = useState(getAppliedVoucherCode);
  const [inputCode, setInputCode] = useState(getAppliedVoucherCode);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const syncAppliedVoucher = () => {
      const nextCode = getAppliedVoucherCode();
      setVoucherCode(nextCode);
      setInputCode((current) => current || nextCode);
    };

    window.addEventListener('storage', syncAppliedVoucher);
    window.addEventListener(APPLIED_VOUCHER_UPDATED_EVENT, syncAppliedVoucher);
    window.addEventListener(VOUCHER_UPDATED_EVENT, syncAppliedVoucher);
    syncAppliedVoucher();

    return () => {
      window.removeEventListener('storage', syncAppliedVoucher);
      window.removeEventListener(APPLIED_VOUCHER_UPDATED_EVENT, syncAppliedVoucher);
      window.removeEventListener(VOUCHER_UPDATED_EVENT, syncAppliedVoucher);
    };
  }, []);

  const result = useMemo(() => (
    voucherCode
      ? applyVoucherToSubtotal({ code: voucherCode, subtotal })
      : {
        valid: false,
        voucher: null,
        discountAmount: 0,
        subtotal: Number(subtotal || 0),
        subtotalAfterDiscount: Number(subtotal || 0),
        message: '',
      }
  ), [subtotal, voucherCode]);

  useEffect(() => {
    if (voucherCode && !result.valid) {
      setMessage(result.message);
    }
  }, [result.message, result.valid, voucherCode]);

  const applyVoucher = () => {
    const nextCode = normalizeVoucherCode(inputCode);
    const nextResult = applyVoucherToSubtotal({ code: nextCode, subtotal });
    setMessage(nextResult.message);
    if (nextResult.valid) {
      setAppliedVoucherCode(nextCode);
      setVoucherCode(nextCode);
      setInputCode(nextCode);
    }
    return nextResult;
  };

  const removeVoucher = () => {
    clearAppliedVoucherCode();
    setVoucherCode('');
    setInputCode('');
    setMessage('');
  };

  return {
    inputCode,
    setInputCode,
    appliedCode: voucherCode,
    appliedVoucher: result.valid ? result.voucher : null,
    discountAmount: result.valid ? result.discountAmount : 0,
    subtotalAfterDiscount: result.valid ? result.subtotalAfterDiscount : Number(subtotal || 0),
    message,
    result,
    applyVoucher,
    removeVoucher,
  };
};
