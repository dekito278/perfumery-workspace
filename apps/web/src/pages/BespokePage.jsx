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

const scentDirectionPrompts = ['Woody', 'Floral', 'Fresh', 'Gourmand', 'Smoky', 'Clean musk'];

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

const BespokeOptionCard = ({ active, children, description = '', imageUrl = '', label, onClick }) => (
  <button
    type="button"
    aria-label={label || children}
    aria-pressed={active}
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
    </span>
  </button>
);

const BespokeBottlePreview = ({ activeGroup = 'size', bottle, cap, label, size, material }) => {
  const isStone = /batu|stone/i.test(`${cap?.label || ''} ${cap?.value || ''}`);
  const isAcrylic = /akrilik|acrylic/i.test(`${cap?.label || ''} ${cap?.value || ''}`);
  const isSquare = /square|kotak/i.test(`${bottle?.label || ''} ${bottle?.value || ''}`);
  const sizeText = `${size?.label || ''} ${size?.value || ''}`;
  const isLarge = /100|large|besar/i.test(sizeText);
  const isSmall = /15|mini|small|kecil/i.test(sizeText);
  const activeOption = {
    bottle,
    cap,
    label,
    material,
    size,
  }[activeGroup];
  const visualImage = activeOption?.imageUrl || bottle?.imageUrl || cap?.imageUrl || label?.imageUrl || size?.imageUrl;
  const activeLabel = getOptionDisplayValue(activeOption, 'Pilihan aktif');

  return (
    <div className="editorial-bespoke-preview">
      <div className="editorial-bespoke-preview__visual">
        {visualImage ? (
          <img className="editorial-bespoke-preview__backdrop" src={visualImage} alt={activeLabel} loading="lazy" decoding="async" />
        ) : null}
        <div className="editorial-bespoke-preview__mockup" aria-hidden="true">
          <span className={`editorial-bespoke-preview__bottle${isSquare ? ' is-square' : ''}${isLarge ? ' is-large' : ''}${isSmall ? ' is-small' : ''}`} />
          <span className={`editorial-bespoke-preview__cap${isStone ? ' is-stone' : ''}${isAcrylic ? ' is-acrylic' : ''}`} />
          <span className="editorial-bespoke-preview__label">{label?.label || 'Label'}</span>
        </div>
        <div className="editorial-bespoke-preview__focus">
          <span>Preview fokus</span>
          <strong>{activeLabel}</strong>
        </div>
      </div>
      <div className="editorial-bespoke-preview__meta">
        <span className={activeGroup === 'size' ? 'is-active' : ''}>{size?.label || 'Ukuran'}</span>
        <span className={activeGroup === 'bottle' ? 'is-active' : ''}>{bottle?.label || 'Botol'}</span>
        <span className={activeGroup === 'cap' ? 'is-active' : ''}>{cap?.label || 'Cap'}</span>
        <span className={activeGroup === 'label' ? 'is-active' : ''}>{label?.label || 'Label'}</span>
        {material ? <span className={activeGroup === 'material' ? 'is-active' : ''}>{material.label}</span> : null}
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
  const [activeChoiceGroup, setActiveChoiceGroup] = useState('size');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
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
  const noneMaterialOption = useMemo(() => ({
    id: 'none',
    label: 'Tanpa add-on',
    value: '',
    description: 'Tanpa tambahan material eksotis.',
  }), []);
  const bespokeChoiceGroups = useMemo(() => [
    {
      key: 'size',
      tabLabel: 'Ukuran',
      eyebrow: 'UKURAN',
      title: 'Size selection',
      field: 'size',
      selected: selectedSize,
      options: bottleSizeOptions,
    },
    {
      key: 'bottle',
      tabLabel: 'Botol',
      eyebrow: 'BOTOL',
      title: 'Bottle type',
      field: 'bottleType',
      selected: selectedBottle,
      options: bottleTypeOptions,
    },
    {
      key: 'cap',
      tabLabel: 'Cap',
      eyebrow: 'CAP',
      title: 'Cap design',
      field: 'capDesign',
      selected: selectedCap,
      options: capDesignOptions,
    },
    {
      key: 'label',
      tabLabel: 'Label',
      eyebrow: 'LABEL',
      title: 'Label design',
      field: 'labelDesign',
      selected: selectedLabel,
      options: labelDesignOptions,
    },
    {
      key: 'material',
      tabLabel: 'Material',
      eyebrow: 'MATERIAL',
      title: 'Material add-on',
      field: 'exoticMaterial',
      selected: selectedMaterial || noneMaterialOption,
      options: [noneMaterialOption, ...exoticMaterialOptions],
    },
  ], [
    bottleSizeOptions,
    bottleTypeOptions,
    capDesignOptions,
    exoticMaterialOptions,
    labelDesignOptions,
    noneMaterialOption,
    selectedBottle,
    selectedCap,
    selectedLabel,
    selectedMaterial,
    selectedSize,
  ]);
  const activeChoice = bespokeChoiceGroups.find((group) => group.key === activeChoiceGroup) || bespokeChoiceGroups[0];
  const isNoneMaterialOption = useCallback((option) => getOptionKey(option) === getOptionKey(noneMaterialOption), [noneMaterialOption]);
  const isActiveChoiceOption = useCallback((group, option) => {
    if (group.key === 'material' && isNoneMaterialOption(option)) {
      return !form.exoticMaterial;
    }
    return getOptionKey(group.selected) === getOptionKey(option);
  }, [form.exoticMaterial, isNoneMaterialOption]);
  const selectChoiceOption = useCallback((group, option) => {
    updateField(group.field, group.key === 'material' && isNoneMaterialOption(option) ? '' : getOptionKey(option));
  }, [isNoneMaterialOption, updateField]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- defaults are derived from the option arrays already in deps
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

        <section className="editorial-page-hero editorial-page-hero--split editorial-page-hero--compact">
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

        <section className="editorial-section editorial-bespoke-flow editorial-section--compact">
          <form className="editorial-form editorial-form--bespoke" onSubmit={submitRequest}>
            <div className="editorial-bespoke-stage">
              <div className="editorial-bespoke-stage__head">
                <p className="editorial-eyebrow">DESIGN FIRST</p>
                <h2>Mulai dari aroma dan bentuk botol.</h2>
                <p>Pilih arah scent, ukuran, botol, cap, label, dan material dulu. Data checkout diisi setelah desainnya terasa pas.</p>
              </div>
              <div className="editorial-bespoke-brief-grid">
                <label className="editorial-bespoke-brief-card editorial-bespoke-brief-card--name">
                  <span>Nama parfum</span>
                  <input type="text" value={form.perfumeName} onChange={(event) => updateField('perfumeName', event.target.value)} placeholder="Contoh: Rain Letter, Nocturne 03" />
                  <small>Nama bisa sementara, nanti masih bisa disempurnakan saat proses studio.</small>
                </label>
                <label className="editorial-bespoke-brief-card editorial-bespoke-brief-card--scent">
                  <span>Scent direction</span>
                  <textarea rows="4" value={form.scentDescription} onChange={(event) => updateField('scentDescription', event.target.value)} placeholder="Ceritakan mood aroma, notes favorit, atau memori yang ingin dibawa." />
                  <div className="editorial-bespoke-prompt-chips" aria-label="Scent direction shortcuts">
                    {scentDirectionPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => updateField('scentDescription', form.scentDescription.trim() ? `${form.scentDescription.trim()}, ${prompt}` : prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </label>
                <fieldset className="editorial-bespoke-brief-card editorial-bespoke-occasion">
                  <legend>Occasion</legend>
                  <div className="editorial-bespoke-occasion-grid">
                    {bespokeOccasionOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={form.occasion === option ? 'is-active' : ''}
                        onClick={() => updateField('occasion', option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
            <div className="editorial-bespoke-choice-panel editorial-bespoke-choice-panel--compact">
              <div className="editorial-bespoke-choice-panel__head">
                <p className="editorial-eyebrow">VISUAL CUSTOMIZER</p>
                <h3>Pilih kategori, lalu tentukan visualnya.</h3>
              </div>
              <div className="editorial-bespoke-customizer">
                <BespokeBottlePreview
                  activeGroup={activeChoice.key}
                  bottle={selectedBottle}
                  cap={selectedCap}
                  label={selectedLabel}
                  material={selectedMaterial}
                  size={selectedSize}
                />
                <div className="editorial-bespoke-customizer__controls">
                  <div className="editorial-bespoke-tabs" role="tablist" aria-label="Bespoke option groups">
                    {bespokeChoiceGroups.map((group) => (
                      <button
                        key={group.key}
                        type="button"
                        role="tab"
                        aria-selected={activeChoice.key === group.key}
                        className={activeChoice.key === group.key ? 'is-active' : ''}
                        onClick={() => setActiveChoiceGroup(group.key)}
                      >
                        {group.tabLabel}
                      </button>
                    ))}
                  </div>
                  <div className="editorial-bespoke-choice-group editorial-bespoke-choice-group--inside">
                    <div>
                      <p className="editorial-eyebrow">{activeChoice.eyebrow}</p>
                      <h3>{activeChoice.title}</h3>
                    </div>
                    <div className={`editorial-bespoke-option-grid${activeChoice.key === 'size' ? ' editorial-bespoke-option-grid--compact' : ''}`}>
                      {activeChoice.options.map((option) => (
                        <BespokeOptionCard
                          key={getOptionKey(option) || option.label}
                          active={isActiveChoiceOption(activeChoice, option)}
                          description={option.description}
                          imageUrl={option.imageUrl}
                          label={option.label}
                          onClick={() => selectChoiceOption(activeChoice, option)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="editorial-bespoke-next">
              <div className="editorial-bespoke-summary">
                <p className="editorial-eyebrow">REQUEST SUMMARY</p>
                <dl>
                  <div><dt>Nama parfum</dt><dd>{form.perfumeName || 'Belum diisi'}</dd></div>
                  <div><dt>Aroma</dt><dd>{form.scentDescription || 'Belum diisi'}</dd></div>
                  <div><dt>Botol</dt><dd>{[selectedSize?.label, selectedBottle?.label, selectedCap?.label].filter(Boolean).join(' / ') || '-'}</dd></div>
                  <div><dt>Subtotal custom</dt><dd>{formatRupiah(estimatedTotal)}</dd></div>
                </dl>
              </div>
              <div className="editorial-bespoke-next__action">
                <p>Sudah cocok dengan desainnya?</p>
                <button type="button" className="editorial-button editorial-button--primary" onClick={() => setCheckoutOpen(true)}>
                  Lanjut ke checkout
                  <CreditCard className="h-4 w-4" />
                </button>
              </div>
            </div>

            {checkoutOpen ? (
              <div className="editorial-bespoke-checkout">
                <div className="editorial-bespoke-stage__head">
                  <p className="editorial-eyebrow">CHECKOUT</p>
                  <h2>Data kontak, pengiriman, dan pembayaran.</h2>
                  <p>Bagian ini baru muncul setelah desain dipilih, supaya proses awal tetap fokus ke perfume ritualnya.</p>
                </div>
                <div className="editorial-bespoke-checkout__fields">
                  <label>Name<input type="text" value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} placeholder="Your name" /></label>
                  <label>Email / WhatsApp<input type="text" value={form.contact} onChange={(event) => updateField('contact', event.target.value)} placeholder="name@example.com / +62..." /></label>
                  <label>Delivery address<textarea rows="4" value={form.deliveryAddress} onChange={(event) => updateField('deliveryAddress', event.target.value)} placeholder="Alamat lengkap pengiriman" /></label>
                </div>
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
              </div>
            ) : null}
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
