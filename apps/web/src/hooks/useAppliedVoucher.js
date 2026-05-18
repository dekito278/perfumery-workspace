import { useEffect, useState } from 'react';
import {
  APPLIED_VOUCHER_UPDATED_EVENT,
  applyVoucherToSubtotalAsync,
  clearAppliedVoucherCode,
  getAppliedVoucherCode,
  getVouchers,
  normalizeVoucherCode,
  setAppliedVoucherCode,
  VOUCHER_UPDATED_EVENT,
} from '@/services/voucherService.js';

export const useAppliedVoucher = (subtotal = 0, items = []) => {
  const [voucherCode, setVoucherCode] = useState(getAppliedVoucherCode);
  const [inputCode, setInputCode] = useState(getAppliedVoucherCode);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState({
    valid: false,
    voucher: null,
    discountAmount: 0,
    subtotal: Number(subtotal || 0),
    subtotalAfterDiscount: Number(subtotal || 0),
    message: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const syncAppliedVoucher = async () => {
      const nextCode = getAppliedVoucherCode();
      setVoucherCode(nextCode);
      setInputCode((current) => current || nextCode);
      try {
        await getVouchers();
      } catch (error) {
        console.warn('Failed to refresh vouchers:', error.message || error);
      }
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

  useEffect(() => {
    let cancelled = false;
    const validateAppliedVoucher = async () => {
      if (!voucherCode) {
        setResult({
          valid: false,
          voucher: null,
          discountAmount: 0,
          subtotal: Number(subtotal || 0),
          subtotalAfterDiscount: Number(subtotal || 0),
          message: '',
        });
        return;
      }

      setLoading(true);
      try {
        const nextResult = await applyVoucherToSubtotalAsync({ code: voucherCode, subtotal, items });
        if (!cancelled) setResult(nextResult);
      } catch (error) {
        if (!cancelled) {
          setResult({
            valid: false,
            voucher: null,
            discountAmount: 0,
            subtotal: Number(subtotal || 0),
            subtotalAfterDiscount: Number(subtotal || 0),
            message: error.message || 'Voucher belum bisa dicek',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    validateAppliedVoucher();
    return () => {
      cancelled = true;
    };
  }, [items, subtotal, voucherCode]);

  useEffect(() => {
    if (voucherCode && !result.valid) {
      setMessage(result.message);
    }
  }, [result.message, result.valid, voucherCode]);

  const applyVoucher = async () => {
    const nextCode = normalizeVoucherCode(inputCode);
    setLoading(true);
    try {
      const nextResult = await applyVoucherToSubtotalAsync({ code: nextCode, subtotal, items });
      setMessage(nextResult.message);
      setResult(nextResult);
      if (nextResult.valid) {
        setAppliedVoucherCode(nextCode);
        setVoucherCode(nextCode);
        setInputCode(nextCode);
      }
      return nextResult;
    } catch (error) {
      const nextResult = {
        valid: false,
        voucher: null,
        discountAmount: 0,
        subtotal: Number(subtotal || 0),
        subtotalAfterDiscount: Number(subtotal || 0),
        message: error.message || 'Voucher belum bisa dicek',
      };
      setMessage(nextResult.message);
      setResult(nextResult);
      return nextResult;
    } finally {
      setLoading(false);
    }
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
    eligibleItems: result.valid ? result.eligibleItems || items : [],
    eligibleSubtotal: result.valid ? result.eligibleSubtotal || Number(subtotal || 0) : 0,
    eligibleQuantity: result.valid ? result.eligibleQuantity || 0 : 0,
    message,
    loading,
    result,
    applyVoucher,
    removeVoucher,
  };
};
