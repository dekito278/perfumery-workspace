import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  buildCheckoutDraft,
  buildOrderNotes,
} from '@/services/cartService.js';
import { createDokuCheckout } from '@/services/dokuCheckoutService.js';
import { lookupCheckoutCustomerByCode } from '@/services/customerService.js';
import { createOrder, updateOrderPaymentStatus } from '@/services/orderService.js';
import {
  describeShippingRate,
  getCheckoutShippingWeight,
  getShippingRates,
  searchShippingDestinations,
} from '@/services/shippingService.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';

const extractPostalCode = (value = '') => String(value).match(/\b\d{5}\b/)?.[0] || '';

const buildAddressSearchTerms = (address = '') => {
  const normalized = String(address || '')
    .replace(/\s+/g, ' ')
    .trim();
  const postalCode = extractPostalCode(normalized);
  const parts = normalized
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length >= 3)
    .filter((part) => !/^[A-Z0-9+]{4,}$/i.test(part));
  const terms = [
    postalCode,
    parts.slice(-3).join(' '),
    parts.slice(-2).join(' '),
    parts.find((part) => /\b(kota|kab|regency|city|jakarta|bogor|bekasi|depok|tangerang|bandung|surabaya)\b/i.test(part)),
    parts.at(-2),
    parts.at(-1),
  ];

  return [...new Set(terms.map((term) => String(term || '').trim()).filter((term) => term.length >= 3))];
};

const scoreDestinationMatch = (destination, address = '') => {
  const normalizedAddress = String(address || '').toLowerCase();
  const postalCode = extractPostalCode(address);
  const fields = [
    destination.zipCode,
    destination.subdistrictName,
    destination.districtName,
    destination.cityName,
    destination.provinceName,
    destination.label,
  ].map((value) => String(value || '').toLowerCase());

  return fields.reduce((score, field) => (
    score
    + (field && normalizedAddress.includes(field) ? 8 : 0)
    + (postalCode && field.includes(postalCode) ? 20 : 0)
  ), 0);
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
}) => {
  const navigate = useNavigate();
  const [customerCode, setCustomerCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [contact, setContact] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryArea, setDeliveryArea] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [securityChallenge, setSecurityChallenge] = useState(null);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [destinationSearch, setDestinationSearch] = useState('');
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedCourier, setSelectedCourier] = useState('');
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const paymentMethod = 'DOKU payment';
  const shippingFee = Number(selectedShipping?.cost || 0);
  const totalDue = Number(summary.subtotal || 0) + shippingFee;
  const shippingSummary = selectedShipping ? describeShippingRate(selectedShipping) : '';
  const shippingWeight = useMemo(() => getCheckoutShippingWeight(items), [items]);
  const checkoutDraft = useMemo(() => buildCheckoutDraft({
    customerCode,
    customerName,
    contact,
    deliveryAddress,
    deliveryArea,
    paymentMethod,
    shippingSummary,
    shippingFee,
    notes,
    items,
  }), [contact, customerCode, customerName, deliveryAddress, deliveryArea, items, notes, paymentMethod, shippingFee, shippingSummary]);

  const resetShipping = ({ keepSearch = true, keepCourier = true } = {}) => {
    setSelectedDestination(null);
    setSelectedShipping(null);
    setShippingOptions([]);
    setDestinationOptions([]);
    setShippingError('');
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
  };

  const updateDestinationSearch = (value) => {
    const nextValue = String(value || '');
    setDestinationSearch(nextValue);
    setDeliveryArea(nextValue);
    resetShipping();
  };

  const updateDeliveryAddress = (value) => {
    setDeliveryAddress(value);
    resetShipping();
  };

  const applyCheckoutCustomer = (customer) => {
    setSecurityChallenge(null);
    setSecurityAnswer('');
    setCustomerCode(customer.customerCode);
    setCustomerName(customer.customerName);
    setContact(customer.contact);
    setDeliveryAddress(customer.deliveryAddress || '');
    setDeliveryArea(customer.deliveryArea || '');
    setDestinationSearch(customer.deliveryArea || '');
    resetShipping();
    toast.success(`${customer.customerCode} loaded`);
  };

  const searchDestinations = async () => {
    const search = destinationSearch.trim();
    if (search.length < 3) {
      toast.error('Isi minimal 3 huruf area tujuan');
      return;
    }

    setShippingLoading(true);
    setShippingError('');
    setSelectedDestination(null);
    setSelectedCourier('');
    setSelectedShipping(null);
    setShippingOptions([]);
    try {
      const destinations = await searchShippingDestinations(search);
      setDestinationOptions(destinations);
      if (!destinations.length) {
        setShippingError('Area tujuan tidak ditemukan');
      }
    } catch (error) {
      setShippingError(error.message || 'Gagal mencari area tujuan');
    } finally {
      setShippingLoading(false);
    }
  };

  const loadShippingRates = async (destination) => {
    setSelectedDestination(destination);
    setDeliveryArea(destination.label);
    setDestinationSearch(destination.label);
    setDestinationOptions([]);
    setShippingLoading(true);
    setShippingError('');
    setSelectedShipping(null);
    setShippingOptions([]);
    try {
      const rates = await getShippingRates({
        destinationId: destination.id,
        weight: shippingWeight,
        couriers: selectedCourier ? [selectedCourier] : undefined,
      });
      setShippingOptions(rates);
      if (!rates.length) {
        setShippingError('Belum ada ongkir untuk area ini');
      }
    } catch (error) {
      setShippingError(error.message || 'Gagal menghitung ongkir');
    } finally {
      setShippingLoading(false);
    }
  };

  const autoCalculateShipping = async () => {
    const terms = buildAddressSearchTerms(deliveryAddress);
    if (!deliveryAddress.trim() || !terms.length) {
      toast.error('Isi alamat lengkap beserta kota atau kode pos dulu');
      return;
    }
    if (!selectedCourier) {
      toast.error('Pilih ekspedisi dulu');
      return;
    }

    setShippingLoading(true);
    setShippingError('');
    setDestinationOptions([]);
    setSelectedDestination(null);
    setSelectedShipping(null);
    setShippingOptions([]);

    try {
      let lastDestinations = [];
      for (const term of terms) {
        const destinations = await searchShippingDestinations(term);
        lastDestinations = destinations;
        const sortedDestinations = [...destinations].sort((first, second) => (
          scoreDestinationMatch(second, deliveryAddress) - scoreDestinationMatch(first, deliveryAddress)
        ));

        for (const destination of sortedDestinations) {
          const rates = await getShippingRates({
            destinationId: destination.id,
            weight: shippingWeight,
            couriers: [selectedCourier],
          });

          if (rates.length) {
            const sortedRates = [...rates].sort((first, second) => Number(first.cost || 0) - Number(second.cost || 0));
            setSelectedDestination(destination);
            setDeliveryArea(destination.label);
            setDestinationSearch(destination.label);
            setShippingOptions(sortedRates);
            return;
          }
        }
      }

      setDestinationOptions(lastDestinations);
      setShippingError(lastDestinations.length
        ? 'Area ditemukan, tapi ongkir belum tersedia. Pilih area manual atau lengkapi kode pos.'
        : 'Area tujuan belum ditemukan. Lengkapi alamat dengan kota dan kode pos.');
    } catch (error) {
      setShippingError(error.message || 'Gagal menghitung ongkir otomatis');
    } finally {
      setShippingLoading(false);
    }
  };

  const lookupCustomer = async () => {
    if (!customerCode.trim()) {
      toast.error('Customer code is required');
      return;
    }

    setLookupLoading(true);
    const customer = await lookupCheckoutCustomerByCode(customerCode);
    setLookupLoading(false);
    if (!customer) {
      toast.error('Customer code not found');
      return;
    }

    if (customer.requiresSecurity) {
      setCustomerName('');
      setContact('');
      setDeliveryAddress('');
      setDeliveryArea('');
      resetShipping({ keepSearch: false });
      setSecurityChallenge(customer);
      setSecurityAnswer('');
      setCustomerCode(customer.customerCode);
      toast.info('Security question is required');
      return;
    }

    applyCheckoutCustomer(customer);
  };

  const chooseShippingCourier = (courierCode) => {
    setSelectedCourier(courierCode);
    setSelectedShipping(null);
    setShippingOptions([]);
    setSelectedDestination(null);
    setDestinationOptions([]);
    setDeliveryArea('');
    setDestinationSearch('');
    setShippingError('');
  };

  const chooseShippingRate = (rate) => {
    setSelectedCourier(rate?.courierCode || '');
    setSelectedShipping(rate);
  };

  const verifyCustomerSecurity = async () => {
    if (!securityChallenge?.customerCode || !securityAnswer.trim()) {
      toast.error('Security answer is required');
      return;
    }

    setLookupLoading(true);
    const customer = await lookupCheckoutCustomerByCode(securityChallenge.customerCode, securityAnswer);
    setLookupLoading(false);
    if (!customer || customer.requiresSecurity) {
      toast.error('Security answer is incorrect');
      return;
    }

    applyCheckoutCustomer(customer);
  };

  const copyCustomerCode = async () => {
    if (!submittedOrder?.customerCode) return;
    await navigator.clipboard.writeText(submittedOrder.customerCode);
    toast.success(`${submittedOrder.customerCode} copied`);
  };

  const submitOrder = async ({ onSuccess } = {}) => {
    if (!items.length) return;
    if (!customerName.trim() || !contact.trim() || !deliveryAddress.trim()) {
      toast.error('Name, contact, and address are required');
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

    setSaving(true);
    try {
      const order = await createOrder({
        customerName,
        customerCode,
        contact,
        deliveryAddress,
        deliveryArea,
        notes: buildOrderNotes({ deliveryAddress, deliveryArea, paymentMethod, shippingSummary, notes }),
        items,
        subtotal: totalDue,
        quantity: summary.quantity,
        checkoutDraft,
        paymentProvider: 'doku',
      });
      const checkout = await createDokuCheckout({
        order,
        amount: totalDue,
        customerName,
        contact,
        callbackPath: paymentPath,
      });
      await updateOrderPaymentStatus(order.id || order.orderNumber, {
        paymentStatus: 'pending',
        paymentProvider: 'doku',
        paymentReference: checkout.requestId || '',
        status: 'pending_payment',
      });
      sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify({
        paymentUrl: checkout.paymentUrl,
        invoiceNumber: checkout.invoiceNumber || order.orderNumber,
        orderNumber: order.orderNumber,
        customerCode: order.customerCode || customerCode,
        amount: totalDue,
        customerName,
        shippingSummary,
        shippingFee,
        createdAt: new Date().toISOString(),
      }));
      clearCart();
      setSubmittedOrder(order);
      toast.success(`Order ${order.orderNumber} saved. Customer code: ${order.customerCode || customerCode}`);
      onSuccess?.(order);
      navigate(paymentPath);
    } catch (error) {
      toast.error(error.message || 'Failed to save order');
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
    destinationSearch,
    destinationOptions,
    selectedDestination,
    shippingOptions,
    selectedCourier,
    selectedShipping,
    shippingLoading,
    shippingError,
    paymentMethod,
    shippingFee,
    totalDue,
    shippingSummary,
    shippingWeight,
    setCustomerName,
    setContact,
    setDeliveryAddress: updateDeliveryAddress,
    setNotes,
    setSecurityAnswer,
    setSelectedShipping: chooseShippingRate,
    chooseShippingCourier,
    updateCustomerCode,
    updateDestinationSearch,
    searchDestinations,
    autoCalculateShipping,
    loadShippingRates,
    lookupCustomer,
    verifyCustomerSecurity,
    copyCustomerCode,
    submitOrder,
  };
};
