import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BadgePercent, Check, CheckCircle2, ChevronDown, CreditCard, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import { bespokeOccasionOptions } from '@/data/storefront.js';
import { useBespokeSettings } from '@/hooks/useBespokeSettings.js';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCatalogProduct } from '@/hooks/useCatalogProducts.js';
import { checkoutPaymentMethods, getCheckoutPaymentMethod, isManualTransferPayment } from '@/services/cartService.js';
import { createDokuCheckout } from '@/services/dokuCheckoutService.js';
import { createBespokeRequest, updateOrderPaymentStatus, updateOrderStatus } from '@/services/orderService.js';
import { formatRupiah } from '@/services/productCatalogService.js';
import {
  describeShippingRate,
  getCheckoutShippingWeight,
  getShippingRates,
  searchShippingDestinations,
} from '@/services/shippingService.js';
import {
  applyVoucherToSubtotalAsync,
  clearAppliedVoucherCode,
  recordVoucherUsageForOrder,
} from '@/services/voucherService.js';
import { buildVoucherSnapshot } from '@/utils/voucherSnapshot.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';

const steps = ['Aroma', 'Preferensi', 'Botol', 'Alamat', 'Bayar'];

const firstEnabled = (options = []) => options.find((option) => option.enabled) || options[0] || {};

const checkoutCourierOptions = [
  { courierCode: 'jnt', label: 'JnT' },
  { courierCode: 'jne', label: 'JNE' },
  { courierCode: 'ide', label: 'IDEXPRES' },
  { courierCode: 'pos', label: 'POS' },
  { courierCode: 'anteraja', label: 'ANTERAJA' },
];

const courierLabels = checkoutCourierOptions.reduce((labels, courier) => ({
  ...labels,
  [courier.courierCode]: courier.label,
}), {});

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

const formatOptionPrice = (option) => {
  const price = Number(option?.price || 0);
  return price > 0 ? formatRupiah(price) : 'Included';
};

const getOptionKey = (option = {}) => String(option.id || option.value || option.label || '').trim();

const getOptionDisplayValue = (option = {}, fallback = '') => String(option.label || option.value || fallback || '').trim();

const optionMatchesValue = (option = {}, value = '') => {
  const currentValue = String(value || '').trim();
  return Boolean(currentValue) && [
    option.id,
    option.value,
    option.label,
  ].map((item) => String(item || '').trim()).includes(currentValue);
};

const BespokeOptionCard = ({ active, children, description = '', imageUrl = '', label, onClick, price }) => (
  <button
    type="button"
    className={`editorial-bespoke-option${active ? ' is-active' : ''}`}
    onClick={onClick}
  >
    <span className="editorial-bespoke-option__media">
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="editorial-bespoke-option__fallback" aria-hidden="true">
          <span />
        </span>
      )}
    </span>
    <span className="editorial-bespoke-option__body">
      <strong>{label || children}</strong>
      {description ? <small>{description}</small> : null}
      {price !== undefined ? <em>{price}</em> : null}
    </span>
  </button>
);

const BespokeBottlePreview = ({ bottle, cap, label, size, material }) => {
  const isStone = /batu|stone/i.test(`${cap?.label || ''} ${cap?.value || ''}`);
  const isAcrylic = /akrilik|acrylic/i.test(`${cap?.label || ''} ${cap?.value || ''}`);
  const isSquare = /square|kotak/i.test(`${bottle?.label || ''} ${bottle?.value || ''}`);
  const visualImage = cap?.imageUrl || bottle?.imageUrl || label?.imageUrl || size?.imageUrl;

  return (
    <div className="editorial-bespoke-preview">
      <div className="editorial-bespoke-preview__visual">
        {visualImage ? (
          <img src={visualImage} alt={cap?.label || bottle?.label || label?.label || 'Bespoke bottle option'} loading="lazy" decoding="async" />
        ) : (
          <div className="editorial-bespoke-preview__mockup" aria-hidden="true">
            <span className={`editorial-bespoke-preview__bottle${isSquare ? ' is-square' : ''}`} />
            <span className={`editorial-bespoke-preview__cap${isStone ? ' is-stone' : ''}${isAcrylic ? ' is-acrylic' : ''}`} />
            <span className="editorial-bespoke-preview__label">{label?.label || 'Label'}</span>
          </div>
        )}
      </div>
      <div className="editorial-bespoke-preview__meta">
        <span>{size?.label || 'Ukuran'}</span>
        <span>{bottle?.label || 'Botol'}</span>
        <span>{cap?.label || 'Cap'}</span>
        <span>{label?.label || 'Label'}</span>
        {material ? <span>{material.label}</span> : null}
      </div>
    </div>
  );
};

const BespokePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referenceProduct = useCatalogProduct(searchParams.get('reference'));
  const settings = useBespokeSettings();
  const bottleSizeOptions = useMemo(() => settings.bottleSizes.filter((option) => option.enabled), [settings.bottleSizes]);
  const bottleTypeOptions = useMemo(() => settings.bottleTypes.filter((option) => option.enabled), [settings.bottleTypes]);
  const capDesignOptions = useMemo(() => settings.capDesigns.filter((option) => option.enabled), [settings.capDesigns]);
  const labelDesignOptions = useMemo(() => settings.labelDesigns.filter((option) => option.enabled), [settings.labelDesigns]);
  const exoticMaterialOptions = useMemo(() => settings.exoticMaterials.filter((option) => option.enabled), [settings.exoticMaterials]);
  const defaultSize = firstEnabled(bottleSizeOptions);
  const defaultBottle = firstEnabled(bottleTypeOptions);
  const defaultCap = firstEnabled(capDesignOptions);
  const defaultLabel = firstEnabled(labelDesignOptions);
  const [saving, setSaving] = useState(false);
  const [destinationSearch, setDestinationSearch] = useState('');
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedCourier, setSelectedCourier] = useState('');
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const [form, setForm] = useState({
    customerName: '',
    contact: '',
    customerCode: '',
    perfumeName: '',
    scentDescription: referenceProduct?.notes || '',
    occasion: bespokeOccasionOptions[0] || '',
    size: defaultSize.value || '',
    bottleType: defaultBottle.value || '',
    capDesign: defaultCap.value || '',
    labelDesign: defaultLabel.value || '',
    exoticMaterial: '',
    deliveryAddress: '',
    deliveryArea: '',
    paymentMethod: checkoutPaymentMethods[0]?.id || 'manual_transfer_bca',
    preorderAcknowledged: false,
  });

  const selectedSize = bottleSizeOptions.find((option) => optionMatchesValue(option, form.size)) || defaultSize;
  const selectedBottle = bottleTypeOptions.find((option) => optionMatchesValue(option, form.bottleType)) || defaultBottle;
  const selectedCap = capDesignOptions.find((option) => optionMatchesValue(option, form.capDesign)) || defaultCap;
  const selectedLabel = labelDesignOptions.find((option) => optionMatchesValue(option, form.labelDesign)) || defaultLabel;
  const selectedMaterial = exoticMaterialOptions.find((option) => optionMatchesValue(option, form.exoticMaterial));
  const selectedPaymentMethod = getCheckoutPaymentMethod(form.paymentMethod);
  const isManualPayment = isManualTransferPayment(selectedPaymentMethod.provider);
  const estimatedTotal = [
    selectedSize?.price,
    selectedBottle?.price,
    selectedCap?.price,
    selectedLabel?.price,
    selectedMaterial?.price,
  ].reduce((sum, value) => sum + Number(value || 0), 0);
  const bespokeVoucherItems = useMemo(() => [{
    slug: 'bespoke-perfume-request',
    productSlug: 'bespoke-perfume-request',
    category: 'Bespoke',
    name: form.perfumeName || 'Bespoke perfume request',
    quantity: 1,
    priceNumber: estimatedTotal,
  }], [estimatedTotal, form.perfumeName]);
  const voucher = useAppliedVoucher(estimatedTotal, bespokeVoucherItems);
  const shippingWeight = useMemo(() => getCheckoutShippingWeight([{ quantity: 1 }]), []);
  const shippingFee = Number(selectedShipping?.cost || 0);
  const shippingSummary = selectedShipping ? describeShippingRate(selectedShipping) : '';
  const discountAmount = Number(voucher.discountAmount || 0);
  const discountedEstimatedTotal = Number(voucher.subtotalAfterDiscount ?? estimatedTotal);
  const totalDue = discountedEstimatedTotal + shippingFee;
  const visibleShippingOptions = selectedCourier
    ? shippingOptions.filter((rate) => rate.courierCode === selectedCourier)
    : shippingOptions;

  const updateField = useCallback((key, value) => setForm((current) => ({ ...current, [key]: value })), []);

  const resetShipping = useCallback(({ keepSearch = true, keepCourier = true } = {}) => {
    setSelectedDestination(null);
    setSelectedShipping(null);
    setShippingOptions([]);
    setDestinationOptions([]);
    setShippingError('');
    if (!keepCourier) setSelectedCourier('');
    if (!keepSearch) setDestinationSearch('');
  }, []);

  const updateDestinationSearch = useCallback((value) => {
    const nextValue = String(value || '');
    setDestinationSearch(nextValue);
    updateField('deliveryArea', nextValue);
    resetShipping({ keepSearch: true });
  }, [resetShipping, updateField]);

  const searchDestinations = useCallback(async () => {
    const search = destinationSearch.trim();
    if (search.length < 3) {
      toast.error('Isi minimal 3 huruf area, kecamatan, atau kota.');
      return;
    }

    setShippingLoading(true);
    setShippingError('');
    setSelectedDestination(null);
    setSelectedShipping(null);
    setShippingOptions([]);
    try {
      const destinations = await searchShippingDestinations(search);
      setDestinationOptions(destinations);
      if (!destinations.length) {
        setShippingError('Area belum ditemukan. Coba ketik kecamatan atau kota, contoh: Jakarta Selatan.');
      }
    } catch (error) {
      setShippingError(getFriendlyShippingError(error));
    } finally {
      setShippingLoading(false);
    }
  }, [destinationSearch]);

  const loadShippingRates = useCallback(async (destination, { courierCode = selectedCourier, autoSelectCheapest = false } = {}) => {
    setSelectedDestination(destination);
    setDestinationSearch(destination.label);
    updateField('deliveryArea', destination.label);
    setDestinationOptions([]);
    setSelectedShipping(null);
    setShippingOptions([]);
    if (!courierCode) {
      setShippingError('Pilih ekspedisi dulu untuk melihat layanan ongkir.');
      return;
    }

    setShippingLoading(true);
    setShippingError('');
    try {
      const rates = await getShippingRates({
        destinationId: destination.id,
        destination,
        destinationLabel: destination.label,
        subtotal: estimatedTotal,
        weight: shippingWeight,
        couriers: [courierCode],
      });
      const sortedRates = [...rates].sort((first, second) => Number(first.cost || 0) - Number(second.cost || 0));
      setShippingOptions(sortedRates);
      if (autoSelectCheapest && sortedRates.length) {
        setSelectedShipping(sortedRates[0]);
      }
      if (!sortedRates.length) {
        setShippingError('Belum ada ongkir untuk area ini.');
      }
    } catch (error) {
      setShippingError(getFriendlyShippingError(error, 'Gagal menghitung ongkir. Coba pilih area atau kurir lain.'));
    } finally {
      setShippingLoading(false);
    }
  }, [estimatedTotal, selectedCourier, shippingWeight, updateField]);

  const autoCalculateShipping = useCallback(async ({
    courierCode = selectedCourier,
    searchText = '',
    autoSelectBest = false,
  } = {}) => {
    const search = String(searchText || destinationSearch || form.deliveryAddress || '').trim();
    if (search.length < 3) {
      toast.error('Isi area ongkir dulu, contoh: Jakarta Selatan.');
      return;
    }
    if (!courierCode) {
      toast.error('Pilih ekspedisi dulu.');
      return;
    }

    setShippingLoading(true);
    setShippingError('');
    setDestinationOptions([]);
    setSelectedShipping(null);
    setShippingOptions([]);

    try {
      if (selectedDestination?.id && String(selectedDestination.label || '').trim() === search) {
        await loadShippingRates(selectedDestination, { courierCode, autoSelectCheapest: autoSelectBest });
        return;
      }

      setSelectedDestination(null);
      const destinations = await searchShippingDestinations(search);
      if (autoSelectBest && destinations.length) {
        await loadShippingRates(destinations[0], { courierCode, autoSelectCheapest: true });
        setDestinationOptions([]);
        setShippingError('');
        return;
      }
      setDestinationOptions(destinations);
      setShippingError(destinations.length
        ? 'Pilih area tujuan yang paling sesuai, lalu pilih layanan ongkir.'
        : 'Area belum ditemukan. Coba ketik kecamatan atau kota, contoh: Jakarta Selatan.');
    } catch (error) {
      setShippingError(getFriendlyShippingError(error, 'Gagal menghitung ongkir. Coba pakai nama kecamatan atau kota.'));
    } finally {
      setShippingLoading(false);
    }
  }, [destinationSearch, form.deliveryAddress, loadShippingRates, selectedCourier, selectedDestination]);

  const handleCourierChange = useCallback((courierCode) => {
    setSelectedCourier(courierCode);
    setSelectedShipping(null);
    setShippingOptions([]);
    setShippingError('');
    if (!courierCode) return;

    const searchText = destinationSearch.trim() || form.deliveryArea.trim() || form.deliveryAddress.trim();
    if (searchText.length >= 3) {
      autoCalculateShipping({ courierCode, searchText, autoSelectBest: true });
    }
  }, [autoCalculateShipping, destinationSearch, form.deliveryAddress, form.deliveryArea]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      size: bottleSizeOptions.some((option) => optionMatchesValue(option, current.size)) ? current.size : (getOptionKey(defaultSize) || ''),
      bottleType: bottleTypeOptions.some((option) => optionMatchesValue(option, current.bottleType)) ? current.bottleType : (getOptionKey(defaultBottle) || ''),
      capDesign: capDesignOptions.some((option) => optionMatchesValue(option, current.capDesign)) ? current.capDesign : (getOptionKey(defaultCap) || ''),
      labelDesign: labelDesignOptions.some((option) => optionMatchesValue(option, current.labelDesign)) ? current.labelDesign : (getOptionKey(defaultLabel) || ''),
      exoticMaterial: current.exoticMaterial && exoticMaterialOptions.some((option) => optionMatchesValue(option, current.exoticMaterial)) ? current.exoticMaterial : '',
    }));
  }, [bottleSizeOptions, bottleTypeOptions, capDesignOptions, labelDesignOptions, exoticMaterialOptions, defaultSize.value, defaultBottle.value, defaultCap.value, defaultLabel.value]);

  const validateForm = () => {
    if (!form.customerName.trim()) return 'Nama wajib diisi.';
    if (!form.contact.trim()) return 'Email atau WhatsApp wajib diisi.';
    if (!form.scentDescription.trim()) return 'Ceritakan arah aroma dulu.';
    if (!form.size) return 'Pilih ukuran botol.';
    if (!form.deliveryAddress.trim()) return 'Alamat pengiriman wajib diisi.';
    if (!selectedDestination) return 'Pilih area ongkir dari hasil pencarian.';
    if (!selectedCourier) return 'Pilih kurir pengiriman.';
    if (!selectedShipping) return 'Pilih layanan ongkir.';
    if (!form.preorderAcknowledged) return 'Konfirmasi estimasi pre-order dulu.';
    return '';
  };

  const submitRequest = async (event) => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    let createdOrder = null;
    try {
      const voucherValidation = voucher.appliedCode
        ? await applyVoucherToSubtotalAsync({ code: voucher.appliedCode, subtotal: estimatedTotal, items: bespokeVoucherItems })
        : null;
      if (voucher.appliedCode && !voucherValidation?.valid) {
        throw new Error(voucherValidation?.message || 'Voucher tidak bisa digunakan.');
      }
      const checkoutVoucherDiscount = voucherValidation?.discountAmount || 0;
      const checkoutDiscountedEstimatedTotal = Math.max(estimatedTotal - checkoutVoucherDiscount, 0);
      const checkoutTotalDue = checkoutDiscountedEstimatedTotal + shippingFee;
      const voucherSnapshot = buildVoucherSnapshot({
        voucher: voucherValidation?.voucher || voucher.appliedVoucher,
        voucherCode: voucher.appliedCode,
        discountAmount: checkoutVoucherDiscount,
        subtotalBeforeDiscount: estimatedTotal,
        subtotalAfterDiscount: checkoutDiscountedEstimatedTotal,
        eligibleSubtotal: voucherValidation?.eligibleSubtotal,
        eligibleQuantity: voucherValidation?.eligibleQuantity,
      });
      const order = await createBespokeRequest({
        ...form,
        size: getOptionDisplayValue(selectedSize, form.size),
        bottleType: getOptionDisplayValue(selectedBottle, form.bottleType),
        capDesign: getOptionDisplayValue(selectedCap, form.capDesign),
        labelDesign: getOptionDisplayValue(selectedLabel, form.labelDesign),
        exoticMaterial: selectedMaterial ? getOptionDisplayValue(selectedMaterial, form.exoticMaterial) : '',
        deliveryArea: selectedDestination?.label || destinationSearch,
        preferredNotes: form.scentDescription,
        budget: formatRupiah(estimatedTotal),
        itemPrice: estimatedTotal,
        estimatedTotal,
        shippingFee,
        shippingSummary,
        totalPrice: checkoutTotalDue,
        paymentProvider: selectedPaymentMethod.provider,
        voucherCode: voucherSnapshot?.code || '',
        voucherDiscount: checkoutVoucherDiscount,
        voucherSnapshot,
        referenceProductName: referenceProduct?.name || '',
        referenceProductSlug: referenceProduct?.slug || '',
      });
      createdOrder = order;

      if (isManualPayment) {
        const manualTransfer = {
          method: selectedPaymentMethod.provider,
          bankName: selectedPaymentMethod.bankName,
          accountNumber: selectedPaymentMethod.accountNumber,
          accountName: selectedPaymentMethod.accountName,
          amount: checkoutTotalDue,
        };
        await updateOrderPaymentStatus(order.id || order.orderNumber, {
          paymentStatus: 'pending',
          paymentProvider: selectedPaymentMethod.provider,
          paymentReference: `${selectedPaymentMethod.bankName}-${order.orderNumber}`,
          paymentUrl: '',
          paymentExpiresAt: '',
          paymentSessionId: '',
          paymentResponse: manualTransfer,
          status: 'pending_payment',
          audit: false,
        });
        sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify({
          paymentType: selectedPaymentMethod.provider,
          paymentProvider: selectedPaymentMethod.provider,
          invoiceNumber: order.orderNumber,
          orderNumber: order.orderNumber,
          customerCode: order.customerCode || form.customerCode,
          amount: checkoutTotalDue,
          customerName: form.customerName,
          paymentStatus: 'pending',
          manualTransfer,
          shippingSummary,
          shippingFee,
          voucherCode: voucherSnapshot?.code || '',
          voucherDiscount: checkoutVoucherDiscount,
          voucherSnapshot,
          createdAt: new Date().toISOString(),
        }));
        if (voucherSnapshot?.code) {
          await recordVoucherUsageForOrder({
            orderId: order.id,
            orderNumber: order.orderNumber,
            voucherSnapshot,
            items: bespokeVoucherItems,
          });
        }
        (voucherSnapshot?.code ? voucher.removeVoucher : clearAppliedVoucherCode)();
        toast.success(`Request bespoke tersimpan: ${order.orderNumber}`);
        navigate(`/payment?order=${encodeURIComponent(order.orderNumber)}&payment=manual`);
        return;
      }

      const checkout = await createDokuCheckout({
        order,
        amount: checkoutTotalDue,
        customerName: form.customerName,
        contact: form.contact,
        items: order.items || [],
        callbackPath: '/payment',
      });
      await updateOrderPaymentStatus(order.id || order.orderNumber, {
        paymentStatus: 'pending',
        paymentProvider: 'doku',
        paymentReference: checkout.requestId || '',
        paymentUrl: checkout.paymentUrl,
        paymentExpiresAt: checkout.paymentExpiresAt || '',
        paymentSessionId: checkout.paymentSessionId || '',
        paymentResponse: checkout.dokuResponse || {},
        status: 'pending_payment',
        audit: false,
      });
      sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify({
        paymentType: 'doku',
        paymentProvider: 'doku',
        paymentUrl: checkout.paymentUrl,
        invoiceNumber: checkout.invoiceNumber || order.orderNumber,
        orderNumber: order.orderNumber,
        customerCode: order.customerCode || form.customerCode,
        amount: checkoutTotalDue,
        customerName: form.customerName,
        paymentStatus: 'pending',
        paymentExpiresAt: checkout.paymentExpiresAt || '',
        paymentSessionId: checkout.paymentSessionId || '',
        shippingSummary,
        shippingFee,
        voucherCode: voucherSnapshot?.code || '',
        voucherDiscount: checkoutVoucherDiscount,
        voucherSnapshot,
        createdAt: new Date().toISOString(),
      }));
      if (voucherSnapshot?.code) {
        await recordVoucherUsageForOrder({
          orderId: order.id,
          orderNumber: order.orderNumber,
          voucherSnapshot,
          items: bespokeVoucherItems,
        });
      }
      (voucherSnapshot?.code ? voucher.removeVoucher : clearAppliedVoucherCode)();
      toast.success(`Request bespoke tersimpan: ${order.orderNumber}`);
      navigate(`/payment?order=${encodeURIComponent(order.orderNumber)}&payment=doku`);
    } catch (error) {
      if (createdOrder) {
        await updateOrderStatus(createdOrder.id || createdOrder.orderNumber, 'cancelled');
      }
      toast.error(error.message || 'Gagal menyimpan request bespoke.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Bespoke Perfume Consultation - SOLIVAGANT</title>
        <meta name="description" content="Request a SOLIVAGANT custom perfume consultation through aroma, bottle choices, delivery data, and payment." />
      </Helmet>

      <main className="solivagant-editorial-home">
        <PublicHeader />

        <section className="editorial-page-hero editorial-page-hero--split">
          <div>
            <p className="editorial-eyebrow">BESPOKE PERFUME CONSULTATION</p>
            <h1>Bespoke Perfume Consultation</h1>
            <p className="editorial-product-detail__price">Request parfum custom / Pre-order 7-14 hari</p>
            <p>Ceritakan arah aroma, pilih detail botol, lalu buat request. Setelah submit, kamu akan diarahkan ke instruksi pembayaran.</p>
          </div>
          <ol className="editorial-steps editorial-steps--panel">
            {steps.map((step, index) => (
              <li key={step}><Check className="h-4 w-4" />{index + 1}. {step}</li>
            ))}
          </ol>
        </section>

        <section className="editorial-section editorial-bespoke editorial-section--compact">
          <div>
            <p className="editorial-eyebrow">LIVE BRIEF</p>
            <h2>Custom request yang masuk ke order studio.</h2>
            <p>
              Pilihan botol, label, material, dan pembayaran mengikuti pengaturan bespoke yang aktif, sehingga request yang masuk siap diproses sebagai order.
            </p>
            <div className="editorial-bespoke-summary">
              <p className="editorial-eyebrow">REQUEST SUMMARY</p>
              <dl>
                <div><dt>Nama parfum</dt><dd>{form.perfumeName || 'Belum diisi'}</dd></div>
                <div><dt>Aroma</dt><dd>{form.scentDescription || 'Belum diisi'}</dd></div>
                <div><dt>Botol</dt><dd>{[selectedSize?.label, selectedBottle?.label, selectedCap?.label].filter(Boolean).join(' / ') || '-'}</dd></div>
                <div><dt>Subtotal custom</dt><dd>{formatRupiah(estimatedTotal)}</dd></div>
                {discountAmount ? <div><dt>Voucher</dt><dd>-{formatRupiah(discountAmount)}</dd></div> : null}
                <div><dt>Ongkir</dt><dd>{shippingFee ? formatRupiah(shippingFee) : 'Belum dipilih'}</dd></div>
                <div><dt>Total bayar</dt><dd>{formatRupiah(totalDue)}</dd></div>
              </dl>
            </div>
          </div>
          <form className="editorial-form" onSubmit={submitRequest}>
            <label>Nama parfum / project name<input type="text" value={form.perfumeName} onChange={(event) => updateField('perfumeName', event.target.value)} placeholder="A working name for the custom scent" /></label>
            <label>Scent direction<textarea rows="4" value={form.scentDescription} onChange={(event) => updateField('scentDescription', event.target.value)} placeholder="Woody, floral, aquatic, gourmand, smoky..." /></label>
            <label>Occasion<select value={form.occasion} onChange={(event) => updateField('occasion', event.target.value)}>{bespokeOccasionOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <div className="editorial-bespoke-choice-panel">
              <div className="editorial-bespoke-choice-panel__head">
                <p className="editorial-eyebrow">VISUAL CUSTOMIZER</p>
                <h3>Pilih opsi dengan preview, bukan dropdown.</h3>
              </div>
              <BespokeBottlePreview
                bottle={selectedBottle}
                cap={selectedCap}
                label={selectedLabel}
                material={selectedMaterial}
                size={selectedSize}
              />
            </div>
            <div className="editorial-bespoke-choice-group">
              <div>
                <p className="editorial-eyebrow">UKURAN</p>
                <h3>Size selection</h3>
              </div>
              <div className="editorial-bespoke-option-grid editorial-bespoke-option-grid--compact">
                {bottleSizeOptions.map((option) => (
                  <BespokeOptionCard
                    key={option.value}
                    active={getOptionKey(selectedSize) === getOptionKey(option)}
                    imageUrl={option.imageUrl}
                    label={option.label}
                    onClick={() => updateField('size', getOptionKey(option))}
                    price={formatOptionPrice(option)}
                  />
                ))}
              </div>
            </div>
            <div className="editorial-bespoke-choice-group">
              <div>
                <p className="editorial-eyebrow">BOTOL</p>
                <h3>Bottle type</h3>
              </div>
              <div className="editorial-bespoke-option-grid">
                {bottleTypeOptions.map((option) => (
                  <BespokeOptionCard
                    key={option.value}
                    active={getOptionKey(selectedBottle) === getOptionKey(option)}
                    description={option.description}
                    imageUrl={option.imageUrl}
                    label={option.label}
                    onClick={() => updateField('bottleType', getOptionKey(option))}
                    price={formatOptionPrice(option)}
                  />
                ))}
              </div>
            </div>
            <div className="editorial-bespoke-choice-group">
              <div>
                <p className="editorial-eyebrow">CAP</p>
                <h3>Cap design</h3>
              </div>
              <div className="editorial-bespoke-option-grid">
                {capDesignOptions.map((option) => (
                  <BespokeOptionCard
                    key={option.value}
                    active={getOptionKey(selectedCap) === getOptionKey(option)}
                    description={option.description}
                    imageUrl={option.imageUrl}
                    label={option.label}
                    onClick={() => updateField('capDesign', getOptionKey(option))}
                    price={formatOptionPrice(option)}
                  />
                ))}
              </div>
            </div>
            <div className="editorial-bespoke-choice-group">
              <div>
                <p className="editorial-eyebrow">LABEL</p>
                <h3>Label design</h3>
              </div>
              <div className="editorial-bespoke-option-grid">
                {labelDesignOptions.map((option) => (
                  <BespokeOptionCard
                    key={option.value}
                    active={getOptionKey(selectedLabel) === getOptionKey(option)}
                    description={option.description}
                    imageUrl={option.imageUrl}
                    label={option.label}
                    onClick={() => updateField('labelDesign', getOptionKey(option))}
                    price={formatOptionPrice(option)}
                  />
                ))}
              </div>
            </div>
            <div className="editorial-bespoke-choice-group">
              <div>
                <p className="editorial-eyebrow">MATERIAL</p>
                <h3>Material add-on</h3>
              </div>
              <div className="editorial-bespoke-option-grid">
                <BespokeOptionCard
                  active={!form.exoticMaterial}
                  label="Tanpa add-on"
                  onClick={() => updateField('exoticMaterial', '')}
                  price="Included"
                />
                {exoticMaterialOptions.map((option) => (
                  <BespokeOptionCard
                    key={option.value}
                    active={getOptionKey(selectedMaterial) === getOptionKey(option)}
                    description={option.description}
                    imageUrl={option.imageUrl}
                    label={option.label}
                    onClick={() => updateField('exoticMaterial', getOptionKey(option))}
                    price={formatOptionPrice(option)}
                  />
                ))}
              </div>
            </div>
            <label>Name<input type="text" value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} placeholder="Your name" /></label>
            <label>Email / WhatsApp<input type="text" value={form.contact} onChange={(event) => updateField('contact', event.target.value)} placeholder="name@example.com / +62..." /></label>
            <label>Delivery address<textarea rows="4" value={form.deliveryAddress} onChange={(event) => updateField('deliveryAddress', event.target.value)} placeholder="Alamat lengkap pengiriman" /></label>
            <div className="editorial-voucher-panel">
              <div>
                <p className="editorial-eyebrow">ONGKIR</p>
                <strong>Pilih area dan layanan pengiriman</strong>
              </div>
              <div className="editorial-inline-field">
                <input
                  type="text"
                  value={destinationSearch}
                  onChange={(event) => updateDestinationSearch(event.target.value)}
                  placeholder="Kecamatan / kota tujuan"
                />
                <button type="button" className="editorial-button" onClick={searchDestinations} disabled={shippingLoading || destinationSearch.trim().length < 3}>
                  {shippingLoading ? 'Mencari...' : 'Cari'}
                  <Search className="h-4 w-4" />
                </button>
              </div>
              <label className="editorial-select-shell">
                <span>{selectedCourier ? courierLabels[selectedCourier] : 'Pilih kurir pengiriman'}</span>
                <ChevronDown className="h-4 w-4" />
                <select value={selectedCourier} onChange={(event) => handleCourierChange(event.target.value)} aria-label="Pilih kurir pengiriman">
                  <option value="">Pilih kurir</option>
                  {checkoutCourierOptions.map((courier) => (
                    <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="editorial-button" onClick={() => autoCalculateShipping()} disabled={shippingLoading || destinationSearch.trim().length < 3 || !selectedCourier}>
                {shippingLoading ? 'Menghitung...' : 'Tampilkan ongkir'}
              </button>
              {selectedDestination ? <p className="editorial-helper-text">Area: {selectedDestination.label}</p> : null}
              {destinationOptions.length && !selectedDestination ? (
                <div className="editorial-option-grid">
                  {destinationOptions.map((destination) => (
                    <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)}>
                      {destination.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {visibleShippingOptions.length ? (
                <div className="editorial-option-grid">
                  {visibleShippingOptions.map((rate) => {
                    const active = selectedShipping?.courierCode === rate.courierCode && selectedShipping?.service === rate.service;
                    return (
                      <button
                        key={`${rate.courierCode}-${rate.service}-${rate.cost}`}
                        type="button"
                        className={active ? 'is-active' : ''}
                        onClick={() => setSelectedShipping(rate)}
                      >
                        {courierLabels[rate.courierCode] || rate.courierName} {rate.serviceLabel || rate.service}
                        {' / '}
                        {formatRupiah(rate.cost)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {selectedShipping?.promotionApplied ? <p className="editorial-helper-text">{selectedShipping.promotionLabel}</p> : null}
              {shippingError ? <p className="editorial-helper-text editorial-helper-text--warning">{shippingError}</p> : null}
            </div>
            <div className="editorial-voucher-panel">
              <div>
                <p className="editorial-eyebrow">VOUCHER</p>
                <strong>{voucher.appliedVoucher ? `${voucher.appliedVoucher.code} diterapkan` : 'Masukkan kode voucher'}</strong>
              </div>
              <div className="editorial-inline-field">
                <input
                  type="text"
                  value={voucher.inputCode}
                  onChange={(event) => voucher.setInputCode(event.target.value.toUpperCase())}
                  placeholder="Kode voucher"
                />
                <button type="button" className="editorial-button" onClick={voucher.applyVoucher} disabled={voucher.loading}>
                  {voucher.loading ? 'Cek...' : 'Pakai'}
                  <BadgePercent className="h-4 w-4" />
                </button>
              </div>
              {voucher.appliedVoucher ? (
                <div className="editorial-voucher-applied">
                  <span>Diskon voucher</span>
                  <strong>-{formatRupiah(discountAmount)}</strong>
                  <button type="button" className="editorial-icon-button" onClick={voucher.removeVoucher} aria-label="Hapus voucher">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : voucher.message ? (
                <p className="editorial-helper-text editorial-helper-text--warning">{voucher.message}</p>
              ) : null}
            </div>
            <div className="editorial-cart-summary">
              <div className="editorial-cart-summary__row"><span>Subtotal custom</span><strong>{formatRupiah(estimatedTotal)}</strong></div>
              {discountAmount ? <div className="editorial-cart-summary__row"><span>Voucher</span><strong>-{formatRupiah(discountAmount)}</strong></div> : null}
              <div className="editorial-cart-summary__row"><span>Ongkir</span><strong>{shippingFee ? formatRupiah(shippingFee) : '-'}</strong></div>
              <div className="editorial-cart-summary__row editorial-cart-summary__row--total"><span>Total transfer</span><strong>{formatRupiah(totalDue)}</strong></div>
            </div>
            <label>Payment<select value={form.paymentMethod} onChange={(event) => updateField('paymentMethod', event.target.value)}>{checkoutPaymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
            <label className="editorial-checkbox-row">
              <input type="checkbox" checked={form.preorderAcknowledged} onChange={(event) => updateField('preorderAcknowledged', event.target.checked)} />
              Saya memahami bespoke perfume adalah pre-order dengan estimasi pengerjaan 7-14 hari setelah brief dikonfirmasi.
            </label>
            <button type="submit" className="editorial-button editorial-button--primary" disabled={saving}>
              {saving ? 'Saving request...' : (isManualPayment ? 'Buat order & upload bukti' : 'Buat order & bayar')}
              {isManualPayment ? <CheckCircle2 className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            </button>
          </form>
        </section>

        <footer className="editorial-footer">
          <span>SOLIVAGANT by Dekito</span>
          <Link to="/catalog">Explore Collection</Link>
        </footer>
      </main>
    </>
  );
};

export default BespokePage;
