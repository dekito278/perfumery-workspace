import InternationalCheckoutNotice from '@/components/storefront/InternationalCheckoutNotice.jsx';
import { useTranslate } from '@/hooks/useTranslate.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BadgePercent, CheckCircle2, CreditCard, Globe, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { lookupCustomerByCode } from '@/services/customerService.js';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import ScrollProgress from '@/components/storefront/ScrollProgress.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import { bespokeOccasionOptions } from '@/data/storefront.js';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';
import { useBespokeSettings } from '@/hooks/useBespokeSettings.js';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCatalogProduct } from '@/hooks/useCatalogProducts.js';
import { buildWhatsAppCheckoutUrl, checkoutPaymentMethods, getCheckoutPaymentMethod, getStorefrontWhatsAppNumber, isManualTransferPayment } from '@/services/cartService.js';
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
import { bespokeStepKeys, bespokeTakesPayment, bespokeOccasionLabel, buildBespokeEnquiryDraft, cheapestEnabled, bespokeFloorPrice, optionExtraPrice } from '@/utils/bespokeOrder.js';
import { getOptimizedStorageImageUrl as img, getStorageImageSrcSet as srcSet } from '@/utils/storageImage.js';
import { publicErrorMessage } from '@/utils/publicErrorMessage.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';

// Keys: module-level, so no hook can run here. The component translates them.
// Step 3 was 'bsp.bottle' — "Botol" — back when it held the bottle, cap and label choices. Dekito
// removed all three on 2026-10-23 and confirmed it is permanent, so the step holds the size and
// nothing else. The chip outside now says what the panel inside says.
const stepKeys = ['bsp.scent', 'bsp.preferences', 'bsp.size', 'bsp.addressShort', 'bsp.pay'];
// The steps are numbered as the canvas sets them; a numeral has nothing in it to translate.
const ROMAN_STEPS = ['I', 'II', 'III', 'IV', 'V'];


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

const BespokeOptionCard = ({ active, children, description = '', extra = '', imageUrl = '', label, onClick }) => (
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
      {/* What this choice adds over the cheapest in its group — the floor line already holds the base. */}
      {extra ? <span className="editorial-bespoke-option__extra">{extra}</span> : null}
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
          /* Same gap as the home page's mood panel: one fixed 720px for every screen. Smaller here —
             9 kB on a phone, measured — but the rule is the same one, and the next image added to this
             preview will be a photograph rather than a flat mockup. */
          <img className="editorial-bespoke-preview__backdrop" src={img(visualImage, 720)} srcSet={srcSet(visualImage)} sizes="(max-width: 767px) 100vw, 520px" alt={activeLabel} loading="lazy" decoding="async" />
        ) : null}
        <div className="editorial-bespoke-preview__mockup" aria-hidden="true">
          <span className={`editorial-bespoke-preview__bottle${isSquare ? ' is-square' : ''}${isLarge ? ' is-large' : ''}${isSmall ? ' is-small' : ''}`} />
          <span className={`editorial-bespoke-preview__cap${isStone ? ' is-stone' : ''}${isAcrylic ? ' is-acrylic' : ''}`} />
          {/* The sticker printed the word "Label" when nothing was chosen. Since the label options were
              switched off there is nothing to choose, so it printed it permanently. */}
          {label?.label ? <span className="editorial-bespoke-preview__label">{label.label}</span> : null}
        </div>
        <div className="editorial-bespoke-preview__focus">
          <span>{t('bsp.previewFocus')}</span>
          <strong>{activeLabel}</strong>
        </div>
      </div>
      {/* One span per part the buyer actually has. These used to be four fixed spans falling back to the
          generic word, so with the bottle, cap and label options switched off the strip read
          "Botol · Cap · Label" for ever — three categories named and none of them offered. `material`
          was already written this way; the other three now match it. */}
      <div className="editorial-bespoke-preview__meta">
        {size?.label ? <span className={activeGroup === 'size' ? 'is-active' : ''}>{size.label}</span> : null}
        {bottle?.label ? <span className={activeGroup === 'bottle' ? 'is-active' : ''}>{bottle.label}</span> : null}
        {cap?.label ? <span className={activeGroup === 'cap' ? 'is-active' : ''}>{cap.label}</span> : null}
        {label?.label ? <span className={activeGroup === 'label' ? 'is-active' : ''}>{label.label}</span> : null}
        {material?.label ? <span className={activeGroup === 'material' ? 'is-active' : ''}>{material.label}</span> : null}
      </div>
    </div>
  );
};

const BespokePage = () => {
  const { t, isInternational } = useTranslate();
  const revealRef = useScrollReveal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referenceProduct = useCatalogProduct(searchParams.get('reference'));
  const settings = useBespokeSettings({ forShop: true });
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
  const floorPrice = useMemo(() => bespokeFloorPrice(settings), [settings]);
  // Same gate as the floor: domestic prices only, and the English bespoke path quotes nothing.
  const optionPriceLabel = useCallback((option, group) => {
    if (isInternational) return '';
    const extra = optionExtraPrice(option, group);
    return extra ? t('bsp.optionExtra', { price: formatRupiah(extra) }) : '';
  }, [isInternational, t]);
  const defaultSize = cheapestEnabled(bottleSizeOptions);
  const defaultBottle = cheapestEnabled(bottleTypeOptions);
  const defaultCap = cheapestEnabled(capDesignOptions);
  const defaultLabel = cheapestEnabled(labelDesignOptions);
  const [saving, setSaving] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
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
    // Back, and wired this time. It was initialised and read here with no writer at all (#380), which is
    // why it was deleted: the fallback `order.customerCode || form.customerCode` could only ever resolve
    // to '', while reading as if it preserved a code the buyer had typed. The phone has had the field and
    // the lookup since the bespoke flow shipped; desktop had neither, so a returning customer ordering
    // from a laptop was filed under a freshly generated code and their history split in two.
    customerCode: '',
    customerName: '',
    contact: '',
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
  // A group with nothing in it is not a tab. Dekito switched the bottle, cap and label options off on
  // 2026-10-23 — the 30 ml price now covers them — and without this filter the page would still have
  // shown three tabs that open onto an empty panel.
  const bespokeChoiceGroups = useMemo(() => [
    {
      key: 'size',
      tabLabel: t('bsp.size'),
      eyebrow: t('bsp.size'),
      title: t('bsp.pickSize'),
      field: 'size',
      selected: selectedSize,
      options: bottleSizeOptions,
    },
    {
      key: 'bottle',
      tabLabel: t('bsp.bottle'),
      eyebrow: t('bsp.bottle'),
      title: t('bsp.bottleType'),
      field: 'bottleType',
      selected: selectedBottle,
      options: bottleTypeOptions,
    },
    {
      key: 'cap',
      tabLabel: t('bsp.cap'),
      eyebrow: t('bsp.cap'),
      title: t('bsp.capDesign'),
      field: 'capDesign',
      selected: selectedCap,
      options: capDesignOptions,
    },
    {
      key: 'label',
      tabLabel: t('bsp.label'),
      eyebrow: t('bsp.label'),
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
      // Only a tab when there is something to add. [noneMaterialOption] alone is a tab whose single
      // option is "no thanks" — it survived the empty-group filter below and offered nothing.
      options: exoticMaterialOptions.length ? [noneMaterialOption, ...exoticMaterialOptions] : [],
    },
  ].filter((group) => group.options.length > 0), [bottleSizeOptions, bottleTypeOptions, capDesignOptions, exoticMaterialOptions, labelDesignOptions, noneMaterialOption, selectedBottle, selectedCap, selectedLabel, selectedMaterial, selectedSize, t]);
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

  // Mirrors MobileBespokePage.lookupCustomer, including the three answers it tells apart: a code that was
  // not given, a code the server looked for and did not find, and a lookup that could not run at all.
  // lookupCustomerByCode rethrows on failure now (#367), so "belum bisa dicek" is a real branch rather
  // than a null that reads as "does not exist".
  const lookupCustomer = useCallback(async () => {
    if (!form.customerCode.trim()) {
      toast.error(t('bsp.codeRequired'));
      return;
    }

    setCodeLoading(true);
    let customer = null;
    try {
      customer = await lookupCustomerByCode(form.customerCode);
    } catch (error) {
      console.warn('Bespoke customer lookup failed:', error?.message || error);
      toast.error(t('bsp.codeLookupFailed'));
      return;
    } finally {
      setCodeLoading(false);
    }
    if (!customer) {
      toast.error(t('bsp.codeNotFound'));
      return;
    }

    setForm((current) => ({
      ...current,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      // The public lookup no longer returns contact/address (they were harvestable by code guessing — see
      // 20260819120000_customer_lookup_pii_lockdown.sql), so keep whatever the buyer already typed.
      contact: customer.contact && customer.contact !== '-' ? customer.contact : current.contact,
      deliveryAddress: customer.deliveryAddress || current.deliveryAddress,
    }));
    toast.success(t('bsp.codeLoaded', { code: customer.customerCode }));
  }, [form.customerCode, t]);

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
          // The order's own code wins; the typed one is the fallback for a buyer who gave a code before the
          // order row came back. Dead until this page got a field to type one into (#380 deleted the
          // unwritten state, this restored it with a writer).
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
        toast.success(t('bsp.saved', { order: order.orderNumber }));
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
      toast.success(t('bsp.saved', { order: order.orderNumber }));
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

        <header className="ng-section relative overflow-hidden !pb-16 !pt-20 md:!pt-28">
          <span className="ng-script-mark absolute bottom-[-40px] right-6 hidden text-[220px] lg:block" aria-hidden="true">ꦲꦪꦤ꧀ꦒ꧀​ꦲꦪꦤ꧀ꦒ꧀</span>
          <div className="ng-container relative flex flex-col gap-7">
            <p className="ng-eyebrow ng-mono m-0">{t('bsp.eyebrow')}</p>
            <h1 className="ng-display ng-h1 max-w-[980px]">{t('bsp.title')}</h1>
            <p className="ng-lead">{t('bsp.lead')}</p>
            {/* Same rule as the phone: a floor derived from Studio's own option prices, and never shown
                to the English shop, whose bespoke path takes no payment and has no international price. */}
            <p className="m-0 text-[15px] text-ng-dust">
              <strong className="font-medium text-ng-bone">{isInternational ? t('bsp.floor') : t('bsp.floor', { price: formatRupiah(floorPrice) })}</strong>
              {' '}
              <span>{t('bsp.floorNote')}</span>
            </p>
            <ol className="ng-mono m-0 mt-2 flex list-none flex-wrap gap-x-8 gap-y-3 p-0 text-ng-ash">
              {bespokeStepKeys(stepKeys, isInternational).map((stepKey, index) => (
                <li key={stepKey}><span className="mr-2 text-ng-ember">{ROMAN_STEPS[index] || index + 1}</span>{t(stepKey)}</li>
              ))}
            </ol>
          </div>
        </header>

        <section className="ng-section" data-reveal>
          <form className="ng-container flex flex-col gap-16" onSubmit={submitRequest}>
            <div className="flex flex-col gap-10">
              <div className="flex flex-col gap-3.5">
                <p className="ng-mono m-0 text-ng-ash">{t('bsp.designFirst')}</p>
                <h2 className="ng-display ng-h2">{t('bsp.designFirstTitle')}</h2>
                <p className="ng-lead">{t('bsp.designFirstBody')}</p>
              </div>
              <div className="grid gap-10 lg:grid-cols-3 lg:gap-8">
                <label className="ng-label">
                  <span className="ng-mono text-ng-dust">{t('bsp.perfumeName')}</span>
                  <input type="text" className="ng-field !font-ng-display !text-[26px]" value={form.perfumeName} onChange={(event) => updateField('perfumeName', event.target.value)} placeholder={t('bsp.namePlaceholder')} aria-label={t('bsp.perfumeName')} />
                  <small className="text-[13px] text-ng-ash">{t('bsp.perfumeNameHint')}</small>
                </label>
                <label className="ng-label">
                  <span className="ng-mono text-ng-dust">{t('bsp.scentDirection')}</span>
                  <textarea rows="4" className="ng-field" value={form.scentDescription} onChange={(event) => updateField('scentDescription', event.target.value)} placeholder={t('bsp.scentPlaceholder')} aria-label={t('bsp.scentDirection')} />
                  <div className="flex flex-wrap gap-2" aria-label={t('bsp.scentShortcuts')}>
                    {scentDirectionPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="ng-btn ng-btn--ghost !min-h-[44px] !px-3.5 !font-ng-body !text-sm !normal-case !tracking-normal"
                        onClick={() => updateField('scentDescription', form.scentDescription.trim() ? `${form.scentDescription.trim()}, ${prompt}` : prompt)}
                      >
                        + {prompt}
                      </button>
                    ))}
                  </div>
                </label>
                <fieldset className="ng-fieldset !gap-3">
                  <legend className="ng-mono mb-2 p-0 text-ng-dust">{t('bsp.moment')}</legend>
                  <div className="flex flex-wrap gap-2">
                    {bespokeOccasionOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={form.occasion === option.value}
                        className="ng-chip"
                        onClick={() => updateField('occasion', option.value)}
                      >
                        {t(option.labelKey)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
            <div className="flex flex-col gap-8 border-t border-ng-bone/15 pt-12" data-reveal>
              <div className="flex flex-col gap-3">
                <p className="ng-mono m-0 text-ng-ash">{t('bsp.visualEyebrow')}</p>
                <h3 className="ng-display m-0 text-[36px] md:text-[44px]">{t('bsp.visualBody')}</h3>
              </div>
              <div className="grid items-start gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <BespokeBottlePreview
                  activeGroup={activeChoice.key}
                  bottle={selectedBottle}
                  cap={selectedCap}
                  label={selectedLabel}
                  material={selectedMaterial}
                  size={selectedSize}
                />
                <div className="flex flex-col gap-6">
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
                  <div className="flex flex-col gap-5" role="tabpanel" aria-label={activeChoice.title}>
                    <div className="flex flex-col gap-2">
                      <p className="ng-mono m-0 text-ng-ember">{activeChoice.eyebrow}</p>
                      <h3 className="ng-display m-0 text-[30px]">{activeChoice.title}</h3>
                    </div>
                    <div className={`editorial-bespoke-option-grid${activeChoice.key === 'size' ? ' editorial-bespoke-option-grid--compact' : ''}`}>
                      {activeChoice.options.map((option) => (
                        <BespokeOptionCard
                          key={getOptionKey(option) || option.label}
                          active={isActiveChoiceOption(activeChoice, option)}
                          description={option.description}
                          imageUrl={option.imageUrl}
                          extra={optionPriceLabel(option, activeChoice.options)}
                          label={option.label}
                          onClick={() => selectChoiceOption(activeChoice, option)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="ng-panel grid items-end gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" data-reveal>
              <div className="flex flex-col gap-5">
                <p className="ng-mono m-0 text-ng-ash">{t('bsp.summaryEyebrow')}</p>
                <p className="m-0 font-ng-display text-[36px] italic leading-tight">{form.perfumeName || t('bsp.notFilled')}</p>
                <dl className="m-0 flex flex-col gap-3 border-t border-ng-bone/15 pt-4 text-[15px]">
                  <div className="flex justify-between gap-4"><dt className="text-ng-dust">{t('bsp.scent')}</dt><dd className="m-0 text-right">{form.scentDescription || t('bsp.notFilled')}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-ng-dust">{t('bsp.bottle')}</dt><dd className="m-0 text-right">{[selectedSize?.label, selectedBottle?.label, selectedCap?.label].filter(Boolean).join(' / ') || '-'}</dd></div>
                  <div className="flex items-baseline justify-between gap-4 border-t border-ng-bone/30 pt-3"><dt className="ng-mono text-ng-dust">{t('bsp.subtotal')}</dt><dd className="m-0 font-ng-display text-[32px]">{priceReady ? formatRupiah(estimatedTotal) : '—'}</dd></div>
                </dl>
              </div>
              {/* Where the two shops part. The Indonesian one opens its checkout; the English one hands
                  the brief to WhatsApp, because a bespoke bottle has no international price and its
                  shipping is quoted by hand. The old page showed this buyer a full checkout — Indonesian
                  couriers, a domestic voucher box, a rupiah total — directly under a notice saying
                  international orders are not placed through it. */}
              <div className="flex flex-col gap-4 text-[15px] text-ng-dust">
                {bespokeTakesPayment(isInternational) ? (
                  <>
                    <p className="m-0">{t('bsp.designOk')}</p>
                    <button type="button" className="ng-btn ng-btn--lg ng-btn--block" onClick={() => setCheckoutOpen(true)}>
                      {t('bsp.toCheckout')}
                      <CreditCard className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="m-0">{t('bsp.waOrderWhy')}</p>
                    <a
                      href={buildWhatsAppCheckoutUrl(buildBespokeEnquiryDraft({
                        t,
                        perfumeName: form.perfumeName,
                        scent: form.scentDescription || form.mood,
                        occasion: bespokeOccasionLabel(t, form.occasion, bespokeOccasionOptions),
                        bottle: [selectedSize?.label, selectedBottle?.label, selectedCap?.label].filter(Boolean).join(' / '),
                      }), getStorefrontWhatsAppNumber())}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ng-btn ng-btn--lg ng-btn--block"
                    >
                      {t('bsp.waOrder')}
                      <Globe className="h-4 w-4" />
                    </a>
                  </>
                )}
              </div>
            </div>

            {checkoutOpen && bespokeTakesPayment(isInternational) ? (
              <div className="flex flex-col gap-10 border-t border-ng-bone/15 pt-12" data-reveal>
                <div className="flex flex-col gap-3.5">
                  <p className="ng-mono m-0 text-ng-ash">{t('checkout.eyebrow')}</p>
                  <h2 className="ng-display ng-h2">{t('bsp.contactSection')}</h2>
                  <p className="ng-lead">{t('bsp.contactSectionBody')}</p>
                </div>
                {/* Bespoke ships through the same domestic courier API as the product checkout, so the
                    same dead end waits here: a foreign city returns an empty area list with no error. */}
                <InternationalCheckoutNotice quotedOnRequest className="mb-4" />
                <div className="grid gap-5 md:grid-cols-2">
                  {/* Optional, and above the name on purpose: filling it fills the two fields below. The
                      phone's version has a Paste button as well; on a laptop that is Ctrl+V. */}
                  <label className="ng-label md:col-span-2">
                    <span className="ng-mono text-ng-dust">{t('bsp.customerCode')}</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.customerCode}
                        onChange={(event) => updateField('customerCode', event.target.value.toUpperCase())}
                        placeholder={t('bsp.customerCodeField')}
                        aria-label={t('bsp.customerCodeField')}
                        className="ng-field uppercase placeholder:normal-case"
                      />
                      <button type="button" className="ng-btn ng-btn--ghost shrink-0" onClick={lookupCustomer} disabled={codeLoading}>
                        {codeLoading ? t('bsp.checking') : t('bsp.check')}
                      </button>
                    </div>
                  </label>
                  <label className="ng-label"><span className="ng-mono text-ng-dust">{t('bsp.name')}</span><input type="text" className="ng-field" autoComplete="name" value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} placeholder={t('bsp.yourName')} /></label>
                  <label className="ng-label"><span className="ng-mono text-ng-dust">{t('bsp.contact')}</span><input type="text" className="ng-field" value={form.contact} onChange={(event) => updateField('contact', event.target.value)} placeholder={t('bsp.contactPlaceholder')} /></label>
                  <label className="ng-label md:col-span-2"><span className="ng-mono text-ng-dust">{t('bsp.address')}</span><textarea rows="4" className="ng-field" autoComplete="street-address" value={form.deliveryAddress} onChange={(event) => updateField('deliveryAddress', event.target.value)} placeholder={t('bsp.addressPlaceholder')} /></label>
                </div>
                <div className="ng-fieldset">
                  <div className="flex flex-col gap-2">
                    <p className="ng-mono m-0 text-ng-ember">{t('bsp.shippingLegend')}</p>
                    <strong className="font-ng-display text-[30px] font-normal">{t('bsp.pickArea')}</strong>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="ng-field"
                      value={destinationSearch}
                      onChange={(event) => updateDestinationSearch(event.target.value)}
                      placeholder={t('bsp.areaPlaceholder')} aria-label={t('bsp.areaAria')}
                    />
                    <button type="button" className="ng-btn ng-btn--ghost shrink-0" onClick={searchDestinations} disabled={shippingLoading || destinationSearch.trim().length < 3}>
                      {shippingLoading ? t('bsp.searching') : t('bsp.search')}
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                  <label className="ng-label">
                    <span className="ng-mono text-ng-dust">{selectedCourier ? courierLabels[selectedCourier] : t('bsp.pickShippingCourier')}</span>
                    <select className="ng-field" value={selectedCourier} onChange={(event) => handleCourierChange(event.target.value)} aria-label={t('bsp.pickShippingCourier')}>
                      <option value="">{t('bsp.pickCourier')}</option>
                      {checkoutCourierOptions.map((courier) => (
                        <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="ng-btn ng-btn--ghost self-start" onClick={() => autoCalculateShipping()} disabled={shippingLoading || destinationSearch.trim().length < 3 || !selectedCourier}>
                    {shippingLoading ? t('bsp.calculating') : t('bsp.showRates')}
                  </button>
                  {selectedDestination ? <p className="ng-notice" role="status">{t('ship.area', { area: selectedDestination.label })}</p> : null}
                  {destinationOptions.length && !selectedDestination ? (
                    <div className="flex flex-wrap gap-2">
                      {destinationOptions.map((destination) => (
                        <button key={destination.id} type="button" className="ng-btn ng-btn--ghost !min-h-[44px] !px-3.5 !font-ng-body !text-sm !normal-case !tracking-normal" onClick={() => loadShippingRates(destination)}>
                          {destination.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {visibleShippingOptions.length ? (
                    <div className="flex flex-col gap-2">
                      {visibleShippingOptions.map((rate) => {
                        const active = selectedShipping?.courierCode === rate.courierCode && selectedShipping?.service === rate.service;
                        return (
                          <button
                            key={`${rate.courierCode}-${rate.service}-${rate.cost}`}
                            type="button"
                            aria-pressed={active}
                            className="ng-choice"
                            onClick={() => setSelectedShipping(rate)}
                          >
                            {courierLabels[rate.courierCode] || rate.courierName} {rate.serviceLabel || rate.service}
                            {' / '}
                            {rate.promotionApplied && Number(rate.originalCost || 0) > Number(rate.cost || 0) ? (
                              <s className="mr-1.5 text-ng-ash">{formatRupiah(rate.originalCost)}</s>
                            ) : null}
                            {formatRupiah(rate.cost)}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {selectedShipping?.promotionApplied ? <p className="ng-notice" role="status">{selectedShipping.promotionLabel}</p> : null}
                  {shippingError ? <p role="status" className="ng-notice ng-notice--error">{shippingError}</p> : null}
                </div>
                <div className="ng-fieldset">
                  <div className="flex flex-col gap-2">
                    <p className="ng-mono m-0 text-ng-ember">{t('bsp.voucher')}</p>
                    <strong className="font-ng-display text-[30px] font-normal">{voucher.appliedVoucher ? t('bsp.voucherApplied', { code: voucher.appliedVoucher.code }) : t('bsp.voucherEnter')}</strong>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="ng-field uppercase placeholder:normal-case"
                      value={voucher.inputCode}
                      onChange={(event) => voucher.setInputCode(event.target.value.toUpperCase())}
                      aria-label={t('bsp.voucherPlaceholder')}
                      placeholder={t('bsp.voucherPlaceholder')}
                    />
                    <button type="button" className="ng-btn ng-btn--ghost shrink-0" onClick={voucher.applyVoucher} disabled={voucher.loading}>
                      {voucher.loading ? t('bsp.checking') : t('bsp.apply')}
                      <BadgePercent className="h-4 w-4" />
                    </button>
                  </div>
                  {voucher.appliedVoucher ? (
                    <div role="status" className="flex items-center justify-between gap-4 border border-ng-bone/20 px-4 py-2 text-[15px]">
                      <span className="text-ng-dust">{t('bsp.voucherDiscount')}</span>
                      <strong className="font-normal">-{formatRupiah(discountAmount)}</strong>
                      <button type="button" className="grid h-11 w-11 place-items-center border-0 bg-transparent text-ng-bone" onClick={voucher.removeVoucher} aria-label={t('bsp.voucherRemove')}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : voucher.message ? (
                    <p role="status" className="ng-notice ng-notice--error">{voucher.message}</p>
                  ) : null}
                </div>
                <dl className="ng-panel m-0 flex flex-col gap-3 text-[15px]">
                  <div className="flex justify-between gap-4"><dt className="text-ng-dust">{t('bsp.subtotal')}</dt><dd className="m-0">{priceReady ? formatRupiah(estimatedTotal) : '—'}</dd></div>
                  {discountAmount ? <div className="flex justify-between gap-4"><dt className="text-ng-dust">{t('bsp.voucher')}</dt><dd className="m-0 text-ng-sand">-{formatRupiah(discountAmount)}</dd></div> : null}
                  <div className="flex justify-between gap-4"><dt className="text-ng-dust">{t('bsp.shipping')}</dt><dd className="m-0">{shippingFee ? formatRupiah(shippingFee) : '-'}</dd></div>
                  <div className="flex items-baseline justify-between gap-4 border-t border-ng-bone/30 pt-3"><dt className="ng-mono text-ng-dust">{t('bsp.transferTotal')}</dt><dd className="m-0 font-ng-display text-[34px]">{priceReady ? formatRupiah(totalDue) : '—'}</dd></div>
                </dl>
                <label className="ng-label"><span className="ng-mono text-ng-dust">{t('bsp.payment')}</span><select className="ng-field" value={form.paymentMethod} onChange={(event) => updateField('paymentMethod', event.target.value)}>{checkoutPaymentMethods.map((method) => <option key={method.id} value={method.id}>{t(method.labelKey)}</option>)}</select></label>
                <label className="flex items-start gap-3 text-[15px] leading-relaxed text-ng-sand">
                  <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#d4573a]" checked={form.preorderAcknowledged} onChange={(event) => updateField('preorderAcknowledged', event.target.checked)} />
                  {t('bsp.preorderConfirm')}
                </label>
                <button type="submit" className="ng-btn ng-btn--lg ng-btn--block" disabled={saving}>
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
