import InternationalCheckoutNotice from '@/components/storefront/InternationalCheckoutNotice.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BadgePercent, CheckCircle2, ChevronDown, CreditCard, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import TextReveal from '@/components/storefront/TextReveal.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { bespokeOccasionOptions } from '@/data/storefront.js';
import { useMicroInteractions } from '@/hooks/useParallax.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { useBespokeSettings } from '@/hooks/useBespokeSettings.js';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCatalogProduct } from '@/hooks/useCatalogProducts.js';
import { checkoutPaymentMethods, getCheckoutPaymentMethod, isManualTransferPayment } from '@/services/cartService.js';
import { createDokuCheckout } from '@/services/dokuCheckoutService.js';
import { createBespokeRequest, updateOrderStatus } from '@/services/orderService.js';
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
} from '@/services/voucherService.js';
import { buildVoucherSnapshot } from '@/utils/voucherSnapshot.js';
import { getOptimizedStorageImageUrl as img } from '@/utils/storageImage.js';
import { publicErrorMessage } from '@/utils/publicErrorMessage.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';

// Keys: module-level, so no hook can run here. The component translates them.
const stepKeys = ['bsp.scent', 'bsp.preferences', 'bsp.bottle', 'bsp.addressShort', 'bsp.pay'];

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

// Returns a message KEY, never a sentence. This is a module-level helper, so it cannot call t() — and a
// default that returned Indonesian would put it into the English shop with nothing to flag it.
const getFriendlyShippingErrorKey = (error, fallbackKey = 'bsp.areaSearchFailed') => {
  const message = String(error?.message || error || '').trim();
  if (/destination|domestic|data not found|not found/i.test(message)) {
    return 'bsp.areaNotFound';
  }
  if (/network|fetch|failed|unavailable/i.test(message)) {
    return 'bsp.shippingUnreachable';
  }
  return fallbackKey;
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
        <img src={img(imageUrl, 240)} alt="" loading="lazy" decoding="async" />
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
  const { t } = useTranslate();
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
  const activeLabel = getOptionDisplayValue(activeOption, t('bsp.activeChoice'));

  return (
    <div className="editorial-bespoke-preview">
      <div className="editorial-bespoke-preview__visual">
        {visualImage ? (
          <img className="editorial-bespoke-preview__backdrop" src={img(visualImage, 720)} alt={activeLabel} loading="lazy" decoding="async" />
        ) : null}
        <div className="editorial-bespoke-preview__mockup" aria-hidden="true">
          <span className={`editorial-bespoke-preview__bottle${isSquare ? ' is-square' : ''}${isLarge ? ' is-large' : ''}${isSmall ? ' is-small' : ''}`} />
          <span className={`editorial-bespoke-preview__cap${isStone ? ' is-stone' : ''}${isAcrylic ? ' is-acrylic' : ''}`} />
          <span className="editorial-bespoke-preview__label">{label?.label || t('bsp.label')}</span>
        </div>
        <div className="editorial-bespoke-preview__focus">
          <span>{t('bsp.previewFocus')}</span>
          <strong>{activeLabel}</strong>
        </div>
      </div>
      <div className="editorial-bespoke-preview__meta">
        <span className={activeGroup === 'size' ? 'is-active' : ''}>{size?.label || t('bsp.size')}</span>
        <span className={activeGroup === 'bottle' ? 'is-active' : ''}>{bottle?.label || t('bsp.bottle')}</span>
        <span className={activeGroup === 'cap' ? 'is-active' : ''}>{cap?.label || t('bsp.cap')}</span>
        <span className={activeGroup === 'label' ? 'is-active' : ''}>{label?.label || t('bsp.label')}</span>
        {material ? <span className={activeGroup === 'material' ? 'is-active' : ''}>{material.label}</span> : null}
      </div>
    </div>
  );
};

const BespokePage = () => {
  const { t } = useTranslate();
  const revealRef = useScrollReveal();
  const { magnetic } = useMicroInteractions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referenceProduct = useCatalogProduct(searchParams.get('reference'));
  const settings = useBespokeSettings();
  // The option prices live in the database. Until they arrive, useBespokeSettings hands back the bundled
  // defaults, and those are simply out of date — 30 ml reads Rp 350.000 there against Rp 200.000 in the
  // shop. Showing a first-time visitor a price 75% too high for a tenth of a second is worse than showing
  // them a dash, so the summary waits rather than guessing.
  const priceReady = !settings.loading;
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
    occasion: bespokeOccasionOptions[0]?.value || '',
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
  // The chosen bottle size, not a flat one: the order endpoint now weighs the bespoke bottle by the size
  // option it priced, so quoting a different weight here would show one courier fee and charge another.
  const shippingWeight = useMemo(
    () => getCheckoutShippingWeight([{ quantity: 1, size: getOptionDisplayValue(selectedSize, form.size) }]),
    [selectedSize, form.size],
  );
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
    label: t('bsp.noAddon'),
    value: '',
    description: t('bsp.noAddonBody'),
  }), [t]);
  const bespokeChoiceGroups = useMemo(() => [
    {
      key: 'size',
      tabLabel: t('bsp.size'),
      eyebrow: 'UKURAN',
      title: t('bsp.pickSize'),
      field: 'size',
      selected: selectedSize,
      options: bottleSizeOptions,
    },
    {
      key: 'bottle',
      tabLabel: t('bsp.bottle'),
      eyebrow: 'BOTOL',
      title: t('bsp.bottleType'),
      field: 'bottleType',
      selected: selectedBottle,
      options: bottleTypeOptions,
    },
    {
      key: 'cap',
      tabLabel: t('bsp.cap'),
      eyebrow: 'CAP',
      title: t('bsp.capDesign'),
      field: 'capDesign',
      selected: selectedCap,
      options: capDesignOptions,
    },
    {
      key: 'label',
      tabLabel: t('bsp.label'),
      eyebrow: 'LABEL',
      title: t('bsp.labelDesign'),
      field: 'labelDesign',
      selected: selectedLabel,
      options: labelDesignOptions,
    },
    {
      key: 'material',
      tabLabel: t('bsp.material'),
      eyebrow: 'MATERIAL',
      title: t('bsp.addonMaterial'),
      field: 'exoticMaterial',
      selected: selectedMaterial || noneMaterialOption,
      options: [noneMaterialOption, ...exoticMaterialOptions],
    },
  ], [bottleSizeOptions, bottleTypeOptions, capDesignOptions, exoticMaterialOptions, labelDesignOptions, noneMaterialOption, selectedBottle, selectedCap, selectedLabel, selectedMaterial, selectedSize, t]);
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
      toast.error(t('bsp.minThree'));
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
        setShippingError(t('bsp.areaNotFound'));
      }
    } catch (error) {
      setShippingError(t(getFriendlyShippingErrorKey(error)));
    } finally {
      setShippingLoading(false);
    }
  }, [destinationSearch, t]);

  const loadShippingRates = useCallback(async (destination, { courierCode = selectedCourier, autoSelectCheapest = false } = {}) => {
    setSelectedDestination(destination);
    setDestinationSearch(destination.label);
    updateField('deliveryArea', destination.label);
    setDestinationOptions([]);
    setSelectedShipping(null);
    setShippingOptions([]);
    if (!courierCode) {
      setShippingError(t('bsp.pickCourierFirst'));
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
        setShippingError(t('bsp.noRates'));
      }
    } catch (error) {
      setShippingError(t(getFriendlyShippingErrorKey(error, 'bsp.rateFailed')));
    } finally {
      setShippingLoading(false);
    }
  }, [estimatedTotal, selectedCourier, shippingWeight, updateField, t]);

  const autoCalculateShipping = useCallback(async ({
    courierCode = selectedCourier,
    searchText = '',
    autoSelectBest = false,
  } = {}) => {
    const search = String(searchText || destinationSearch || form.deliveryAddress || '').trim();
    if (search.length < 3) {
      toast.error(t('bsp.areaFirst'));
      return;
    }
    if (!courierCode) {
      toast.error(t('bsp.courierFirst'));
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
        ? t('bsp.pickAreaThenService')
        : t('bsp.areaNotFound'));
    } catch (error) {
      setShippingError(t(getFriendlyShippingErrorKey(error, 'bsp.rateFailedArea')));
    } finally {
      setShippingLoading(false);
    }
  }, [destinationSearch, form.deliveryAddress, loadShippingRates, selectedCourier, selectedDestination, t]);

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
    if (!form.customerName.trim()) return t('bsp.errName');
    if (!form.contact.trim()) return t('bsp.errContact');
    if (!form.scentDescription.trim()) return t('bsp.errScent');
    if (!form.size) return t('bsp.errSize');
    if (estimatedTotal <= 0) return t('bsp.errPrice');
    if (!form.deliveryAddress.trim()) return t('bsp.errAddress');
    if (!selectedDestination) return t('bsp.errArea');
    if (!selectedCourier) return t('bsp.errCourier');
    if (!selectedShipping) return t('bsp.errService');
    if (!form.preorderAcknowledged) return t('bsp.errPreorder');
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
        throw new Error(voucherValidation?.message || t('bsp.errVoucher'));
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
        optionIds: {
          size: getOptionKey(selectedSize),
          bottleType: getOptionKey(selectedBottle),
          capDesign: getOptionKey(selectedCap),
          labelDesign: getOptionKey(selectedLabel),
          exoticMaterial: selectedMaterial ? getOptionKey(selectedMaterial) : '',
        },
        // Shipping references so the authoritative endpoint can re-price the courier server-side.
        shippingDestinationId: selectedDestination?.id || '',
        shippingDestination: selectedDestination || null,
        shippingCourier: selectedShipping?.courierCode || selectedCourier || '',
        shippingService: selectedShipping?.service || '',
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
      // Charge the order's authoritative subtotal. On the direct-insert path this equals checkoutTotalDue;
      // on the endpoint path it's the server recompute, so the buyer is charged exactly what was stored.
      const paymentAmount = Number(order.subtotal) || checkoutTotalDue;

      if (isManualPayment) {
        const manualTransfer = {
          method: selectedPaymentMethod.provider,
          bankName: selectedPaymentMethod.bankName,
          accountNumber: selectedPaymentMethod.accountNumber,
          accountName: selectedPaymentMethod.accountName,
          amount: paymentAmount,
        };
        // api/orders/create.js already stored payment_status 'pending' / status 'pending_payment'. The
        // browser copy was filtered by RLS (admin-only UPDATE) and now throws; the bank details the buyer
        // sees come from MANUAL_TRANSFER_PAYMENT anyway (audit round 9).
        sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify({
          paymentType: selectedPaymentMethod.provider,
          paymentProvider: selectedPaymentMethod.provider,
          invoiceNumber: order.orderNumber,
          orderNumber: order.orderNumber,
          customerCode: order.customerCode || form.customerCode,
          amount: paymentAmount,
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
        (voucherSnapshot?.code ? voucher.removeVoucher : clearAppliedVoucherCode)();
        toast.success(`Request bespoke tersimpan: ${order.orderNumber}`);
        navigate(`/payment?order=${encodeURIComponent(order.orderNumber)}&payment=manual`);
        return;
      }

      const checkout = await createDokuCheckout({
        order,
        amount: paymentAmount,
        customerName: form.customerName,
        contact: form.contact,
        items: order.items || [],
        callbackPath: '/payment',
      });
      // api/doku/checkout.js already persisted this payment session server-side with the service role;
      // the browser copy was filtered by RLS for every buyer and now throws (audit round 9).
      sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify({
        paymentType: 'doku',
        paymentProvider: 'doku',
        paymentUrl: checkout.paymentUrl,
        invoiceNumber: checkout.invoiceNumber || order.orderNumber,
        orderNumber: order.orderNumber,
        customerCode: order.customerCode || form.customerCode,
        amount: paymentAmount,
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
      (voucherSnapshot?.code ? voucher.removeVoucher : clearAppliedVoucherCode)();
      toast.success(`Request bespoke tersimpan: ${order.orderNumber}`);
      navigate(`/payment?order=${encodeURIComponent(order.orderNumber)}&payment=doku`);
    } catch (error) {
      if (createdOrder) {
        // The cancel is best-effort cleanup; it must not replace the error the buyer needs to see.
        try {
          await updateOrderStatus(createdOrder.id || createdOrder.orderNumber, 'cancelled');
        } catch (cancelError) {
          console.warn('Failed to cancel bespoke order after payment session error:', cancelError.message || cancelError);
        }
      }
      toast.error(publicErrorMessage(error, t('bsp.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{t('bsp.tab')}</title>
        <meta name="description" content={t('bsp.meta')} />
      </Helmet>

      <main className="solivagant-editorial-home" ref={revealRef}>
        <ScrollProgress />
        <PublicHeader />

        <section className="bespoke-hero">
          <div className="bespoke-hero__copy">
            <p className="editorial-eyebrow hero-animate-text hero-animate-text--d1">{t('bsp.eyebrow')}</p>
            <TextReveal as="h1" text={t('bsp.title')} />
            <p className="hero-animate-text hero-animate-text--d3">{t('bsp.lead')}</p>
          </div>
          <ol className="bespoke-hero__steps hero-animate-fade">
            {stepKeys.map((stepKey, index) => (
              <li key={stepKey}><span>{index + 1}</span>{t(stepKey)}</li>
            ))}
          </ol>
        </section>

        <section className="editorial-section editorial-bespoke-flow editorial-section--compact" data-reveal>
          <form className="editorial-form editorial-form--bespoke" onSubmit={submitRequest}>
            <div className="editorial-bespoke-stage" data-reveal>
              <div className="editorial-bespoke-stage__head">
                <p className="editorial-eyebrow">{t('bsp.designFirst')}</p>
                <h2>{t('bsp.designFirstTitle')}</h2>
                <p>{t('bsp.designFirstBody')}</p>
              </div>
              <div className="editorial-bespoke-brief-grid">
                <label className="editorial-bespoke-brief-card editorial-bespoke-brief-card--name">
                  <span>{t('bsp.perfumeName')}</span>
                  <input type="text" value={form.perfumeName} onChange={(event) => updateField('perfumeName', event.target.value)} placeholder={t('bsp.namePlaceholder')} />
                  <small>{t('bsp.perfumeNameHint')}</small>
                </label>
                <label className="editorial-bespoke-brief-card editorial-bespoke-brief-card--scent">
                  <span>{t('bsp.scentDirection')}</span>
                  <textarea rows="4" value={form.scentDescription} onChange={(event) => updateField('scentDescription', event.target.value)} placeholder={t('bsp.scentPlaceholder')} />
                  <div className="editorial-bespoke-prompt-chips" aria-label={t('bsp.scentShortcuts')}>
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
                  <legend>{t('bsp.moment')}</legend>
                  <div className="editorial-bespoke-occasion-grid">
                    {bespokeOccasionOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={form.occasion === option.value ? 'is-active' : ''}
                        onClick={() => updateField('occasion', option.value)}
                      >
                        {t(option.labelKey)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
            <div className="editorial-bespoke-choice-panel editorial-bespoke-choice-panel--compact" data-reveal>
              <div className="editorial-bespoke-choice-panel__head">
                <p className="editorial-eyebrow">{t('bsp.visualEyebrow')}</p>
                <h3>{t('bsp.visualBody')}</h3>
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
                  <div className="editorial-bespoke-tabs" role="tablist" aria-label={t('bsp.optionGroups')}>
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
                  <div className="editorial-bespoke-choice-group editorial-bespoke-choice-group--inside" role="tabpanel" aria-label={activeChoice.title}>
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

            <div className="editorial-bespoke-next" data-reveal>
              <div className="editorial-bespoke-summary">
                <p className="editorial-eyebrow">{t('bsp.summaryEyebrow')}</p>
                <dl>
                  <div><dt>{t('bsp.perfumeName')}</dt><dd>{form.perfumeName || t('bsp.notFilled')}</dd></div>
                  <div><dt>{t('bsp.scent')}</dt><dd>{form.scentDescription || t('bsp.notFilled')}</dd></div>
                  <div><dt>{t('bsp.bottle')}</dt><dd>{[selectedSize?.label, selectedBottle?.label, selectedCap?.label].filter(Boolean).join(' / ') || '-'}</dd></div>
                  <div><dt>{t('bsp.subtotal')}</dt><dd>{priceReady ? formatRupiah(estimatedTotal) : '—'}</dd></div>
                </dl>
              </div>
              <div className="editorial-bespoke-next__action">
                <p>{t('bsp.designOk')}</p>
                <button type="button" className="editorial-button editorial-button--primary magnetic-hover" onClick={() => setCheckoutOpen(true)} onMouseMove={magnetic}>
                  {t('bsp.toCheckout')}
                  <CreditCard className="h-4 w-4" />
                </button>
              </div>
            </div>

            {checkoutOpen ? (
              <div className="editorial-bespoke-checkout" data-reveal>
                <div className="editorial-bespoke-stage__head">
                  <p className="editorial-eyebrow">CHECKOUT</p>
                  <h2>{t('bsp.contactSection')}</h2>
                  <p>{t('bsp.contactSectionBody')}</p>
                </div>
                {/* Bespoke ships through the same domestic courier API as the product checkout, so the
                    same dead end waits here: a foreign city returns an empty area list with no error. */}
                <InternationalCheckoutNotice className="mb-4" />
                <div className="editorial-bespoke-checkout__fields">
                  <label>{t('bsp.name')}<input type="text" value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} placeholder={t('bsp.yourName')} /></label>
                  <label>{t('bsp.contact')}<input type="text" value={form.contact} onChange={(event) => updateField('contact', event.target.value)} placeholder="nama@email.com / +62..." /></label>
                  <label>{t('bsp.address')}<textarea rows="4" autoComplete="street-address" value={form.deliveryAddress} onChange={(event) => updateField('deliveryAddress', event.target.value)} placeholder={t('bsp.addressPlaceholder')} /></label>
                </div>
                <div className="editorial-voucher-panel">
                  <div>
                    <p className="editorial-eyebrow">ONGKIR</p>
                    <strong>{t('bsp.pickArea')}</strong>
                  </div>
                  <div className="editorial-inline-field">
                    <input
                      type="text"
                      value={destinationSearch}
                      onChange={(event) => updateDestinationSearch(event.target.value)}
                      placeholder={t('bsp.areaPlaceholder')} aria-label={t('bsp.areaAria')}
                    />
                    <button type="button" className="editorial-button" onClick={searchDestinations} disabled={shippingLoading || destinationSearch.trim().length < 3}>
                      {shippingLoading ? t('bsp.searching') : t('bsp.search')}
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                  <label className="editorial-select-shell">
                    <span>{selectedCourier ? courierLabels[selectedCourier] : t('bsp.pickShippingCourier')}</span>
                    <ChevronDown className="h-4 w-4" />
                    <select value={selectedCourier} onChange={(event) => handleCourierChange(event.target.value)} aria-label={t('bsp.pickShippingCourier')}>
                      <option value="">{t('bsp.pickCourier')}</option>
                      {checkoutCourierOptions.map((courier) => (
                        <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="editorial-button" onClick={() => autoCalculateShipping()} disabled={shippingLoading || destinationSearch.trim().length < 3 || !selectedCourier}>
                    {shippingLoading ? t('bsp.calculating') : t('bsp.showRates')}
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
                    <strong>{voucher.appliedVoucher ? `${voucher.appliedVoucher.code} diterapkan` : t('bsp.voucherEnter')}</strong>
                  </div>
                  <div className="editorial-inline-field">
                    <input
                      type="text"
                      value={voucher.inputCode}
                      onChange={(event) => voucher.setInputCode(event.target.value.toUpperCase())}
                      placeholder={t('bsp.voucherPlaceholder')}
                    />
                    <button type="button" className="editorial-button" onClick={voucher.applyVoucher} disabled={voucher.loading}>
                      {voucher.loading ? t('bsp.checking') : t('bsp.apply')}
                      <BadgePercent className="h-4 w-4" />
                    </button>
                  </div>
                  {voucher.appliedVoucher ? (
                    <div className="editorial-voucher-applied">
                      <span>{t('bsp.voucherDiscount')}</span>
                      <strong>-{formatRupiah(discountAmount)}</strong>
                      <button type="button" className="editorial-icon-button" onClick={voucher.removeVoucher} aria-label={t('bsp.voucherRemove')}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : voucher.message ? (
                    <p className="editorial-helper-text editorial-helper-text--warning">{voucher.message}</p>
                  ) : null}
                </div>
                <div className="editorial-cart-summary">
                  <div className="editorial-cart-summary__row"><span>{t('bsp.subtotal')}</span><strong>{priceReady ? formatRupiah(estimatedTotal) : '—'}</strong></div>
                  {discountAmount ? <div className="editorial-cart-summary__row"><span>Voucher</span><strong>-{formatRupiah(discountAmount)}</strong></div> : null}
                  <div className="editorial-cart-summary__row"><span>{t('bsp.shipping')}</span><strong>{shippingFee ? formatRupiah(shippingFee) : '-'}</strong></div>
                  <div className="editorial-cart-summary__row editorial-cart-summary__row--total"><span>{t('bsp.transferTotal')}</span><strong>{priceReady ? formatRupiah(totalDue) : '—'}</strong></div>
                </div>
                <label>{t('bsp.payment')}<select value={form.paymentMethod} onChange={(event) => updateField('paymentMethod', event.target.value)}>{checkoutPaymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
                <label className="editorial-checkbox-row">
                  <input type="checkbox" checked={form.preorderAcknowledged} onChange={(event) => updateField('preorderAcknowledged', event.target.checked)} />
                  {t('bsp.preorderConfirm')}
                </label>
                <button type="submit" className="editorial-button editorial-button--primary magnetic-hover" disabled={saving} onMouseMove={magnetic}>
                  {saving ? t('bsp.saving') : (isManualPayment ? t('bsp.orderUpload') : t('bsp.orderPay'))}
                  {isManualPayment ? <CheckCircle2 className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                </button>
              </div>
            ) : null}
          </form>
        </section>

        <StorefrontFooter />
      </main>
    </>
  );
};

export default BespokePage;
