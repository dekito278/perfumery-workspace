import { useEffect, useMemo, useState } from 'react';
import { publicErrorMessage } from '@/utils/publicErrorMessage.js';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  buildCheckoutDraft,
  buildOrderNotes,
  checkoutPaymentMethodsFor,
  getCheckoutPaymentMethod,
  isDokuQrisPayment,
  isManualTransferPayment,
  MANUAL_TRANSFER_PAYMENT,
} from '@/services/cartService.js';
import { createDokuCheckout, createDokuQris } from '@/services/dokuCheckoutService.js';
import { getClientContext } from '@/utils/clientContext.js';
import { getCustomerAccount, lookupCheckoutCustomerByCode } from '@/services/customerService.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { authoritativeOrdersEnabled, createCatalogOrderViaEndpoint, createOrder } from '@/services/orderService.js';
import {
  applyVoucherToSubtotalAsync,
  clearAppliedVoucherCode,
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
import { useStorefrontRegion } from '@/hooks/useStorefrontRegion.js';
import { destinationFor } from '@/utils/internationalDestination.js';
import { formatUsdPrice } from '@/utils/usdPrice.js';
import { clearCheckoutDraft, readCheckoutDraft, writeCheckoutDraft } from '@/utils/checkoutDraftStorage.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';
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

// The payment session is a hand-off, not a record: PaymentPage rebuilds it from the order number when it
// is missing. A browser that refuses storage (site data blocked, private mode, quota) must not be able to
// turn a placed order into an error.
const rememberPaymentSession = (payload) => {
  try {
    sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to hand the payment session to the payment page:', error?.message || error);
  }
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
  // An international order is addressed by COUNTRY and priced by it. There is no courier list and no
  // area search: RajaOngkir only knows Indonesian addresses and answers a foreign city with an empty
  // list and HTTP 200, which is the dead end the old notice existed to explain.
  const [deliveryCountry, setDeliveryCountry] = useState(savedDraft.deliveryCountry || '');
  const { isInternational } = useStorefrontRegion();
  const destination = useMemo(() => destinationFor(deliveryCountry), [deliveryCountry]);
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
  // DOKU is Indonesian rails: a virtual account, QRIS, a card charged in rupiah. None of it reaches a
  // buyer abroad, and api/doku/checkout.js writes its session into payment_response — the same column an
  // international order carries its dollar amount, its Jenius account and its "waiting for a shipping
  // quote" flag in. Choosing it would erase all three and restart the 24-hour clock on an order that is
  // waiting for a freight figure nobody has sent yet.
  // Keyed on the DESTINATION and not the shop's language: an Indonesian reading the English shop ships
  // to an Indonesian address and still pays with it. api/orders/create.js refuses the same combination,
  // because the provider arrives from the browser.
  const availablePaymentMethods = useMemo(() => checkoutPaymentMethodsFor(destination), [destination]);
  useEffect(() => {
    if (availablePaymentMethods.some((method) => method.id === selectedPaymentMethod)) return;
    setSelectedPaymentMethod(availablePaymentMethods[0]?.id || MANUAL_TRANSFER_PAYMENT.id);
  }, [availablePaymentMethods, selectedPaymentMethod]);
  // An international order's details come from the list the destination narrowed, not from a lookup in
  // the full one: the buyer picks an id, and for a parcel leaving Indonesia that id resolves to the BCA
  // account. bankName/accountNumber/accountName here are copied into the payment session the payment
  // page falls back to, so resolving it the old way put BCA's numbers in front of a buyer in Berlin.
  // Declared AFTER availablePaymentMethods, which it reads: a const used above its own line is a blank
  // page at runtime with a green build, and this file has produced that exact crash before.
  const paymentMethodDetails = destination
    ? availablePaymentMethods[0]
    : getCheckoutPaymentMethod(selectedPaymentMethod);
  const paymentMethod = paymentMethodDetails.label;
  const isManualPayment = isManualTransferPayment(paymentMethodDetails.provider);
  const isQrisPayment = isDokuQrisPayment(paymentMethodDetails.provider);
  // Nothing is added for an international parcel. Either the price already carries the freight — that is
  // the sentence on every product page — or it is quoted by hand afterwards, which is a figure this
  // screen does not have and must not invent. The courier rate belongs to the domestic half only.
  const shippingFee = isInternational ? 0 : Number(selectedShipping?.cost || 0);
  // Vouchers are domestic. Dekito's decision, 2026-09-25, and the same rule the member price already
  // follows: a discount written for the Indonesian shop takes its cut from whatever subtotal it meets,
  // and an international subtotal is 3.5x the domestic one — so a 10% code meant as about Rp 36.000 off
  // a bottle became Rp 126.000 off the same bottle going abroad.
  //
  // Keyed on the DESTINATION, not the shop's language: an Indonesian reading the English shop, shipping
  // to an Indonesian address, keeps their voucher. api/orders/create.js refuses the same combination,
  // because the code travels in the request; this is so the buyer is never quoted a total the server
  // will not honour.
  const voucherBlockedByDestination = Boolean(destination && voucherCode);
  const activeVoucherCode = destination ? '' : voucherCode;
  const discountAmount = destination
    ? 0
    : Math.min(Number(voucherDiscount || 0), Number(summary.subtotal || 0));
  const discountedSubtotal = Math.max(Number(summary.subtotal || 0) - discountAmount, 0);
  const totalDue = discountedSubtotal + shippingFee;
  // The LABEL, not the number. This exported the dollar figure for one commit, and the checkout promptly
  // fed it back into formatUsdPrice — which takes rupiah — and printed "US$5" for a Rp 1.260.000 order.
  // Both gates were green; it was caught by opening the page. A screen that receives a finished string
  // cannot get the units wrong, so the conversion happens once, here, beside the rupiah it converts.
  // Empty for a domestic order, which is how a caller knows to print rupiah instead.
  const totalDueUsdLabel = destination ? formatUsdPrice(totalDue) : '';
  const shippingSummary = isInternational
    ? (destination ? `${destination.regionLabel}${destination.shippingIncluded ? ' — shipping included' : ' — shipping quoted separately'}` : '')
    : (selectedShipping ? describeShippingRate(selectedShipping) : '');
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
  // "Is the form complete?" — and ONLY that. It used to include `&& !saving`, which made pressing the
  // button turn the form incomplete: the red line "Lengkapi: data checkout." appeared the instant the
  // order started being created, named nothing (nothing WAS missing, so the field list came out empty
  // and fell through to a generic phrase), and stayed for the whole ~20 seconds DOKU took — directly
  // above a button reading "Memproses...". The page told the buyer to fill something in while it was
  // submitting what they had already filled in. On the phone it was louder still: the summary bar
  // flipped from the total to "Lengkapi dulu" in amber for the same twenty seconds.
  //
  // Whether the button is pressable is a different question, and each surface already answers it by
  // checking `saving` where the button is.
  // Two shops, two rules, one function. The international half asks for a destination COUNTRY where the
  // domestic half asks for a courier, an area and a rate — none of which exist for a parcel leaving the
  // country. Everything before the split is the same in both, because a name, a reachable phone and an
  // address are what a parcel needs wherever it goes.
  // Written flat, not via a named "basics" flag: checkoutFailureHonesty scans the identifiers in this
  // expression and insists every one of them is named in the notice the buyer reads. A helper variable
  // is a condition with no sentence behind it, which is exactly the red line that names nothing.
  const canSubmitCheckout = Boolean(
    items.length
    && !blockedItems.length
    && customerName.trim()
    && validPhoneContact
    && deliveryAddress.trim()
    && selectedPaymentMethod
    && (isInternational
      ? destination
      : (selectedCourier && selectedDestination && selectedShipping))
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
    // The same split canSubmitCheckout makes, made again here — and it has to be made again, because
    // these two lists of conditions are what the buyer meets in sequence: the first decides whether the
    // button complains, the second decides whether the order is actually written. They disagreed once.
    // canSubmitCheckout learned about international destinations and this did not, so an overseas buyer
    // filled in every field, read no complaint, pressed the button, and was told in Indonesian to pick a
    // RajaOngkir area that is not on their screen and does not exist for a parcel leaving the country.
    // The checkout looked finished and could not take a single order.
    // submitOrderMirrorsCanSubmit.selfcheck.mjs fails the build if they drift apart again.
    if (isInternational) {
      if (!destination) {
        toast.error('Pilih negara tujuan dulu');
        return;
      }
    } else {
      if (!selectedDestination) {
        toast.error('Pilih area tujuan dari hasil pencarian RajaOngkir dulu');
        return;
      }
      if (!selectedShipping) {
        toast.error('Pilih ekspedisi dulu');
        return;
      }
    }
    if (!selectedPaymentMethod) {
      toast.error('Pilih metode pembayaran dulu');
      return;
    }

    setSaving(true);
    let createdOrder = null;
    try {
      const voucherValidation = activeVoucherCode
        ? await applyVoucherToSubtotalAsync({ code: activeVoucherCode, subtotal: summary.subtotal, items })
        : null;
      if (activeVoucherCode && !voucherValidation?.valid) {
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
        voucherCode: activeVoucherCode,
        voucherDiscount: checkoutDiscountAmount,
        notes,
        items,
      });
      const voucherSnapshot = buildVoucherSnapshot({
        voucher: voucherValidation?.voucher || voucherDetails,
        voucherCode: activeVoucherCode,
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
        // Empty on a domestic order. It is what tells the endpoint to price internationally, so it rides
        // on the order rather than being inferred from the shop the browser happened to be showing.
        deliveryCountry: isInternational ? deliveryCountry : '',
        notes: buildOrderNotes({ deliveryAddress, deliveryArea, paymentMethod, shippingSummary, notes }),
        // Same courier, as a field and not only as a line inside the notes. Both order paths must agree:
        // the endpoint sets courier_name from its own server-side summary.
        courierName: shippingSummary,
        items,
        subtotal: checkoutTotalDue,
        quantity: summary.quantity,
        checkoutDraft: finalCheckoutDraft,
        paymentProvider: paymentMethodDetails.provider,
        voucherSnapshot,
        // Only the direct-insert path reads this; the endpoint collects its own copy server-side. Without
        // it an order created on the fallback path forgot which shop the buyer was reading.
        clientContext: getClientContext(),
      };
      // No fallback on failure: falling back re-opened the price-tampering path the endpoint exists to
      // close (audit round 7, finding #1). A failing endpoint must surface as a failed checkout.
      const order = authoritativeOrdersEnabled()
        ? await createCatalogOrderViaEndpoint(orderData, {
          shippingDestinationId: selectedDestination?.id || '',
          shippingDestination: selectedDestination || null,
          shippingCourier: selectedShipping?.courierCode || '',
          shippingService: selectedShipping?.service || '',
          voucherCode: activeVoucherCode,
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
        rememberPaymentSession({
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
          voucherCode: activeVoucherCode,
          voucherDiscount: checkoutDiscountAmount,
          voucherSnapshot,
          createdAt: new Date().toISOString(),
        });
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
        rememberPaymentSession({
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
        });
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
      rememberPaymentSession({
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
      });
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
      // Nothing was created yet: "the order was not saved" is the truth.
      if (!createdOrder) {
        // Through the sanitiser even though the endpoint now sanitises too: this catch also sees failures
        // that never reached the endpoint (network, a thrown Supabase error), and a buyer was shown a
        // Postgres constraint dump containing her own name, phone and address (2026-09-21).
        console.error('Checkout failed before the order existed:', error?.message || error);
        toast.error(publicErrorMessage(error, 'Gagal menyimpan pesanan'));
        return;
      }

      // The order exists — api/orders/create.js wrote it with the service role. What failed is the step
      // after it, which for QRIS and card is a network call to DOKU. Saying "Gagal menyimpan pesanan"
      // here is false, and a buyer who believes it submits again and pays for two orders.
      //
      // The rollback that used to sit here could never work from a buyer's browser: updateOrderStatus
      // writes storefront_orders, which is admin-only, so RLS filtered it and it only warned. Leaving the
      // order pending is correct anyway — api/orders/expire-reservations.js cancels it and releases the
      // stock if nobody pays, and PaymentPage can rebuild the payment session on arrival.
      console.warn('Payment session could not be prepared:', error?.message || error);
      clearCart();
      clearCheckoutDraft();
      (clearVoucher || clearAppliedVoucherCode)();
      setSubmittedOrder(createdOrder);
      toast.error(`Pesanan ${createdOrder.orderNumber} sudah tersimpan, tapi halaman pembayaran belum siap. Jangan checkout ulang — buka halaman pembayaran dan coba lagi.`);
      navigate(`${paymentPath}?order=${encodeURIComponent(createdOrder.orderNumber)}`);
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
    availablePaymentMethods,
    paymentMethodDetails,
    shippingLoading,
    shippingError,
    shippingNotice,
    paymentMethod,
    isManualPayment,
    validPhoneContact,
    shippingFee,
    discountAmount,
    voucherBlockedByDestination,
    discountedSubtotal,
    totalDue,
    totalDueUsdLabel,
    shippingSummary,
    shippingWeight,
    canSubmitCheckout,
    deliveryCountry,
    setDeliveryCountry,
    destination,
    isInternational,
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
