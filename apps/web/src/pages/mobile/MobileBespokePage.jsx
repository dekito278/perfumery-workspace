import InternationalCheckoutNotice from '@/components/storefront/InternationalCheckoutNotice.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CheckCircle2, ChevronDown, ClipboardList, CreditCard, MessageCircle, Sparkles, Ticket, X } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import {
  bespokeOccasionOptions,
} from '@/data/storefront.js';
import { useBespokeSettings } from '@/hooks/useBespokeSettings.js';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCatalogProduct } from '@/hooks/useCatalogProducts.js';
import { cn } from '@/lib/utils.js';
import { checkoutPaymentMethods, getCheckoutPaymentMethod, isManualTransferPayment } from '@/services/cartService.js';
import { lookupCustomerByCode } from '@/services/customerService.js';
import { createBespokeRequest, updateOrderStatus } from '@/services/orderService.js';
import { createDokuCheckout } from '@/services/dokuCheckoutService.js';
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
import { formatRupiah } from '@/services/productCatalogService.js';
import { buildVoucherSnapshot } from '@/utils/voucherSnapshot.js';
import { getOptimizedStorageImageUrl as img } from '@/utils/storageImage.js';
import { publicErrorMessage } from '@/utils/publicErrorMessage.js';
import { desktopCanonicalPath, toAbsoluteUrl } from '@/utils/seo.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';
const BESPOKE_DRAFT_STORAGE_KEY = 'dekito.storefront.bespokeDraft.v1';

const readBespokeDraft = () => {
  if (typeof window === 'undefined') return {};

  try {
    const rawValue = window.localStorage.getItem(BESPOKE_DRAFT_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};
    return parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue) ? parsedValue : {};
  } catch {
    return {};
  }
};

const writeBespokeDraft = (draft) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BESPOKE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
};

const clearBespokeDraft = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(BESPOKE_DRAFT_STORAGE_KEY);
};

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

const OptionButton = ({ active, children, imageUrl = '', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'mobile-commerce-choice min-h-[48px] overflow-hidden p-2 text-left text-xs font-bold leading-snug',
      active ? 'is-active' : 'text-[#6b7280]'
    )}
  >
    {imageUrl ? (
      <span className="mb-2 block aspect-square w-full overflow-hidden rounded-[12px] bg-[#f8f7f4]">
        <img src={img(imageUrl, 240)} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" width="240" height="240" />
      </span>
    ) : null}
    <span className="block px-1 py-0.5">{children}</span>
  </button>
);

const CapMockup = ({ cap, bottle, label }) => {
  const { t } = useTranslate();
  // Compared against the STORED value, so it stays the literal string the database holds. This is
  // data, not copy — translating it would silently stop the stone cap ever matching.
  const isStone = cap?.value === 'Cap batu';
  const isAcrylic = cap?.value === 'Cap custom akrilik';
  const isSquare = /square|kotak/i.test(`${bottle?.label || ''} ${bottle?.value || ''}`);
  const visualImage = cap?.imageUrl || bottle?.imageUrl || label?.imageUrl;

  if (visualImage) {
    return (
      <div className="mobile-commerce-panel relative aspect-square w-full overflow-hidden bg-[#f8f7f4] p-0">
        <img src={img(visualImage, 360)} alt={cap?.label || bottle?.label || label?.label || t('bsp.customOption')} className="h-full w-full object-cover" loading="lazy" decoding="async" width="360" height="360" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3">
          <div className="flex flex-wrap gap-1">
            {[bottle?.label, cap?.label, label?.label].filter(Boolean).map((item) => (
              <span key={item} className="mobile-commerce-chip bg-white/90 px-2 py-1 text-[10px]">{item}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-commerce-panel relative aspect-square w-full overflow-hidden bg-[#f8f7f4] p-0">
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#d8c8a4]/50 to-transparent" />
      <div className={`absolute left-1/2 top-[24%] h-[44%] w-[27%] -translate-x-1/2 border border-editorial-stone/20 bg-white shadow-sm ${isSquare ? 'rounded-xl' : 'rounded-b-[24px] rounded-t-xl'}`} />
      <div className="absolute left-1/2 top-[14%] h-[16%] w-[36%] -translate-x-1/2 rounded-xl border border-editorial-stone/20 bg-[#1f2937] shadow-sm" />
      {isStone ? <div className="absolute left-1/2 top-[10%] h-[18%] w-[42%] -translate-x-1/2 rounded-[18px] bg-[radial-gradient(circle_at_30%_25%,#f9fafb,#8b8a7c_45%,#2f352f)] shadow-md" /> : null}
      {isAcrylic ? <div className="absolute left-1/2 top-[10%] h-[18%] w-[42%] -translate-x-1/2 rounded-xl bg-[linear-gradient(135deg,rgba(245,158,11,.85),rgba(236,72,153,.75),rgba(59,130,246,.8))] shadow-md" /> : null}
      <div className="absolute left-1/2 top-[47%] min-w-10 -translate-x-1/2 rounded-lg border border-editorial-stone/10 bg-editorial-ivory px-2 py-1 text-center text-[9px] font-bold text-editorial-charcoal">{label?.label || t('bsp.label')}</div>
      <div className="mobile-commerce-chip absolute bottom-3 left-3 bg-white/80 px-2.5 py-1 text-[10px]">{bottle?.label || t('bsp.bottle')}</div>
      <div className="mobile-commerce-chip absolute bottom-3 right-3 bg-white/80 px-2.5 py-1 text-[10px]">{cap?.label}</div>
    </div>
  );
};

const MobileBespokePage = () => {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referenceProduct = useCatalogProduct(searchParams.get('reference'));
  const bespokeSettings = useBespokeSettings();
  const bottleSizeOptions = useMemo(() => bespokeSettings.bottleSizes.filter((option) => option.enabled), [bespokeSettings.bottleSizes]);
  const bottleTypeOptions = useMemo(() => bespokeSettings.bottleTypes.filter((option) => option.enabled), [bespokeSettings.bottleTypes]);
  const capDesignOptions = useMemo(() => bespokeSettings.capDesigns.filter((option) => option.enabled), [bespokeSettings.capDesigns]);
  const labelDesignOptions = useMemo(() => bespokeSettings.labelDesigns.filter((option) => option.enabled), [bespokeSettings.labelDesigns]);
  const exoticMaterialOptions = useMemo(() => bespokeSettings.exoticMaterials.filter((option) => option.enabled), [bespokeSettings.exoticMaterials]);
  const savedDraft = useMemo(() => readBespokeDraft(), []);
  const savedForm = savedDraft.form && typeof savedDraft.form === 'object' && !Array.isArray(savedDraft.form) ? savedDraft.form : {};
  const [step, setStep] = useState(Number.isInteger(savedDraft.step) ? Math.min(Math.max(savedDraft.step, 0), 4) : 0);
  const [submittedRequest, setSubmittedRequest] = useState(null);
  const [saving, setSaving] = useState(false);
  const [destinationSearch, setDestinationSearch] = useState(savedDraft.destinationSearch || savedForm.deliveryArea || '');
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(savedDraft.selectedDestination || null);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedCourier, setSelectedCourier] = useState(savedDraft.selectedCourier || '');
  const [selectedShipping, setSelectedShipping] = useState(savedDraft.selectedShipping || null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const [form, setForm] = useState({
    customerCode: '',
    perfumeName: '',
    scentDescription: referenceProduct?.notes || '',
    occasion: bespokeOccasionOptions[0].value,
    size: bottleSizeOptions[0]?.value || '',
    bottleType: bottleTypeOptions[0]?.value || '',
    capDesign: capDesignOptions[0]?.value || '',
    labelDesign: labelDesignOptions[0]?.value || '',
    exoticMaterial: '',
    paymentMethod: checkoutPaymentMethods[0]?.id || 'manual_transfer_bca',
    customerName: '',
    contact: '',
    deliveryAddress: '',
    preorderAcknowledged: false,
    ...savedForm,
  });

  useEffect(() => {
    setForm((current) => {
      const nextForm = { ...current };
      const ensureActiveValue = (field, options) => {
        const valueIsActive = options.some((option) => option.value === nextForm[field]);
        if (!valueIsActive) nextForm[field] = options[0]?.value || '';
      };

      ensureActiveValue('size', bottleSizeOptions);
      ensureActiveValue('bottleType', bottleTypeOptions);
      ensureActiveValue('capDesign', capDesignOptions);
      ensureActiveValue('labelDesign', labelDesignOptions);

      if (nextForm.exoticMaterial && !exoticMaterialOptions.some((option) => option.value === nextForm.exoticMaterial)) {
        nextForm.exoticMaterial = '';
      }

      return Object.keys(nextForm).some((key) => nextForm[key] !== current[key]) ? nextForm : current;
    });
  }, [bottleSizeOptions, bottleTypeOptions, capDesignOptions, labelDesignOptions, exoticMaterialOptions]);

  useEffect(() => {
    writeBespokeDraft({
      form,
      destinationSearch,
      selectedCourier,
      selectedDestination,
      selectedShipping,
      step,
      updatedAt: new Date().toISOString(),
    });
  }, [destinationSearch, form, selectedCourier, selectedDestination, selectedShipping, step]);

  const updateField = useCallback((key, value) => setForm((current) => ({ ...current, [key]: value })), []);
  const selectedSize = bottleSizeOptions.find((option) => option.value === form.size) || bottleSizeOptions[0];
  const selectedBottleType = bottleTypeOptions.find((option) => option.value === form.bottleType) || bottleTypeOptions[0];
  const selectedCap = capDesignOptions.find((option) => option.value === form.capDesign) || capDesignOptions[0];
  const selectedLabel = labelDesignOptions.find((option) => option.value === form.labelDesign) || labelDesignOptions[0];
  const selectedExoticMaterial = exoticMaterialOptions.find((option) => option.value === form.exoticMaterial);
  const selectedPaymentMethod = getCheckoutPaymentMethod(form.paymentMethod);
  const isManualPayment = isManualTransferPayment(selectedPaymentMethod.provider);
  const estimatedTotal = Number(selectedSize?.price || 0) + Number(selectedBottleType?.price || 0) + Number(selectedCap?.price || 0) + Number(selectedLabel?.price || 0) + Number(selectedExoticMaterial?.price || 0);
  const bespokeVoucherItems = useMemo(() => [{
    slug: 'bespoke-perfume-request',
    productSlug: 'bespoke-perfume-request',
    category: 'Bespoke',
    name: form.perfumeName ? `Bespoke perfume: ${form.perfumeName}` : 'Bespoke perfume request',
    quantity: 1,
    priceNumber: estimatedTotal,
  }], [estimatedTotal, form.perfumeName]);
  const voucher = useAppliedVoucher(estimatedTotal, bespokeVoucherItems);
  const shippingFee = Number(selectedShipping?.cost || 0);
  const discountAmount = Number(voucher.discountAmount || 0);
  const discountedEstimatedTotal = Number(voucher.subtotalAfterDiscount ?? estimatedTotal);
  const totalDue = discountedEstimatedTotal + shippingFee;
  const shippingSummary = selectedShipping ? describeShippingRate(selectedShipping) : '';
  // Same as desktop: weigh the chosen bottle size, or the fee quoted here disagrees with the one the
  // order endpoint charges.
  const shippingWeight = useMemo(
    () => getCheckoutShippingWeight([{ quantity: 1, size: selectedSize?.label || form.size || '' }]),
    [selectedSize, form.size],
  );
  const visibleShippingOptions = selectedCourier
    ? shippingOptions.filter((rate) => rate.courierCode === selectedCourier)
    : shippingOptions;
  const budgetSummary = [
    selectedSize ? `${selectedSize.label} bottle` : '',
    selectedBottleType ? selectedBottleType.label : '',
    selectedCap ? selectedCap.label : '',
    selectedLabel ? selectedLabel.label : '',
    selectedExoticMaterial ? selectedExoticMaterial.label : '',
  ].filter(Boolean).join(' / ');

  const pasteCustomerCode = useCallback(async () => {
    try {
      const clipboardText = await navigator.clipboard?.readText?.();
      const nextCode = String(clipboardText || '').trim().toUpperCase();
      if (!nextCode) {
        toast.error(t('bsp.clipboardEmpty'));
        return;
      }
      updateField('customerCode', nextCode);
      toast.success(t('bsp.codePasted'));
    } catch (error) {
      toast.error(t('bsp.pasteBlocked'));
    }
  }, [updateField, t]);

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
    resetShipping({ keepSearch: true });
  }, [resetShipping]);

  const lookupCustomer = useCallback(async () => {
    if (!form.customerCode.trim()) {
      toast.error(t('bsp.codeRequired'));
      return;
    }

    const customer = await lookupCustomerByCode(form.customerCode);
    if (!customer) {
      toast.error(t('bsp.codeNotFound'));
      return;
    }

    setForm((current) => ({
      ...current,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      // The public lookup no longer returns contact/address (they were harvestable by code guessing —
      // see 20260819120000_customer_lookup_pii_lockdown.sql), so keep whatever the buyer already typed.
      contact: customer.contact && customer.contact !== '-' ? customer.contact : current.contact,
      deliveryAddress: customer.deliveryAddress || current.deliveryAddress,
    }));
    updateDestinationSearch(customer.deliveryArea || '');
    toast.success(t('bsp.codeLoaded', { code: customer.customerCode }));
  }, [form.customerCode, updateDestinationSearch, t]);

  const chooseShippingCourier = useCallback((courierCode) => {
    setSelectedCourier(courierCode);
    setSelectedShipping(null);
    setShippingOptions([]);
    setShippingError('');
  }, []);

  const searchDestinations = useCallback(async () => {
    const search = destinationSearch.trim();
    if (search.length < 3) {
      toast.error(t('bsp.minThreeShort'));
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
        setShippingError(t('bsp.noRatesShort'));
      }
    } catch (error) {
      setShippingError(t(getFriendlyShippingErrorKey(error, 'bsp.rateFailed')));
    } finally {
      setShippingLoading(false);
    }
  }, [estimatedTotal, selectedCourier, shippingWeight, t]);

  const autoCalculateShipping = useCallback(async ({
    courierCode = selectedCourier,
    searchText = '',
    autoSelectBest = false,
  } = {}) => {
    const search = String(searchText || destinationSearch || form.deliveryAddress || '').trim();
    if (search.length < 3) {
      toast.error(t('bsp.areaFirstShort'));
      return;
    }
    if (!courierCode) {
      toast.error(t('bsp.courierFirstShort'));
      return;
    }

    setShippingLoading(true);
    setShippingError('');
    setDestinationOptions([]);
    setSelectedShipping(null);
    setShippingOptions([]);

    try {
      if (selectedDestination?.id && String(selectedDestination.label || '').trim() === search) {
        const rates = await getShippingRates({
          destinationId: selectedDestination.id,
          destination: selectedDestination,
          destinationLabel: selectedDestination.label,
          subtotal: estimatedTotal,
          weight: shippingWeight,
          couriers: [courierCode],
        });
        const sortedRates = [...rates].sort((first, second) => Number(first.cost || 0) - Number(second.cost || 0));
        setShippingOptions(sortedRates);
        if (autoSelectBest && sortedRates.length) {
          setSelectedShipping(sortedRates[0]);
        }
        if (!sortedRates.length) {
          setShippingError(t('bsp.areaNoRate'));
        }
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
  }, [destinationSearch, estimatedTotal, form.deliveryAddress, loadShippingRates, selectedCourier, selectedDestination, shippingWeight, t]);

  const handleCourierChange = useCallback((courierCode) => {
    chooseShippingCourier(courierCode);
    if (!courierCode) return;
    const searchText = destinationSearch.trim() || form.deliveryAddress.trim();
    if (searchText.length >= 3) {
      autoCalculateShipping({ courierCode, searchText, autoSelectBest: true });
    }
  }, [autoCalculateShipping, chooseShippingCourier, destinationSearch, form.deliveryAddress]);

  const flowSteps = useMemo(() => [
    {
      key: 'aroma',
      title: t('bsp.stepScent'),
      shortLabel: t('bsp.scent'),
      description: t('bsp.stepScentBody'),
      render: () => (
        <div className="grid gap-3">
          <input
            value={form.perfumeName}
            onChange={(event) => updateField('perfumeName', event.target.value)}
            placeholder={t('bsp.namePlaceholderMobile')} aria-label={t('bsp.perfumeName')}
            className="mobile-commerce-control h-12 px-3 text-sm font-semibold text-editorial-charcoal"
          />
          <textarea
            value={form.scentDescription}
            onChange={(event) => updateField('scentDescription', event.target.value)}
            placeholder={t('bsp.scentPlaceholderMobile')} aria-label={t('bsp.scentDirection')}
            rows={3}
            className="mobile-commerce-control min-h-[96px] w-full resize-none px-3 py-3 text-sm font-semibold leading-relaxed text-editorial-charcoal"
          />
          <div className="grid grid-cols-4 gap-1.5">
            {[t('bsp.clean'), 'Woody', t('bsp.vanilla'), t('bsp.freshId')].map((item) => (
              <button
                key={item}
                type="button"
                className="mobile-commerce-choice px-2 py-2 text-center text-[10px] font-bold text-editorial-charcoal"
                onClick={() => updateField('scentDescription', `${form.scentDescription}${form.scentDescription.trim() ? ', ' : ''}${item}`)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 mobile-segment-scroll">
            {bespokeOccasionOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateField('occasion', option.value)}
                className={cn(
                  'h-9 shrink-0 rounded-full border px-3 text-[11px] font-bold transition',
                  form.occasion === option.value ? 'border-editorial-stone/30 bg-editorial-ivory text-editorial-charcoal' : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                )}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
      ),
      isComplete: () => form.perfumeName.trim().length > 1 && form.scentDescription.trim().length > 3 && Boolean(form.occasion),
    },
    {
      key: 'package',
      title: t('bsp.stepSize'),
      shortLabel: t('bsp.preferences'),
      description: t('bsp.stepSizeBody'),
      render: () => (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            {bottleSizeOptions.map((option) => (
              <OptionButton key={option.value} active={form.size === option.value} imageUrl={option.imageUrl} onClick={() => updateField('size', option.value)}>{option.label}</OptionButton>
            ))}
          </div>
          {exoticMaterialOptions.length ? (
            <div className="grid gap-2">
              <div className="text-[10px] font-bold uppercase text-editorial-charcoal">{t('bsp.exoticMaterial')}</div>
              <div className="grid grid-cols-2 gap-2">
                <OptionButton active={!form.exoticMaterial} onClick={() => updateField('exoticMaterial', '')}>{t('bsp.noExtra')}</OptionButton>
                {exoticMaterialOptions.map((option) => (
                  <OptionButton key={option.value} active={form.exoticMaterial === option.value} imageUrl={option.imageUrl} onClick={() => updateField('exoticMaterial', option.value)}>
                    {option.label}
                  </OptionButton>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ),
      isComplete: () => Boolean(form.size),
    },
    {
      key: 'bottle',
      title: t('bsp.stepLook'),
      shortLabel: t('bsp.bottle'),
      description: t('bsp.stepLookBody'),
      render: () => (
        <div className="grid gap-3">
          <div className="grid grid-cols-[108px_minmax(0,1fr)] gap-3">
            <CapMockup bottle={selectedBottleType} cap={selectedCap} label={selectedLabel} />
            <div className="grid content-start gap-2 text-xs font-bold text-editorial-charcoal">
              <div className="rounded-2xl bg-editorial-ivory px-3 py-2">{selectedBottleType?.label || t('bsp.bottle')}</div>
              <div className="rounded-2xl bg-white px-3 py-2">{selectedCap?.label || t('bsp.cap')}</div>
              <div className="rounded-2xl bg-white px-3 py-2">{selectedLabel?.label || t('bsp.label')}</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-editorial-charcoal">{t('bsp.bottle')}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {bottleTypeOptions.map((option) => (
                <OptionButton key={option.value} active={form.bottleType === option.value} imageUrl={option.imageUrl} onClick={() => updateField('bottleType', option.value)}>{option.label}</OptionButton>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-editorial-charcoal">{t('bsp.cap')}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {capDesignOptions.map((option) => (
                <OptionButton key={option.value} active={form.capDesign === option.value} imageUrl={option.imageUrl} onClick={() => updateField('capDesign', option.value)}>{option.label}</OptionButton>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-editorial-charcoal">{t('bsp.label')}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {labelDesignOptions.map((option) => (
                <OptionButton key={option.value} active={form.labelDesign === option.value} imageUrl={option.imageUrl} onClick={() => updateField('labelDesign', option.value)}>{option.label}</OptionButton>
              ))}
            </div>
          </div>
        </div>
      ),
      isComplete: () => Boolean(form.bottleType && form.capDesign && form.labelDesign),
    },
    {
      key: 'delivery',
      title: t('bsp.stepContact'),
      shortLabel: t('bsp.shipping'),
      description: t('bsp.stepContactBody'),
      render: () => (
        <div className="grid gap-3">
          {/* Same domestic-only courier API as the product checkout, so the same warning belongs here. */}
          <InternationalCheckoutNotice />
          <div className="grid gap-2">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <input value={form.customerCode} onChange={(event) => updateField('customerCode', event.target.value.toUpperCase())} placeholder={t('bsp.customerCodeField')} aria-label={t('bsp.customerCodeField')} className="mobile-commerce-control h-12 px-3 text-sm font-semibold uppercase" />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-3 text-xs font-bold" onClick={pasteCustomerCode}>{t('bsp.paste')}</Button>
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={lookupCustomer}>{t('bsp.check')}</Button>
            </div>
            <input value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} placeholder={t('bsp.buyerName')} aria-label={t('bsp.buyerName')} className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
            <input value={form.contact} onChange={(event) => updateField('contact', event.target.value)} placeholder={t('bsp.phone')} aria-label={t('bsp.phoneAria')} inputMode="tel" autoComplete="tel" className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
            <textarea autoComplete="street-address" value={form.deliveryAddress} onChange={(event) => updateField('deliveryAddress', event.target.value)} placeholder={t('bsp.addressPlaceholder')} aria-label={t('bsp.address')} rows={2} className="mobile-commerce-control px-3 py-3 text-sm font-semibold" />
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={destinationSearch} onChange={(event) => updateDestinationSearch(event.target.value)} placeholder={t('bsp.areaPlaceholder')} aria-label={t('bsp.areaAria')} className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-3 text-xs font-bold" onClick={searchDestinations} disabled={shippingLoading || destinationSearch.trim().length < 3}>{t('bsp.search')}</Button>
            </div>
            <label className={`mobile-commerce-courier-select ${selectedCourier ? 'is-selected' : ''}`}>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase">
                  {selectedCourier ? t('bsp.courierChosen') : t('bsp.courierDropdown')}
                </span>
                <span className="mt-0.5 block truncate text-sm font-bold">
                  {selectedCourier ? (courierLabels[selectedCourier] || selectedCourier.toUpperCase()) : t('bsp.pickShippingCourier')}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
              <select value={selectedCourier} onChange={(event) => handleCourierChange(event.target.value)} aria-label={t('bsp.pickShippingCourier')}>
                <option value="">{t('bsp.pickCourier')}</option>
                {checkoutCourierOptions.map((courier) => (
                  <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                ))}
              </select>
            </label>
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={autoCalculateShipping} disabled={shippingLoading || destinationSearch.trim().length < 3 || !selectedCourier}>
              {shippingLoading ? t('bsp.calculating') : selectedDestination ? t('bsp.showRates') : t('bsp.findRates')}
            </Button>
          </div>
          {selectedDestination ? <p className="rounded-2xl bg-editorial-ivory px-3 py-2 text-[11px] font-bold text-editorial-charcoal">Area: {selectedDestination.label}</p> : null}
          {destinationOptions.length && !selectedDestination ? (
            <div className="grid gap-2">
              {destinationOptions.map((destination) => (
                <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)} className="mobile-commerce-choice px-3 py-2 text-xs font-bold text-editorial-charcoal">{destination.label}</button>
              ))}
            </div>
          ) : null}
          {visibleShippingOptions.length ? (
            <div className="grid gap-2">
              {visibleShippingOptions.map((rate) => {
                const active = selectedShipping?.courierCode === rate.courierCode && selectedShipping?.service === rate.service;
                return (
                  <button key={`${rate.courierCode}-${rate.service}-${rate.cost}`} type="button" onClick={() => setSelectedShipping(rate)} className={cn('mobile-commerce-choice px-3 py-3', active ? 'is-active' : '')}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[#1f2937]">{courierLabels[rate.courierCode] || rate.courierName} {rate.serviceLabel || rate.service}</span>
                      <span className="shrink-0 text-right text-sm font-bold text-editorial-charcoal">
                        {rate.promotionApplied && Number(rate.originalCost || 0) > Number(rate.cost || 0) ? (
                          <span className="block text-[10px] text-[#8a9280] line-through">{formatRupiah(rate.originalCost)}</span>
                        ) : null}
                        {formatRupiah(rate.cost)}
                      </span>
                    </div>
                    {rate.promotionApplied ? <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-700">{rate.promotionLabel}</div> : null}
                    <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">{rate.etd ? `ETA ${rate.etd}` : rate.description || t('bsp.estimateFollows')}</p>
                  </button>
                );
              })}
            </div>
          ) : null}
          {shippingError ? <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">{shippingError}</p> : null}
        </div>
      ),
      isComplete: () => Boolean(form.customerName.trim() && form.contact.trim() && form.deliveryAddress.trim() && selectedDestination && selectedCourier && selectedShipping),
    },
    {
      key: 'payment',
      title: t('bsp.stepReview'),
      shortLabel: t('bsp.pay'),
      description: t('bsp.stepReviewBody'),
      render: () => (
        <div className="grid gap-3">
          <div className="mobile-commerce-summary p-4 text-xs font-bold text-editorial-charcoal">
            <div className="flex justify-between gap-3"><span>{t('bsp.perfumeName')}</span><span>{form.perfumeName || '-'}</span></div>
            <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>{t('bsp.bespokePerfume')}</span><span>{t('bsp.studioConfirmed')}</span></div>
            <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>{t('bsp.voucher')}</span><span>{voucher.appliedVoucher ? t('bsp.voucherApplied', { code: voucher.appliedVoucher.code }) : '-'}</span></div>
            <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>{t('bsp.shipping')}</span><span>{shippingFee ? formatRupiah(shippingFee) : '-'}</span></div>
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-editorial-stone/10 pt-3 text-sm text-editorial-charcoal">
              <span>{t('bsp.transferTotal')}</span>
              <span className="text-base text-editorial-charcoal">{formatRupiah(totalDue)}</span>
            </div>
            {discountAmount ? (
              <div className="mt-1 flex justify-between gap-3 text-[11px] text-emerald-700">
                <span>Voucher</span>
                <span>-{formatRupiah(discountAmount)}</span>
              </div>
            ) : null}
            <p className="mt-3 text-[11px] font-semibold leading-relaxed text-[#6b7280]">{budgetSummary}</p>
          </div>
          <div className="mobile-commerce-panel p-3">
            <div className="flex items-center gap-2 text-xs font-bold text-editorial-charcoal">
              <Ticket className="h-3.5 w-3.5 text-editorial-charcoal" />
              Voucher
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <input
                value={voucher.inputCode}
                onChange={(event) => voucher.setInputCode(event.target.value.toUpperCase())}
                placeholder={t('bsp.voucherPlaceholder')} aria-label={t('bsp.voucherPlaceholder')}
                className="mobile-commerce-control h-11 min-w-0 px-3 text-xs font-bold uppercase text-editorial-charcoal"
              />
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white px-3 text-[11px] font-bold" onClick={voucher.applyVoucher} disabled={voucher.loading}>
                {voucher.loading ? t('bsp.checking') : t('bsp.apply')}
              </Button>
            </div>
            {voucher.appliedVoucher ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-editorial-stone/15 bg-editorial-ivory px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-editorial-charcoal">{voucher.appliedVoucher.code} diterapkan</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-editorial-muted">{t('bsp.voucherAdjusted')}</div>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-editorial-charcoal tap-44" onClick={voucher.removeVoucher} aria-label={t('bsp.voucherRemove')}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : voucher.message ? (
              <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">{voucher.message}</p>
            ) : null}
          </div>
          {checkoutPaymentMethods.map((method) => {
            const active = form.paymentMethod === method.id;
            return (
              <button key={method.id} type="button" onClick={() => updateField('paymentMethod', method.id)} className={cn('mobile-commerce-choice px-4 py-4', active ? 'is-active' : 'text-[#6b7280]')}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-editorial-charcoal">{method.label}</span>
                  {active ? <span className="rounded-full bg-editorial-charcoal px-2 py-1 text-[9px] font-bold uppercase text-white">{t('bsp.chosen')}</span> : null}
                </div>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed">{method.description}</p>
                {method.accountNumber ? <div className="mobile-commerce-panel mt-3 border-0 bg-white/80 px-3 py-2 text-[11px] font-bold text-editorial-charcoal">{method.bankName} {method.accountNumber} / A/N {method.accountName}</div> : null}
              </button>
            );
          })}
          <label className={cn('mobile-commerce-choice flex items-start gap-3 px-4 py-4', form.preorderAcknowledged ? 'is-active' : 'text-[#6b7280]')}>
            <input
              type="checkbox"
              checked={Boolean(form.preorderAcknowledged)}
              onChange={(event) => updateField('preorderAcknowledged', event.target.checked)}
              className="sr-only"
            />
            <span
              className={cn(
                'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-white transition',
                form.preorderAcknowledged ? 'border-editorial-stone bg-editorial-charcoal' : 'border-editorial-stone/24 bg-white'
              )}
              aria-hidden="true"
            >
              {form.preorderAcknowledged ? <Check className="h-4 w-4" /> : null}
            </span>
            <span>
              <span className="block text-sm font-bold text-editorial-charcoal">{t('bsp.preorderTitle')}</span>
              <span className="mt-1 block text-[11px] font-semibold leading-relaxed">
                {t('bsp.preorderConfirmMobile')}
              </span>
            </span>
          </label>
        </div>
      ),
      isComplete: () => Boolean(form.paymentMethod && form.preorderAcknowledged),
    },
  ], [autoCalculateShipping, bottleSizeOptions, bottleTypeOptions, budgetSummary, capDesignOptions, destinationOptions, destinationSearch, discountAmount, exoticMaterialOptions, form, handleCourierChange, labelDesignOptions, loadShippingRates, lookupCustomer, pasteCustomerCode, searchDestinations, selectedBottleType, selectedCap, selectedCourier, selectedDestination, selectedLabel, selectedShipping, shippingError, shippingFee, shippingLoading, totalDue, updateDestinationSearch, updateField, visibleShippingOptions, voucher, t]);

  const activeStep = flowSteps[step];
  const completion = Math.round(((step + Number(activeStep.isComplete())) / flowSteps.length) * 100);

  const nextStep = () => {
    if (!activeStep.isComplete()) {
      toast.error(t('bsp.completeStep'));
      return;
    }
    setStep((current) => Math.min(current + 1, flowSteps.length - 1));
  };

  const submitRequest = async () => {
    const incompleteStep = flowSteps.find((item) => !item.isComplete());
    if (incompleteStep) {
      toast.error(t('bsp.completeFirst', { step: incompleteStep.title }));
      setStep(flowSteps.indexOf(incompleteStep));
      return;
    }
    if (estimatedTotal <= 0) {
      toast.error(t('bsp.errPrice'));
      return;
    }

    setSaving(true);
    let createdOrder = null;
    try {
      const voucherValidation = voucher.appliedCode
        ? await applyVoucherToSubtotalAsync({ code: voucher.appliedCode, subtotal: estimatedTotal, items: bespokeVoucherItems })
        : null;
      if (voucher.appliedCode && !voucherValidation?.valid) {
        throw new Error(voucherValidation?.message || t('bsp.errVoucherShort'));
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
        optionIds: {
          size: selectedSize?.id || '',
          bottleType: selectedBottleType?.id || '',
          capDesign: selectedCap?.id || '',
          labelDesign: selectedLabel?.id || '',
          exoticMaterial: selectedExoticMaterial?.id || '',
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
      // Charge the order's authoritative subtotal (equals checkoutTotalDue on the direct-insert path;
      // the server recompute on the endpoint path), so display and charge always match what was stored.
      const paymentAmount = Number(order.subtotal) || checkoutTotalDue;
      if (isManualPayment) {
        const manualPaymentResponse = {
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
          manualTransfer: manualPaymentResponse,
          shippingSummary,
          shippingFee,
          voucherCode: voucherSnapshot?.code || '',
          voucherDiscount: checkoutVoucherDiscount,
          voucherSnapshot,
          createdAt: new Date().toISOString(),
        }));

        setSubmittedRequest({
          ...form,
          orderNumber: order.orderNumber,
          customerCode: order.customerCode || form.customerCode,
          budget: formatRupiah(estimatedTotal),
          shipping: shippingSummary,
          shippingFee,
          totalDue: formatRupiah(paymentAmount),
          voucherCode: voucherSnapshot?.code || '',
          reference: referenceProduct?.name || '',
          createdAt: new Date().toISOString(),
        });
        toast.success(t('bsp.saved', { order: order.orderNumber }));
        clearBespokeDraft();
        (voucherSnapshot?.code ? voucher.removeVoucher : clearAppliedVoucherCode)();
        navigate(`/mobile/payment?order=${encodeURIComponent(order.orderNumber)}&payment=manual`);
        return;
      }

      const checkout = await createDokuCheckout({
        order,
        amount: paymentAmount,
        customerName: form.customerName,
        contact: form.contact,
        items: order.items || [],
        callbackPath: '/mobile/payment',
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

      setSubmittedRequest({
        ...form,
        orderNumber: order.orderNumber,
        customerCode: order.customerCode || form.customerCode,
        budget: formatRupiah(estimatedTotal),
        shipping: shippingSummary,
        shippingFee,
        totalDue: formatRupiah(paymentAmount),
        voucherCode: voucherSnapshot?.code || '',
        reference: referenceProduct?.name || '',
        createdAt: new Date().toISOString(),
      });
      toast.success(t('bsp.saved', { order: order.orderNumber }));
      clearBespokeDraft();
      (voucherSnapshot?.code ? voucher.removeVoucher : clearAppliedVoucherCode)();
      navigate(`/mobile/payment?order=${encodeURIComponent(order.orderNumber)}&payment=doku`);
    } catch (error) {
      if (createdOrder) {
        try {
          await updateOrderStatus(createdOrder.id || createdOrder.orderNumber, 'cancelled');
        } catch (restoreError) {
          console.warn('Failed to cancel bespoke order after payment session error:', restoreError.message || restoreError);
        }
      }
      toast.error(publicErrorMessage(error, 'Failed to save bespoke request'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileCommerceLayout>
      <Helmet>
        <title>{t('bsp.tabMobile')}</title>
        <link rel="canonical" href={toAbsoluteUrl(desktopCanonicalPath('/mobile/bespoke'))} />
        <meta name="description" content={t('bsp.metaMobile')} />
      </Helmet>
      <main className="mobile-page mobile-bespoke-page">
        <section className="mobile-soft-card p-2.5">
          <div className="mobile-commerce-chip gap-2 bg-white px-3 py-1 text-[10px] uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            {t('bsp.brief')}
          </div>
          <h1 className="mt-1.5 text-lg font-bold leading-tight text-editorial-charcoal">{t('bsp.requestPerfume')}</h1>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
            {t('bsp.flowLead')}
          </p>
          <div className="mt-2 inline-flex rounded-full bg-editorial-charcoal px-2.5 py-1 text-[10px] font-bold uppercase text-white">
            {t('bsp.preorderDays')}
          </div>
          {referenceProduct ? (
            <div className="mobile-commerce-panel mt-3 border-0 p-3 text-xs font-bold text-editorial-charcoal">
              {t('bsp.scentReference')} <span className="text-editorial-charcoal">{referenceProduct.name}</span>
            </div>
          ) : null}
        </section>

        <section className="mobile-bespoke-wizard mobile-card overflow-hidden">
          <header className="border-b border-editorial-stone/10 bg-white px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-editorial-charcoal">{t('bsp.stepOf', { current: step + 1, total: flowSteps.length })}</p>
                <h2 className="mt-1 text-base font-bold text-editorial-charcoal">{activeStep.title}</h2>
                <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-[#6b7280]">{activeStep.description}</p>
              </div>
              <span className="mobile-commerce-chip shrink-0 px-2.5 py-1 text-[10px]">{completion}%</span>
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 mobile-segment-scroll">
              {flowSteps.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setStep(index)}
                  className={cn(
                    'h-7 shrink-0 rounded-full px-2.5 text-[10px] font-bold transition',
                    index === step ? 'bg-editorial-charcoal text-white' : item.isComplete() ? 'bg-editorial-ivory text-editorial-charcoal' : 'bg-[#f8f7f4] text-[#6b7280]'
                  )}
                >
                  {item.shortLabel}
                </button>
              ))}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-editorial-ivory">
              <div className="h-full rounded-full bg-editorial-charcoal" style={{ width: `${((step + 1) / flowSteps.length) * 100}%` }} />
            </div>
          </header>

          <div className="mobile-bespoke-wizard-body p-3 pt-2.5">
            {activeStep.render()}
          </div>

        </section>

        {step > 0 ? (
          <section className="mobile-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-editorial-charcoal">{t('bsp.briefShort')}</h2>
                <p className="mt-1 text-xs font-bold leading-relaxed text-editorial-charcoal">{form.perfumeName || t('bsp.errPerfumeName')}</p>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-[#6b7280]">{form.scentDescription || t('bsp.errScentEmpty')}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">{t('bsp.preorder')}</div>
                <div className="text-sm font-bold text-editorial-charcoal">{t('bsp.days')}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-[#6b7280]">
              <div className="mobile-commerce-panel border-0 bg-[#f8f7f4] px-3 py-2">{form.size || '-'} / {selectedCap?.label || '-'}</div>
              <div className="mobile-commerce-panel border-0 bg-[#f8f7f4] px-3 py-2">{shippingSummary || t('bsp.errShipping')}</div>
            </div>
          </section>
        ) : null}

        {submittedRequest ? (
          <section className="mobile-card p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-editorial-charcoal">{t('bsp.requestSummary')}</h2>
                <div className="mt-3 space-y-2 text-xs font-semibold text-[#6b7280]">
                  <p><strong className="text-editorial-charcoal">{t('bsp.buyer')}</strong> {submittedRequest.customerName}</p>
                  <p><strong className="text-editorial-charcoal">{t('bsp.customerCode')}</strong> {submittedRequest.customerCode || '-'}</p>
                  <p><strong className="text-editorial-charcoal">{t('bsp.studioOrder')}</strong> {submittedRequest.orderNumber}</p>
                  <p><strong className="text-editorial-charcoal">{t('bsp.contactLabel')}</strong> {submittedRequest.contact}</p>
                  <p><strong className="text-editorial-charcoal">{t('bsp.perfumeNameLabel')}</strong> {submittedRequest.perfumeName || '-'}</p>
                  <p><strong className="text-editorial-charcoal">{t('bsp.scentLabel')}</strong> {submittedRequest.scentDescription}</p>
                  <p><strong className="text-editorial-charcoal">{t('bsp.bottleLabel')}</strong> {submittedRequest.size}, {submittedRequest.bottleType}, {submittedRequest.capDesign}, {submittedRequest.labelDesign}</p>
                  {submittedRequest.exoticMaterial ? <p><strong className="text-editorial-charcoal">{t('bsp.materialLabel')}</strong> {submittedRequest.exoticMaterial}</p> : null}
                  <p><strong className="text-editorial-charcoal">{t('bsp.budgetLabel')}</strong> {submittedRequest.budget}</p>
                  <p><strong className="text-editorial-charcoal">{t('bsp.shippingLabel')}</strong> {submittedRequest.shipping || '-'}</p>
                  <p><strong className="text-editorial-charcoal">{t('bsp.preorderLabel')}</strong> {t('bsp.daysAfterBrief')}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => navigate('/mobile/catalog')}>
                    <ClipboardList className="h-4 w-4" />
                    {t('bsp.catalog')}
                  </Button>
                  <Button
                    type="button"
                    className="rounded-2xl gap-2"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${submittedRequest.customerName} / ${submittedRequest.contact}\n${submittedRequest.scentDescription}`);
                      toast.success(t('bsp.contactCopied'));
                    }}
                  >
                    {t('bsp.copyContact')}
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <StickyBottomActionBar
          fixed
          reserveSpace
          aria-label={t('bsp.actions')}
          className="mobile-bespoke-action-bar"
          contentClassName="rounded-2xl border-editorial-stone/10 bg-white/95"
        >
          {step === flowSteps.length - 1 ? (
            <div className="grid gap-2">
              <div className="rounded-2xl border border-editorial-stone/10 bg-editorial-ivory px-3 py-2">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-[#6b7280]">{t('bsp.transferTotal')}</p>
                    <p className="text-lg font-bold leading-tight text-editorial-charcoal">{formatRupiah(totalDue)}</p>
                  </div>
                  <p className="shrink-0 text-[10px] font-bold uppercase text-editorial-charcoal">{t('bsp.readyToPay')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="rounded-2xl bg-white" disabled={saving} onClick={() => setStep((current) => Math.max(current - 1, 0))}>
                  {t('bsp.back')}
                </Button>
                <Button type="button" className="rounded-2xl gap-2" onClick={submitRequest} disabled={saving}>
                  {saving ? t('bsp.processing') : (isManualPayment ? t('bsp.orderUploadMobile') : t('bsp.payNow'))}
                  {isManualPayment ? <CheckCircle2 className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="rounded-2xl bg-white" disabled={step === 0} onClick={() => setStep((current) => Math.max(current - 1, 0))}>
                {t('bsp.back')}
              </Button>
              <Button type="button" className="rounded-2xl" onClick={nextStep}>{t('bsp.next')}</Button>
            </div>
          )}
        </StickyBottomActionBar>

      </main>
    </MobileCommerceLayout>
  );
};

export default MobileBespokePage;
