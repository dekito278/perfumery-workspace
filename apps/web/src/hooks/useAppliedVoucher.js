import { useEffect, useState } from 'react';
import {
  APPLIED_VOUCHER_UPDATED_EVENT,
  applyVoucherToSubtotalAsync,
  clearAppliedVoucherCode,
  getAppliedVoucherCode,
  normalizeVoucherCode,
  setAppliedVoucherCode,
  VOUCHER_UPDATED_EVENT,
  VOUCHER_VALIDATION_REASONS,
} from '@/services/voucherService.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { refreshTierPrices } from '@/hooks/useStorefrontProducts.js';
import { redeemMemberCode } from '@/services/tierPricingService.js';
import { normalizeMemberCode } from '@/utils/memberCode.js';

// ONE FIELD FOR EVERY CODE (Dekito, 13 Nov 2026: "jangan bikin orang pusing masukin kode"). The buyer
// does not have to know whether what the community gave them is a voucher or a member code: the field
// tries it as a voucher first, and a code that is not a voucher is tried as a member code. Member codes
// are an Indonesian-shop thing and need an account, so abroad a non-voucher is just "not found", and a
// visitor who is not signed in is asked to sign in rather than told the code is wrong.
const MEMBER_RESULT_KEYS = {
  smaller: 'member.codeSmaller',
  too_many: 'member.codeTooMany',
  signin: 'code.memberSignIn',
  unknown: 'code.unknown',
  unavailable: 'code.unknown',
};

export const useAppliedVoucher = (subtotal = 0, items = []) => {
  const { t, isInternational } = useTranslate();
  const { currentUser } = useAuth();
  // True while the line under the field reports good news that is not a voucher (a member code taken).
  const [memberJoined, setMemberJoined] = useState(false);
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
            message: error.message || t('voucher.checkFailed'),
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
  }, [items, subtotal, t, voucherCode]);

  useEffect(() => {
    if (voucherCode && !result.valid) {
      setMessage(result.message);
    }
  }, [result.message, result.valid, voucherCode]);

  // A code that is not a voucher, in the Indonesian shop: a member code, perhaps. Returns true when it
  // answered the buyer (joined, refused with a reason), false to let the voucher's "not found" stand.
  const tryAsMemberCode = async (code) => {
    if (isInternational) return false;
    const memberCode = normalizeMemberCode(code);
    if (!memberCode) return false;
    if (!currentUser) {
      setMemberJoined(false);
      setMessage(t('code.memberSignIn', { code: memberCode }));
      return true;
    }
    const { result: outcome, codeName, memberPercent } = await redeemMemberCode(memberCode);
    if (outcome === 'ok') {
      await refreshTierPrices();
      setInputCode('');
      setMemberJoined(true);
      setMessage(t('member.codeJoined', { name: codeName }));
      return true;
    }
    setMemberJoined(false);
    setMessage(t(MEMBER_RESULT_KEYS[outcome] || 'member.codeFailed', { name: codeName, percent: memberPercent, code: memberCode }));
    return true;
  };

  const applyVoucher = async () => {
    const nextCode = normalizeVoucherCode(inputCode);
    setLoading(true);
    setMemberJoined(false);
    try {
      const nextResult = await applyVoucherToSubtotalAsync({ code: nextCode, subtotal, items });
      if (!nextResult.valid && nextResult.reason === VOUCHER_VALIDATION_REASONS.NOT_FOUND
        && await tryAsMemberCode(nextCode)) {
        return nextResult;
      }
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
        message: error.message || t('voucher.checkFailed'),
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
    setMemberJoined(false);
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
    // Paint the message as good news: a voucher that applied, or a member code that was taken.
    codeAccepted: memberJoined || Boolean(result.valid),
    loading,
    result,
    applyVoucher,
    removeVoucher,
  };
};
