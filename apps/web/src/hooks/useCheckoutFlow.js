import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  buildCheckoutDraft,
  buildOrderNotes,
  getCheckoutPaymentMethod,
  isDokuQrisPayment,
  isManualTransferPayment,
  MANUAL_TRANSFER_PAYMENT,
} from '@/services/cartService.js';
import { createDokuCheckout, createDokuQris } from '@/services/dokuCheckoutService.js';
import { getCustomerAccount, lookupCheckoutCustomerByCode } from '@/services/customerService.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { authoritativeOrdersEnabled, createCatalogOrderViaEndpoint, createOrder, updateOrderStatus } from '@/services/orderService.js';
import {
  applyVoucherToSubtotalAsync,
  clearAppliedVoucherCode,
  recordVoucherUsageForOrder,
} from '@/services/voucherService.js';
import {
  describeShippingRate,
  getCheckoutShippingWeight,
  getShippingRates,
  searchShippingDestinations,
} from '@/services/shippingService.js';
import { buildVoucherSnapshot } from '@/utils/voucherSnapshot.js';
import { copyTextToClipboard } from '@/utils/clipboard.js';
import { hasValidWhatsAppPhoneNumber } from '@/utils/phoneNumber.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';
const CHECKOUT_DRAFT_STORAGE_KEY = 'dekito.storefront.checkoutDraft.v1';

const readCheckoutDraft = () => {
  if (typeof window === 'undefined') return {};

  try {
    const rawValue = window.localStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};
    return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue) ? parsedValue : {};
  } catch {
    return {};
  }
};

const writeCheckoutDraft = (draft) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    // Safari private mode / quota: don't throw on every checkout keystroke.
    console.warn('Failed to persist checkout draft:', error.message || error);
  }
};

// Seed the checkout draft from somewhere else in the app (the customer portal's "Pesan lagi" hands over
// the saved name/contact/address so a code-only portal visitor does not retype it). Only fills fields the
// draft does not already have, so a half-typed checkout is never clobbered.
export const seedCheckoutDraft = (values = {}) => {
  const draft = readCheckoutDraft();
  const next = { ...draft };
  for (const [key, value] of Object.entries(values)) {
    const text = String(value || '').trim();
    if (text && !String(next[key] || '').trim()) {
      next[key] = text;
    }
  }
  writeCheckoutDraft({ ...next, updatedAt: new Date().toISOString() });
};

const clearCheckoutDraft = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
};

const getFriendlyShippingError = (error, fallback = 'Gagal mencari area tujuan. Coba pakai nama kecamatan atau kota.') => {
  const message = String(error?.message || error || '').trim();
  if (/destination|domestic|data not found|not found/i.test(message)) {
    return 'Area belum ditemukan. Coba ketik kecamatan atau kota, contoh: Jakarta Selatan.';
  }
  if (/network|fetch|failed|unavailable/i.test(message)) {
    return 'Layanan ongkir belum bisa dihubungi. Coba lagi beberapa saat.';
  }
  return fallback;
};

export const checkoutCourierOptions = [
  { courierCode: 'jnt', label: 'JnT' },
  { courierCode: 'jne', label: 'JNE' },
  { courierCode: 'ide', label: 'IDEXPRES' },
  { courierCode: 'pos', label: 'POS' },
  { courierCode: 'anteraja', label: 'ANTERAJA' },
];

export const useCheckoutFlow = ({
  items,
  summary,
  clearCart,
  paymentPath = '/payment',
  voucherCode = '',
  voucherDiscount = 0,
  voucherDetails = null,
  clearVoucher,
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const savedDraft = useMemo(() => readCheckoutDraft(), []);
  const [customerCode, setCustomerCode] = useState(savedDraft.customerCode || '');
  const [customerName, setCustomerName] = useState(savedDraft.customerName || '');
  const [contact, setContact] = useState(savedDraft.contact || '');
  const [deliveryAddress, setDeliveryAddress] = useState(savedDraft.deliveryAddress || '');
  const [deliveryArea, setDeliveryArea] = useState(savedDraft.deliveryArea || '');
  const [notes, setNotes] = useState(savedDraft.notes || '');
  const [saving, setSaving] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [securityChallenge, setSecurityChallenge] = useState(null);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [repeatCustomer, setRepeatCustomer] = useState(null);
  const [repeatAddressMode, setRepeatAddressMode] = useState('new');
  const [destinationSearch, setDestinationSearch] = useState(savedDraft.destinationSearch || savedDraft.deliveryArea || '');
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedCourier, setSelectedCourier] = useState(savedDraft.selectedCourier || '');
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(savedDraft.selectedPaymentMethod || MANUAL_TRANSFER_PAYMENT.id);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const [shippingNotice, setShippingNotice] = useState('');
  const paymentMethodDetails = getCheckoutPaymentMethod(selectedPaymentMethod);
  const paymentMethod = paymentMethodDetails.label;
  const isManualPayment = isManualTransferPayment(paymentMethodDetails.provider);
  const isQrisPayment = isDokuQrisPayment(paymentMethodDetails.provider);
  const shippingFee = Number(selectedShipping?.cost || 0);
  const discountAmount = Math.min(Number(voucherDiscount || 0), Number(summary.subtotal || 0));
  const discountedSubtotal = Math.max(Number(summary.subtotal || 0) - discountAmount, 0);
  const totalDue = discountedSubtotal + shippingFee;
  const shippingSummary = selectedShipping ? describeShippingRate(selectedShipping) : '';
  const shippingWeight = useMemo(() => getCheckoutShippingWeight(items), [items]);

  // Changing quantity changes the parcel weight, which changes the courier price. The previously quoted
  // rate stayed selected, so the buyer saw (and agreed to) an old shipping fee while the order was created
  // with it — force a re-quote instead (audit round 7).
  useEffect(() => {
    setSelectedShipping(null);
    setShippingOptions([]);
  }, [shippingWeight]);
  const validPhoneContact = hasValidWhatsAppPhoneNumber(contact);
  // reconcileCartLines flags lines whose product left the catalog or ran out of stock. Letting them
  // through meant the buyer filled in the whole form and only hit the wall at submit, with the
  // endpoint's raw "Unknown product" / "Stok tidak cukup" (audit round 9).
  const blockedItems = items.filter((item) => item.unavailable || item.outOfStock);
  const canSubmitCheckout = Boolean(
    items.length
    && !blockedItems.length
    && customerName.trim()
    && validPhoneContact
    && deliveryAddress.trim()
    && selectedCourier
    && selectedDestination
    && selectedShipping
    && selectedPaymentMethod
    && !saving
  );

  // Prefill from the logged-in customer's saved account, without overriding a draft.
  useEffect(() => {
    if (!currentUser) return undefined;
    let cancelled = false;
    (async () => {
      const account = await getCustomerAccount();
      if (cancelled || !account?.customer) return;
      const c = account.customer;
      if (c.customerCode) setCustomerCode((prev) => prev || c.customerCode);
      if (c.customerName && c.customerName !== 'Customer') setCustomerName((prev) => prev || c.customerName);
      if (c.contact && c.contact !== '-') setContact((prev) => prev || c.contact);
      if (c.deliveryAddress) setDeliveryAddress((prev) => prev || c.deliveryAddress);
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    writeCheckoutDraft({
      customerCode,
      customerName,
      contact,
      deliveryAddress,
      deliveryArea,
      destinationSearch,
      notes,
      selectedCourier,
      selectedPaymentMethod,
      updatedAt: new Date().toISOString(),
    });
  }, [
    customerCode,
    customerName,
    contact,
    deliveryAddress,
    deliveryArea,
    destinationSearch,
    notes,
    selectedCourier,
    selectedPaymentMethod,
  ]);
  const resetShipping = ({ keepSearch = true, keepCourier = true } = {}) => {
    setSelectedDestination(null);
    setSelectedShipping(null);
    setShippingOptions([]);
    setDestinationOptions([]);
    setShippingError('');
    setShippingNotice('');
    if (!keepCourier) {
      setSelectedCourier('');
    }
    if (!keepSearch) {
      setDestinationSearch('');
      setDeliveryArea('');
    }
  };

  const updateCustomerCode = (value) => {
    setCustomerCode(String(value || '').toUpperCase());
    setSecurityChallenge(null);
    setSecurityAnswer('');
    setRepeatCustomer(null);
    setRepeatAddressMode('new');
  };

  const updateDestinationSearch = (value) => {
    const nextValue = String(value || '');
    setDestinationSearch(nextValue);
    setDeliveryArea(nextValue);
    resetShipping({ keepSearch: true });
  };

  const updateDeliveryAddress = (value) => {
    setDeliveryAddress(value);
    if (repeatCustomer?.deliveryAddress && value !== repeatCustomer.deliveryAddress) {
      setRepeatAddressMode('new');
    }
  };

  const applyCheckoutCustomer = (customer) => {
    setSecurityChallenge(null);
    setSecurityAnswer('');
    setRepeatCustomer(customer);
    setRepeatAddressMode(customer.deliveryAddress || customer.deliveryArea ? 'last' : 'new');
    setCustomerCode(customer.customerCode);
    setCustomerName(customer.customerName);
    setContact(customer.contact);
    setDeliveryAddress(customer.deliveryAddress || '');
    setDeliveryArea(customer.deliveryArea || '');
    setDestinationSearch(customer.deliveryArea || '');
    resetShipping();
    toast.success(`${customer.customerCode} dimuat`);
  };

  const useCustomerLastAddress = () => {
    if (!repeatCustomer) return;
    setRepeatAddressMode('last');
    setDeliveryAddress(repeatCustomer.deliveryAddress || '');
    setDeliveryArea(repeatCustomer.deliveryArea || '');
    setDestinationSearch(repeatCustomer.deliveryArea || '');
    resetShipping({ keepSearch: true });
  };

  const useCustomerNewAddress = () => {
    if (!repeatCustomer) return;
    setRepeatAddressMode('new');
    setDeliveryAddress('');
    setDeliveryArea('');
    resetShipping({ keepSearch: false });
  };

  const searchDestinations = async () => {
    const search = destinationSearch.trim();
    if (search.length < 3) {
      toast.error('Isi minimal 3 huruf area, kecamatan, atau kota');
      return;
    }

    setShippingLoading(true);
    setShippingError('');
    setShippingNotice('');
    setSelectedDestination(null);
    setSelectedShipping(null);
    setShippingOptions([]);
    try {
      const destinations = await searchShippingDestinations(search);
      setDestinationOptions(destinations);
      if (!destinations.length) {
        setShippingError('Area belum ditemukan. Coba ketik kecamatan atau kota, contoh: Jakarta Selatan.');
      } else {
        setShippingNotice('Pilih area yang paling mendekati alamat pengiriman.');
      }
    } catch (error) {
      setShippingError(getFriendlyShippingError(error));
    } finally {
      setShippingLoading(false);
    }
  };

  const loadShippingRates = async (destination, { courierCode = selectedCourier, autoSelectCheapest = false } = {}) => {
    setSelectedDestination(destination);
    setDeliveryArea(destination.label);
    setDestinationSearch(destination.label);
    setDestinationOptions([]);
    setSelectedShipping(null);
    setShippingOptions([]);
    if (!courierCode) {
      setShippingError('Pilih ekspedisi dulu untuk melihat layanan ongkir.');
      return;
    }
    setShippingLoading(true);
    setShippingError('');
    setShippingNotice('');
    try {
      const rates = await getShippingRates({
        destinationId: destination.id,
        destination,
        destinationLabel: destination.label,
        subtotal: summary.subtotal,
        weight: shippingWeight,
        couriers: [courierCode],
      });
      const sortedRates = [...rates].sort((first, second) => Number(first.cost || 0) - Number(second.cost || 0));
      setShippingOptions(sortedRates);
      if (autoSelectCheapest && sortedRates.length) {
        setSelectedShipping(sortedRates[0]);
        setShippingNotice(`Kami pilihkan ongkir paling hemat dari alamat: ${destination.label}. Kamu tetap bisa ganti layanan.`);
      }
      if (!sortedRates.length) {
        setShippingError('Belum ada ongkir untuk area ini');
      }
    } catch (error) {
      setShippingError(getFriendlyShippingError(error, 'Gagal menghitung ongkir. Coba pilih area atau kurir lain.'));
    } finally {
      setShippingLoading(false);
    }
  };

  const autoCalculateShipping = async ({
    courierCode = selectedCourier,
    searchText = '',
    autoSelectBest = false,
  } = {}) => {
    const search = String(searchText || destinationSearch || deliveryArea || deliveryAddress || '').trim();
    if (search.length < 3) {
      toast.error('Isi alamat lengkap atau area tujuan dulu');
      return;
    }
    if (!courierCode) {
      toast.error('Pilih ekspedisi dulu');
      return;
    }

    setShippingLoading(true);
    setShippingError('');
    setShippingNotice('');
    setDestinationOptions([]);
    setSelectedShipping(null);
    setShippingOptions([]);

    try {
      if (selectedDestination?.id && String(selectedDestination.label || '').trim() === search) {
        const rates = await getShippingRates({
          destinationId: selectedDestination.id,
          destination: selectedDestination,
          destinationLabel: selectedDestination.label,
          subtotal: summary.subtotal,
          weight: shippingWeight,
          couriers: [courierCode],
        });

        if (rates.length) {
          const sortedRates = [...rates].sort((first, second) => Number(first.cost || 0) - Number(second.cost || 0));
          setShippingOptions(sortedRates);
          if (autoSelectBest) {
            setSelectedShipping(sortedRates[0]);
            setShippingNotice(`Kami pilihkan ongkir paling hemat dari alamat: ${selectedDestination.label}. Kamu tetap bisa ganti layanan.`);
          }
          return;
        }

        setShippingError('Area ditemukan, tapi ongkir belum tersedia untuk kurir ini. Pilih area lain atau kurir lain.');
        return;
      }

      setSelectedDestination(null);
      const destinations = await searchShippingDestinations(search);
      if (autoSelectBest && destinations.length) {
        await loadShippingRates(destinations[0], { courierCode, autoSelectCheapest: true });
        setDestinationOptions(destinations.slice(1));
        return;
      }

      setDestinationOptions(destinations);
      if (destinations.length) {
        setShippingNotice('Pilih area tujuan yang paling sesuai, lalu ongkir akan dihitung.');
      } else {
        setShippingError('Area belum ditemukan. Coba ketik kecamatan atau kota, contoh: Jakarta Selatan.');
      }
    } catch (error) {
      setShippingError(getFriendlyShippingError(error, 'Gagal menghitung ongkir. Coba pakai nama kecamatan atau kota.'));
    } finally {
      setShippingLoading(false);
    }
  };

  const lookupCustomer = async () => {
    if (!customerCode.trim()) {
      toast.error('Kode customer wajib diisi');
      return;
    }

    setLookupLoading(true);
    const customer = await lookupCheckoutCustomerByCode(customerCode);
    setLookupLoading(false);
    if (!customer) {
      toast.error('Kode customer tidak ditemukan');
      return;
    }

    if (customer.requiresSecurity) {
      setCustomerName('');
      setContact('');
      setDeliveryAddress('');
      setDeliveryArea('');
      setRepeatCustomer(null);
      setRepeatAddressMode('new');
      resetShipping({ keepSearch: false });
      setSecurityChallenge(customer);
      setSecurityAnswer('');
      setCustomerCode(customer.customerCode);
      toast.info('Jawab pertanyaan keamanan untuk lanjut');
      return;
    }

    applyCheckoutCustomer(customer);
  };

  const chooseShippingCourier = (courierCode) => {
    setSelectedCourier(courierCode);
    setSelectedShipping(null);
    setShippingOptions([]);
    setShippingError('');
    setShippingNotice('');
  };

  const chooseShippingRate = (rate) => {
    setSelectedCourier(rate?.courierCode || '');
    setSelectedShipping(rate);
  };

  const verifyCustomerSecurity = async () => {
    if (!securityChallenge?.customerCode || !securityAnswer.trim()) {
      toast.error('Jawaban keamanan wajib diisi');
      return;
    }

    setLookupLoading(true);
    const customer = await lookupCheckoutCustomerByCode(securityChallenge.customerCode, securityAnswer);
    setLookupLoading(false);
    if (!customer || customer.requiresSecurity) {
      toast.error('Jawaban keamanan salah');
      return;
    }

    applyCheckoutCustomer(customer);
  };

  const copyCustomerCode = async () => {
    if (!submittedOrder?.customerCode) return;
    const copied = await copyTextToClipboard(submittedOrder.customerCode);
    copied ? toast.success(`${submittedOrder.customerCode} copied`) : toast.error('Kode belum bisa disalin. Tekan lama kode lalu salin manual.');
  };

  const submitOrder = async ({ onSuccess } = {}) => {
    // Hard idempotency guard: a fast double-tap (or any non-button caller) must not create two orders.
    // The disabled button alone doesn't cover the window before React re-renders.
    if (saving) return;
    if (!items.length) {
      toast.error('Keranjang masih kosong');
      return;
    }
    if (blockedItems.length) {
      const names = blockedItems.map((item) => item.name).filter(Boolean).join(', ');
      toast.error(`${names || 'Beberapa item'} sudah tidak tersedia. Hapus dari keranjang dulu.`);
      return;
    }
    if (!customerName.trim() || !deliveryAddress.trim()) {
      toast.error('Nama dan alamat pengiriman wajib diisi');
      return;
    }
    if (!validPhoneContact) {
      toast.error('Nomor WhatsApp/telepon wajib diisi untuk pengiriman');
      return;
    }
    if (!selectedDestination) {
      toast.error('Pilih area tujuan dari hasil pencarian RajaOngkir dulu');
      return;
    }
    if (!selectedShipping) {
      toast.error('Pilih ekspedisi dulu');
      return;
    }
    if (!selectedPaymentMethod) {
      toast.error('Pilih metode pembayaran dulu');
      return;
    }

    setSaving(true);
    let createdOrder = null;
    try {
      const voucherValidation = voucherCode
        ? await applyVoucherToSubtotalAsync({ code: voucherCode, subtotal: summary.subtotal, items })
        : null;
      if (voucherCode && !voucherValidation?.valid) {
        throw new Error(voucherValidation?.message || 'Voucher tidak bisa digunakan');
      }
      const checkoutDiscountAmount = voucherValidation?.discountAmount ?? discountAmount;
      const checkoutDiscountedSubtotal = Math.max(Number(summary.subtotal || 0) - checkoutDiscountAmount, 0);
      const checkoutTotalDue = checkoutDiscountedSubtotal + shippingFee;
      const finalCheckoutDraft = buildCheckoutDraft({
        customerCode,
        customerName,
        contact,
        deliveryAddress,
        deliveryArea,
        paymentMethod,
        shippingSummary,
        shippingFee,
        voucherCode,
        voucherDiscount: checkoutDiscountAmount,
        notes,
        items,
      });
      const voucherSnapshot = buildVoucherSnapshot({
        voucher: voucherValidation?.voucher || voucherDetails,
        voucherCode,
        discountAmount: checkoutDiscountAmount,
        subtotalBeforeDiscount: summary.subtotal,
        subtotalAfterDiscount: checkoutDiscountedSubtotal,
        eligibleSubtotal: voucherValidation?.eligibleSubtotal,
        eligibleQuantity: voucherValidation?.eligibleQuantity,
      });
      const orderData = {
        customerName,
        customerCode,
        contact,
        deliveryAddress,
        deliveryArea,
        notes: buildOrderNotes({ deliveryAddress, deliveryArea, paymentMethod, shippingSummary, notes }),
        items,
        subtotal: checkoutTotalDue,
        quantity: summary.quantity,
        checkoutDraft: finalCheckoutDraft,
        paymentProvider: paymentMethodDetails.provider,
        voucherSnapshot,
      };
      // No fallback on failure: falling back re-opened the price-tampering path the endpoint exists to
      // close (audit round 7, finding #1). A failing endpoint must surface as a failed checkout.
      const order = authoritativeOrdersEnabled()
        ? await createCatalogOrderViaEndpoint(orderData, {
          shippingDestinationId: selectedDestination?.id || '',
          shippingDestination: selectedDestination || null,
          shippingCourier: selectedShipping?.courierCode || '',
          shippingService: selectedShipping?.service || '',
          voucherCode,
        })
        : await createOrder(orderData);
      createdOrder = order;
      // Charge the order's authoritative subtotal (equals checkoutTotalDue on the direct-insert path).
      const paymentAmount = Number(order.subtotal) || checkoutTotalDue;
      if (isManualPayment) {
        const manualPaymentResponse = {
          method: paymentMethodDetails.provider,
          bankName: paymentMethodDetails.bankName,
          accountNumber: paymentMethodDetails.accountNumber,
          accountName: paymentMethodDetails.accountName,
          amount: paymentAmount,
        };
        // No write here. api/orders/create.js already stored payment_status 'pending' and status
        // 'pending_payment' for manual transfer, and storefront_orders UPDATE is admin-only — this call
        // was filtered by RLS for every buyer and only looked like it worked. The bank details the buyer
        // needs come from MANUAL_TRANSFER_PAYMENT, which PaymentPage already falls back to (audit round 9).
        if (voucherSnapshot?.code) {
          try {
            await recordVoucherUsageForOrder({
              orderId: order.id,
              orderNumber: order.orderNumber,
              voucherSnapshot,
              items,
            });
          } catch (voucherError) {
            throw new Error(`Voucher ${voucherSnapshot.code} sudah tidak tersedia (kemungkinan kuota habis). Pesanan dibatalkan — silakan checkout ulang tanpa voucher tersebut.`);
          }
        }
        sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify({
          paymentType: paymentMethodDetails.provider,
          paymentProvider: paymentMethodDetails.provider,
          invoiceNumber: order.orderNumber,
          orderNumber: order.orderNumber,
          customerCode: order.customerCode || customerCode,
          amount: paymentAmount,
          customerName,
          paymentStatus: 'pending',
          manualTransfer: manualPaymentResponse,
          shippingSummary,
          shippingFee,
          voucherCode,
          voucherDiscount: checkoutDiscountAmount,
          voucherSnapshot,
          createdAt: new Date().toISOString(),
        }));
        clearCart();
        clearCheckoutDraft();
        (clearVoucher || clearAppliedVoucherCode)();
        setSubmittedOrder(order);
        toast.success(`Pesanan ${order.orderNumber} tersimpan. Wajib upload bukti transfer setelah transfer.`);
        onSuccess?.(order);
        navigate(`${paymentPath}?order=${encodeURIComponent(order.orderNumber)}&payment=manual`);
        return;
      }

      if (isQrisPayment) {
        const qris = await createDokuQris(order.orderNumber);
        // Reserve voucher quota BEFORE navigating (same as the DOKU path): a quota miss cancels here.
        if (voucherSnapshot?.code) {
          try {
            await recordVoucherUsageForOrder({ orderId: order.id, orderNumber: order.orderNumber, voucherSnapshot, items });
          } catch (voucherError) {
            throw new Error(`Voucher ${voucherSnapshot.code} sudah tidak tersedia (kemungkinan kuota habis). Pesanan dibatalkan — silakan checkout ulang tanpa voucher tersebut.`);
          }
        }
        sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify({
          paymentType: 'doku-qris',
          paymentProvider: 'doku-qris',
          qrContent: qris.qrContent,
          invoiceNumber: order.orderNumber,
          orderNumber: order.orderNumber,
          customerCode: order.customerCode || customerCode,
          amount: paymentAmount,
          customerName,
          paymentStatus: 'pending',
          paymentExpiresAt: qris.expiresAt || '',
          shippingSummary,
          shippingFee,
          voucherCode,
          voucherDiscount: checkoutDiscountAmount,
          voucherSnapshot,
          createdAt: new Date().toISOString(),
        }));
        clearCart();
        clearCheckoutDraft();
        (clearVoucher || clearAppliedVoucherCode)();
        setSubmittedOrder(order);
        toast.success(`Pesanan ${order.orderNumber} tersimpan. Kode customer: ${order.customerCode || customerCode}`);
        onSuccess?.(order);
        navigate(paymentPath);
        // No client write. Unlike api/doku/checkout.js, api/doku/qris.js does NOT persist its session to
        // the order — but this browser copy never did either: storefront_orders UPDATE is admin-only, so
        // RLS filtered every buyer's write. When QRIS is finally enabled (see the warning in
        // services/cartService.js), qris.js must PATCH payment_reference/payment_expires_at with the
        // service role the way checkout.js already does (audit round 9).
        return;
      }

      const checkout = await createDokuCheckout({
        order,
        amount: paymentAmount,
        customerName,
        contact,
        items: order.items || items,
        callbackPath: paymentPath,
      });
      // Record voucher usage BEFORE navigating so a quota miss cancels the order here, not after the
      // buyer is already staring at the payment panel.
      if (voucherSnapshot?.code) {
        try {
          await recordVoucherUsageForOrder({
            orderId: order.id,
            orderNumber: order.orderNumber,
            voucherSnapshot,
            items,
          });
        } catch (voucherError) {
          throw new Error(`Voucher ${voucherSnapshot.code} sudah tidak tersedia (kemungkinan kuota habis). Pesanan dibatalkan — silakan checkout ulang tanpa voucher tersebut.`);
        }
      }
      sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify({
        paymentUrl: checkout.paymentUrl,
        invoiceNumber: checkout.invoiceNumber || order.orderNumber,
        orderNumber: order.orderNumber,
        customerCode: order.customerCode || customerCode,
        amount: paymentAmount,
        customerName,
        paymentStatus: 'pending',
        paymentExpiresAt: checkout.paymentExpiresAt || '',
        paymentSessionId: checkout.paymentSessionId || '',
        shippingSummary,
        shippingFee,
        voucherCode,
        voucherDiscount: checkoutDiscountAmount,
        voucherSnapshot,
        createdAt: new Date().toISOString(),
      }));
      clearCart();
      clearCheckoutDraft();
      (clearVoucher || clearAppliedVoucherCode)();
      setSubmittedOrder(order);
      toast.success(`Pesanan ${order.orderNumber} tersimpan. Kode customer: ${order.customerCode || customerCode}`);
      onSuccess?.(order);
      // Optimistic navigation: the payment panel renders straight from sessionStorage (paymentUrl), so
      // navigate NOW. The order number rides along so the payment link stays recoverable if this tab is
      // lost — PaymentPage still prefers the stored session when it matches, so the fast path is intact.
      navigate(`${paymentPath}?order=${encodeURIComponent(order.orderNumber)}&payment=doku`);
      // api/doku/checkout.js already persisted the whole payment session (url, reference, session id,
      // expiry, response) with the service role. Repeating it from the browser was a no-op for buyers —
      // storefront_orders UPDATE is admin-only, so RLS filtered it and PostgREST still answered 200. Now
      // that writes fail loudly it would break checkout outright (audit round 9).
    } catch (error) {
      if (createdOrder) {
        try {
          await updateOrderStatus(createdOrder.id || createdOrder.orderNumber, 'cancelled');
        } catch (restoreError) {
          console.warn('Failed to cancel checkout order after payment session error:', restoreError.message || restoreError);
        }
      }
      toast.error(error.message || 'Gagal menyimpan pesanan');
    } finally {
      setSaving(false);
    }
  };

  return {
    customerCode,
    customerName,
    contact,
    deliveryAddress,
    deliveryArea,
    notes,
    saving,
    submittedOrder,
    securityChallenge,
    securityAnswer,
    lookupLoading,
    repeatCustomer,
    repeatAddressMode,
    destinationSearch,
    destinationOptions,
    selectedDestination,
    shippingOptions,
    selectedCourier,
    selectedShipping,
    selectedPaymentMethod,
    paymentMethodDetails,
    shippingLoading,
    shippingError,
    shippingNotice,
    paymentMethod,
    isManualPayment,
    validPhoneContact,
    shippingFee,
    discountAmount,
    discountedSubtotal,
    totalDue,
    shippingSummary,
    shippingWeight,
    canSubmitCheckout,
    blockedItems,
    setCustomerName,
    setContact,
    setDeliveryAddress: updateDeliveryAddress,
    setNotes,
    setSecurityAnswer,
    setSelectedShipping: chooseShippingRate,
    setSelectedPaymentMethod,
    chooseShippingCourier,
    updateCustomerCode,
    updateDestinationSearch,
    useCustomerLastAddress,
    useCustomerNewAddress,
    searchDestinations,
    autoCalculateShipping,
    loadShippingRates,
    lookupCustomer,
    verifyCustomerSecurity,
    copyCustomerCode,
    submitOrder,
  };
};
