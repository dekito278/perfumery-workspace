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
import { createBespokeRequest, updateOrderPaymentStatus, updateOrderStatus } from '@/services/orderService.js';
import { createDokuCheckout } from '@/services/dokuCheckoutService.js';
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
import { formatRupiah } from '@/services/productCatalogService.js';
import { buildVoucherSnapshot } from '@/utils/voucherSnapshot.js';

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
        <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" width="240" height="240" />
      </span>
    ) : null}
    <span className="block px-1 py-0.5">{children}</span>
  </button>
);

const CapMockup = ({ cap, bottle, label }) => {
  const isStone = cap?.value === 'Cap batu';
  const isAcrylic = cap?.value === 'Cap custom akrilik';
  const isSquare = /square|kotak/i.test(`${bottle?.label || ''} ${bottle?.value || ''}`);
  const visualImage = cap?.imageUrl || bottle?.imageUrl || label?.imageUrl;

  if (visualImage) {
    return (
      <div className="mobile-commerce-panel relative aspect-square w-full overflow-hidden bg-[#f8f7f4] p-0">
        <img src={visualImage} alt={cap?.label || bottle?.label || label?.label || 'Opsi custom'} className="h-full w-full object-cover" loading="lazy" decoding="async" width="360" height="360" />
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
      <div className={`absolute left-1/2 top-[24%] h-[44%] w-[27%] -translate-x-1/2 border border-[#e5decf]/20 bg-white shadow-sm ${isSquare ? 'rounded-xl' : 'rounded-b-[24px] rounded-t-xl'}`} />
      <div className="absolute left-1/2 top-[14%] h-[16%] w-[36%] -translate-x-1/2 rounded-xl border border-[#e5decf]/20 bg-[#1f2937] shadow-sm" />
      {isStone ? <div className="absolute left-1/2 top-[10%] h-[18%] w-[42%] -translate-x-1/2 rounded-[18px] bg-[radial-gradient(circle_at_30%_25%,#f9fafb,#8b8a7c_45%,#2f352f)] shadow-md" /> : null}
      {isAcrylic ? <div className="absolute left-1/2 top-[10%] h-[18%] w-[42%] -translate-x-1/2 rounded-xl bg-[linear-gradient(135deg,rgba(245,158,11,.85),rgba(236,72,153,.75),rgba(59,130,246,.8))] shadow-md" /> : null}
      <div className="absolute left-1/2 top-[47%] min-w-10 -translate-x-1/2 rounded-lg border border-[#e5decf]/10 bg-[#f7f1e5] px-2 py-1 text-center text-[9px] font-bold text-[#1b1a16]">{label?.label || 'Label'}</div>
      <div className="mobile-commerce-chip absolute bottom-3 left-3 bg-white/80 px-2.5 py-1 text-[10px]">{bottle?.label || 'Botol'}</div>
      <div className="mobile-commerce-chip absolute bottom-3 right-3 bg-white/80 px-2.5 py-1 text-[10px]">{cap?.label}</div>
    </div>
  );
};

const MobileBespokePage = () => {
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
    occasion: bespokeOccasionOptions[0],
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
    name: 'Bespoke perfume request',
    quantity: 1,
    priceNumber: estimatedTotal,
  }], [estimatedTotal]);
  const voucher = useAppliedVoucher(estimatedTotal, bespokeVoucherItems);
  const shippingFee = Number(selectedShipping?.cost || 0);
  const discountAmount = Number(voucher.discountAmount || 0);
  const discountedEstimatedTotal = Number(voucher.subtotalAfterDiscount ?? estimatedTotal);
  const totalDue = discountedEstimatedTotal + shippingFee;
  const shippingSummary = selectedShipping ? describeShippingRate(selectedShipping) : '';
  const shippingWeight = useMemo(() => getCheckoutShippingWeight([{ quantity: 1 }]), []);
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
        toast.error('Clipboard kosong. Tekan lama kolom kode untuk tempel manual.');
        return;
      }
      updateField('customerCode', nextCode);
      toast.success('Kode customer ditempel');
    } catch (error) {
      toast.error('Tempel otomatis belum diizinkan browser. Tekan lama kolom kode lalu pilih Tempel.');
    }
  }, [updateField]);

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
      toast.error('Kode customer wajib diisi');
      return;
    }

    const customer = await lookupCustomerByCode(form.customerCode);
    if (!customer) {
      toast.error('Kode customer tidak ditemukan');
      return;
    }

    setForm((current) => ({
      ...current,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      contact: customer.contact,
      deliveryAddress: customer.deliveryAddress || '',
    }));
    updateDestinationSearch(customer.deliveryArea || '');
    toast.success(`${customer.customerCode} loaded`);
  }, [form.customerCode, updateDestinationSearch]);

  const chooseShippingCourier = useCallback((courierCode) => {
    setSelectedCourier(courierCode);
    setSelectedShipping(null);
    setShippingOptions([]);
    setShippingError('');
  }, []);

  const searchDestinations = useCallback(async () => {
    const search = destinationSearch.trim();
    if (search.length < 3) {
      toast.error('Isi minimal 3 huruf area, kecamatan, atau kota');
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
        setShippingError('Belum ada ongkir untuk area ini');
      }
    } catch (error) {
      setShippingError(getFriendlyShippingError(error, 'Gagal menghitung ongkir. Coba pilih area atau kurir lain.'));
    } finally {
      setShippingLoading(false);
    }
  }, [estimatedTotal, selectedCourier, shippingWeight]);

  const autoCalculateShipping = useCallback(async ({
    courierCode = selectedCourier,
    searchText = '',
    autoSelectBest = false,
  } = {}) => {
    const search = String(searchText || destinationSearch || form.deliveryAddress || '').trim();
    if (search.length < 3) {
      toast.error('Isi area ongkir dulu, contoh: Jakarta Selatan');
      return;
    }
    if (!courierCode) {
      toast.error('Pilih ekspedisi dulu');
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
          setShippingError('Area ditemukan, tapi ongkir belum tersedia untuk kurir ini. Pilih area lain atau kurir lain.');
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
        ? 'Pilih area tujuan yang paling sesuai, lalu pilih layanan ongkir.'
        : 'Area belum ditemukan. Coba ketik kecamatan atau kota, contoh: Jakarta Selatan.');
    } catch (error) {
      setShippingError(getFriendlyShippingError(error, 'Gagal menghitung ongkir. Coba pakai nama kecamatan atau kota.'));
    } finally {
      setShippingLoading(false);
    }
  }, [destinationSearch, estimatedTotal, form.deliveryAddress, loadShippingRates, selectedCourier, selectedDestination, shippingWeight]);

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
      title: 'Brief aroma',
      shortLabel: 'Aroma',
      description: 'Beri nama parfum, lalu ceritakan arah aroma dan momen pemakaian.',
      render: () => (
        <div className="grid gap-3">
          <input
            value={form.perfumeName}
            onChange={(event) => updateField('perfumeName', event.target.value)}
            placeholder="Nama parfum, contoh: After Rain"
            className="mobile-commerce-control h-12 px-3 text-sm font-semibold text-[#1b1a16]"
          />
          <textarea
            value={form.scentDescription}
            onChange={(event) => updateField('scentDescription', event.target.value)}
            placeholder="Contoh: bersih, dewasa, woody, sedikit vanila, tidak terlalu manis."
            rows={3}
            className="mobile-commerce-control min-h-[96px] w-full resize-none px-3 py-3 text-sm font-semibold leading-relaxed text-[#1b1a16]"
          />
          <div className="grid grid-cols-4 gap-1.5">
            {['Bersih', 'Woody', 'Vanila', 'Segar'].map((item) => (
              <button
                key={item}
                type="button"
                className="mobile-commerce-choice px-2 py-2 text-center text-[10px] font-bold text-[#1b1a16]"
                onClick={() => updateField('scentDescription', `${form.scentDescription}${form.scentDescription.trim() ? ', ' : ''}${item}`)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 mobile-segment-scroll">
            {bespokeOccasionOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => updateField('occasion', option)}
                className={cn(
                  'h-9 shrink-0 rounded-full border px-3 text-[11px] font-bold transition',
                  form.occasion === option ? 'border-[#e5decf]/30 bg-[#f7f1e5] text-[#1b1a16]' : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ),
      isComplete: () => form.perfumeName.trim().length > 1 && form.scentDescription.trim().length > 3 && Boolean(form.occasion),
    },
    {
      key: 'package',
      title: 'Ukuran & material',
      shortLabel: 'Preferensi',
      description: 'Pilih ukuran botol dan material tambahan bila perlu.',
      render: () => (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            {bottleSizeOptions.map((option) => (
              <OptionButton key={option.value} active={form.size === option.value} imageUrl={option.imageUrl} onClick={() => updateField('size', option.value)}>{option.label}</OptionButton>
            ))}
          </div>
          {exoticMaterialOptions.length ? (
            <div className="grid gap-2">
              <div className="text-[10px] font-bold uppercase text-[#1b1a16]">Material eksotis</div>
              <div className="grid grid-cols-2 gap-2">
                <OptionButton active={!form.exoticMaterial} onClick={() => updateField('exoticMaterial', '')}>Tanpa tambahan</OptionButton>
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
      title: 'Tampilan botol',
      shortLabel: 'Botol',
      description: 'Pilih bentuk botol, cap, dan label dalam satu layar.',
      render: () => (
        <div className="grid gap-3">
          <div className="grid grid-cols-[108px_minmax(0,1fr)] gap-3">
            <CapMockup bottle={selectedBottleType} cap={selectedCap} label={selectedLabel} />
            <div className="grid content-start gap-2 text-xs font-bold text-[#1b1a16]">
              <div className="rounded-2xl bg-[#f7f1e5] px-3 py-2">{selectedBottleType?.label || 'Botol'}</div>
              <div className="rounded-2xl bg-white px-3 py-2">{selectedCap?.label || 'Cap'}</div>
              <div className="rounded-2xl bg-white px-3 py-2">{selectedLabel?.label || 'Label'}</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-[#1b1a16]">Botol</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {bottleTypeOptions.map((option) => (
                <OptionButton key={option.value} active={form.bottleType === option.value} imageUrl={option.imageUrl} onClick={() => updateField('bottleType', option.value)}>{option.label}</OptionButton>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-[#1b1a16]">Cap</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {capDesignOptions.map((option) => (
                <OptionButton key={option.value} active={form.capDesign === option.value} imageUrl={option.imageUrl} onClick={() => updateField('capDesign', option.value)}>{option.label}</OptionButton>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-[#1b1a16]">Label</div>
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
      title: 'Kontak & ongkir',
      shortLabel: 'Ongkir',
      description: 'Isi penerima seperti checkout produk, lalu pilih kurir dan layanan ongkir.',
      render: () => (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <input value={form.customerCode} onChange={(event) => updateField('customerCode', event.target.value.toUpperCase())} placeholder="Kode customer" className="mobile-commerce-control h-12 px-3 text-sm font-semibold uppercase" />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-3 text-xs font-bold" onClick={pasteCustomerCode}>Tempel</Button>
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={lookupCustomer}>Cek</Button>
            </div>
            <input value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} placeholder="Nama pembeli" className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
            <input value={form.contact} onChange={(event) => updateField('contact', event.target.value)} placeholder="Nomor WhatsApp / telepon" inputMode="tel" autoComplete="tel" className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
            <textarea value={form.deliveryAddress} onChange={(event) => updateField('deliveryAddress', event.target.value)} placeholder="Alamat lengkap pengiriman" rows={2} className="mobile-commerce-control px-3 py-3 text-sm font-semibold" />
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input value={destinationSearch} onChange={(event) => updateDestinationSearch(event.target.value)} placeholder="Kecamatan / kota tujuan" className="mobile-commerce-control h-12 px-3 text-sm font-semibold" />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-3 text-xs font-bold" onClick={searchDestinations} disabled={shippingLoading || destinationSearch.trim().length < 3}>Cari</Button>
            </div>
            <label className={`mobile-commerce-courier-select ${selectedCourier ? 'is-selected' : ''}`}>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase">
                  {selectedCourier ? 'Kurir dipilih' : 'Dropdown kurir'}
                </span>
                <span className="mt-0.5 block truncate text-sm font-bold">
                  {selectedCourier ? (courierLabels[selectedCourier] || selectedCourier.toUpperCase()) : 'Pilih kurir pengiriman'}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
              <select value={selectedCourier} onChange={(event) => handleCourierChange(event.target.value)} aria-label="Pilih kurir pengiriman">
                <option value="">Pilih kurir</option>
                {checkoutCourierOptions.map((courier) => (
                  <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                ))}
              </select>
            </label>
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={autoCalculateShipping} disabled={shippingLoading || destinationSearch.trim().length < 3 || !selectedCourier}>
              {shippingLoading ? 'Menghitung...' : selectedDestination ? 'Tampilkan ongkir' : 'Cari ongkir'}
            </Button>
          </div>
          {selectedDestination ? <p className="rounded-2xl bg-[#f7f1e5] px-3 py-2 text-[11px] font-bold text-[#1b1a16]">Area: {selectedDestination.label}</p> : null}
          {destinationOptions.length && !selectedDestination ? (
            <div className="grid gap-2">
              {destinationOptions.map((destination) => (
                <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)} className="mobile-commerce-choice px-3 py-2 text-xs font-bold text-[#1b1a16]">{destination.label}</button>
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
                      <span className="shrink-0 text-right text-sm font-bold text-[#1b1a16]">
                        {rate.promotionApplied && Number(rate.originalCost || 0) > Number(rate.cost || 0) ? (
                          <span className="block text-[10px] text-[#8a9280] line-through">{formatRupiah(rate.originalCost)}</span>
                        ) : null}
                        {formatRupiah(rate.cost)}
                      </span>
                    </div>
                    {rate.promotionApplied ? <div className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold uppercase text-emerald-700">{rate.promotionLabel}</div> : null}
                    <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">{rate.etd ? `ETA ${rate.etd}` : rate.description || 'Estimasi mengikuti kurir'}</p>
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
      title: 'Ringkasan & pembayaran',
      shortLabel: 'Bayar',
      description: 'Cek ringkasan lalu pilih metode pembayaran.',
      render: () => (
        <div className="grid gap-3">
          <div className="mobile-commerce-summary p-4 text-xs font-bold text-[#1b1a16]">
            <div className="flex justify-between gap-3"><span>Nama parfum</span><span>{form.perfumeName || '-'}</span></div>
            <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>Custom perfume</span><span>Dikonfirmasi Studio</span></div>
            <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>Voucher</span><span>{voucher.appliedVoucher ? `${voucher.appliedVoucher.code} diterapkan` : '-'}</span></div>
            <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>Ongkir</span><span>{shippingFee ? formatRupiah(shippingFee) : '-'}</span></div>
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-[#e5decf]/10 pt-3 text-sm text-[#1b1a16]">
              <span>Total transfer</span>
              <span className="text-base text-[#1b1a16]">{formatRupiah(totalDue)}</span>
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
            <div className="flex items-center gap-2 text-xs font-bold text-[#1b1a16]">
              <Ticket className="h-3.5 w-3.5 text-[#1b1a16]" />
              Voucher
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
              <input
                value={voucher.inputCode}
                onChange={(event) => voucher.setInputCode(event.target.value.toUpperCase())}
                placeholder="Kode voucher"
                className="mobile-commerce-control h-11 min-w-0 px-3 text-xs font-bold uppercase text-[#1b1a16]"
              />
              <Button type="button" variant="outline" className="h-11 rounded-2xl bg-white px-3 text-[11px] font-bold" onClick={voucher.applyVoucher} disabled={voucher.loading}>
                {voucher.loading ? 'Cek...' : 'Pakai'}
              </Button>
            </div>
            {voucher.appliedVoucher ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-2xl border border-[#e5decf]/15 bg-[#f7f1e5] px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-[#1b1a16]">{voucher.appliedVoucher.code} diterapkan</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-[#6f695f]">Total transfer sudah disesuaikan voucher.</div>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-[#1b1a16]" onClick={voucher.removeVoucher} aria-label="Hapus voucher">
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
                  <span className="text-sm font-bold text-[#1b1a16]">{method.label}</span>
                  {active ? <span className="rounded-full bg-[#1b1a16] px-2 py-1 text-[9px] font-bold uppercase text-white">Dipilih</span> : null}
                </div>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed">{method.description}</p>
                {method.accountNumber ? <div className="mobile-commerce-panel mt-3 border-0 bg-white/80 px-3 py-2 text-[11px] font-bold text-[#1b1a16]">{method.bankName} {method.accountNumber} / A/N {method.accountName}</div> : null}
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
                form.preorderAcknowledged ? 'border-[#e5decf] bg-[#1b1a16]' : 'border-[#e5decf]/24 bg-white'
              )}
              aria-hidden="true"
            >
              {form.preorderAcknowledged ? <Check className="h-4 w-4" /> : null}
            </span>
            <span>
              <span className="block text-sm font-bold text-[#1b1a16]">Konfirmasi pre-order</span>
              <span className="mt-1 block text-[11px] font-semibold leading-relaxed">
                Saya memahami bahwa bespoke perfume adalah pre-order dengan estimasi pengerjaan 7-14 hari setelah brief dikonfirmasi.
              </span>
            </span>
          </label>
        </div>
      ),
      isComplete: () => Boolean(form.paymentMethod && form.preorderAcknowledged),
    },
  ], [autoCalculateShipping, bottleSizeOptions, bottleTypeOptions, budgetSummary, capDesignOptions, destinationOptions, destinationSearch, discountAmount, exoticMaterialOptions, form, handleCourierChange, labelDesignOptions, loadShippingRates, lookupCustomer, pasteCustomerCode, searchDestinations, selectedBottleType, selectedCap, selectedCourier, selectedDestination, selectedLabel, selectedShipping, shippingError, shippingFee, shippingLoading, totalDue, updateDestinationSearch, updateField, visibleShippingOptions, voucher]);

  const activeStep = flowSteps[step];
  const completion = Math.round(((step + Number(activeStep.isComplete())) / flowSteps.length) * 100);

  const nextStep = () => {
    if (!activeStep.isComplete()) {
      toast.error('Lengkapi langkah ini dulu');
      return;
    }
    setStep((current) => Math.min(current + 1, flowSteps.length - 1));
  };

  const submitRequest = async () => {
    const incompleteStep = flowSteps.find((item) => !item.isComplete());
    if (incompleteStep) {
      toast.error(`Lengkapi dulu: ${incompleteStep.title}`);
      setStep(flowSteps.indexOf(incompleteStep));
      return;
    }

    setSaving(true);
    let createdOrder = null;
    try {
      const voucherValidation = voucher.appliedCode
        ? await applyVoucherToSubtotalAsync({ code: voucher.appliedCode, subtotal: estimatedTotal, items: bespokeVoucherItems })
        : null;
      if (voucher.appliedCode && !voucherValidation?.valid) {
        throw new Error(voucherValidation?.message || 'Voucher tidak bisa digunakan');
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
        const manualPaymentResponse = {
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
          paymentResponse: manualPaymentResponse,
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
          manualTransfer: manualPaymentResponse,
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

        setSubmittedRequest({
          ...form,
          orderNumber: order.orderNumber,
          customerCode: order.customerCode || form.customerCode,
          budget: formatRupiah(estimatedTotal),
          shipping: shippingSummary,
          shippingFee,
          totalDue: formatRupiah(checkoutTotalDue),
          voucherCode: voucherSnapshot?.code || '',
          reference: referenceProduct?.name || '',
          createdAt: new Date().toISOString(),
        });
        toast.success(`Custom perfume request saved to Studio: ${order.orderNumber}`);
        clearBespokeDraft();
        (voucherSnapshot?.code ? voucher.removeVoucher : clearAppliedVoucherCode)();
        navigate(`/mobile/payment?order=${encodeURIComponent(order.orderNumber)}&payment=manual`);
        return;
      }

      const checkout = await createDokuCheckout({
        order,
        amount: checkoutTotalDue,
        customerName: form.customerName,
        contact: form.contact,
        items: order.items || [],
        callbackPath: '/mobile/payment',
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

      setSubmittedRequest({
        ...form,
        orderNumber: order.orderNumber,
        customerCode: order.customerCode || form.customerCode,
        budget: formatRupiah(estimatedTotal),
        shipping: shippingSummary,
        shippingFee,
        totalDue: formatRupiah(checkoutTotalDue),
        voucherCode: voucherSnapshot?.code || '',
        reference: referenceProduct?.name || '',
        createdAt: new Date().toISOString(),
      });
      toast.success(`Custom perfume request saved to Studio: ${order.orderNumber}`);
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
      toast.error(error.message || 'Failed to save bespoke request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileCommerceLayout>
      <Helmet>
        <title>Parfum Custom - Solivagant</title>
        <meta name="description" content="Create a custom perfume request with aroma, bottle size, cap design, exotic materials, and payment preference." />
      </Helmet>
      <main className="mobile-page mobile-bespoke-page">
        <section className="mobile-soft-card p-2.5">
          <div className="mobile-commerce-chip gap-2 bg-white px-3 py-1 text-[10px] uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            Brief custom
          </div>
          <h1 className="mt-1.5 text-lg font-bold leading-tight text-[#1b1a16]">Request parfum custom.</h1>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
            Cerita aroma, pilihan botol, delivery, dan payment dalam flow singkat.
          </p>
          <div className="mt-2 inline-flex rounded-full bg-[#1b1a16] px-2.5 py-1 text-[10px] font-bold uppercase text-white">
            Pre-order / 7-14 hari
          </div>
          {referenceProduct ? (
            <div className="mobile-commerce-panel mt-3 border-0 p-3 text-xs font-bold text-[#1b1a16]">
              Referensi aroma: <span className="text-[#1b1a16]">{referenceProduct.name}</span>
            </div>
          ) : null}
        </section>

        <section className="mobile-bespoke-wizard mobile-card overflow-hidden">
          <header className="border-b border-[#e5decf]/10 bg-white px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1b1a16]">Langkah {step + 1} dari {flowSteps.length}</p>
                <h2 className="mt-1 text-base font-bold text-[#1b1a16]">{activeStep.title}</h2>
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
                    index === step ? 'bg-[#1b1a16] text-white' : item.isComplete() ? 'bg-[#f7f1e5] text-[#1b1a16]' : 'bg-[#f8f7f4] text-[#6b7280]'
                  )}
                >
                  {item.shortLabel}
                </button>
              ))}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#f7f1e5]">
              <div className="h-full rounded-full bg-[#1b1a16]" style={{ width: `${((step + 1) / flowSteps.length) * 100}%` }} />
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
                <h2 className="text-sm font-bold text-[#1b1a16]">Brief ringkas</h2>
                <p className="mt-1 text-xs font-bold leading-relaxed text-[#1b1a16]">{form.perfumeName || 'Nama parfum belum diisi.'}</p>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-[#6b7280]">{form.scentDescription || 'Aroma belum diisi.'}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Pre-order</div>
                <div className="text-sm font-bold text-[#1b1a16]">7-14 hari</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-[#6b7280]">
              <div className="mobile-commerce-panel border-0 bg-[#f8f7f4] px-3 py-2">{form.size || '-'} / {selectedCap?.label || '-'}</div>
              <div className="mobile-commerce-panel border-0 bg-[#f8f7f4] px-3 py-2">{shippingSummary || 'Ongkir belum dipilih'}</div>
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
                <h2 className="text-base font-bold text-[#1b1a16]">Ringkasan request</h2>
                <div className="mt-3 space-y-2 text-xs font-semibold text-[#6b7280]">
                  <p><strong className="text-[#1b1a16]">Pembeli:</strong> {submittedRequest.customerName}</p>
                  <p><strong className="text-[#1b1a16]">Kode customer:</strong> {submittedRequest.customerCode || '-'}</p>
                  <p><strong className="text-[#1b1a16]">Studio order:</strong> {submittedRequest.orderNumber}</p>
                  <p><strong className="text-[#1b1a16]">Kontak:</strong> {submittedRequest.contact}</p>
                  <p><strong className="text-[#1b1a16]">Nama parfum:</strong> {submittedRequest.perfumeName || '-'}</p>
                  <p><strong className="text-[#1b1a16]">Aroma:</strong> {submittedRequest.scentDescription}</p>
                  <p><strong className="text-[#1b1a16]">Botol:</strong> {submittedRequest.size}, {submittedRequest.bottleType}, {submittedRequest.capDesign}, {submittedRequest.labelDesign}</p>
                  {submittedRequest.exoticMaterial ? <p><strong className="text-[#1b1a16]">Material:</strong> {submittedRequest.exoticMaterial}</p> : null}
                  <p><strong className="text-[#1b1a16]">Budget:</strong> {submittedRequest.budget}</p>
                  <p><strong className="text-[#1b1a16]">Ongkir:</strong> {submittedRequest.shipping || '-'}</p>
                  <p><strong className="text-[#1b1a16]">Pre-order:</strong> 7-14 hari setelah brief dikonfirmasi</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => navigate('/mobile/catalog')}>
                    <ClipboardList className="h-4 w-4" />
                    Katalog
                  </Button>
                  <Button
                    type="button"
                    className="rounded-2xl gap-2"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${submittedRequest.customerName} / ${submittedRequest.contact}\n${submittedRequest.scentDescription}`);
                      toast.success('Request contact copied');
                    }}
                  >
                    Salin kontak
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
          aria-label="Aksi request custom"
          className="mobile-bespoke-action-bar"
          contentClassName="rounded-2xl border-[#e5decf]/10 bg-white/95"
        >
          {step === flowSteps.length - 1 ? (
            <div className="grid gap-2">
              <div className="rounded-2xl border border-[#e5decf]/10 bg-[#f7f1e5] px-3 py-2">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-[#6b7280]">Total transfer</p>
                    <p className="text-lg font-bold leading-tight text-[#1b1a16]">{formatRupiah(totalDue)}</p>
                  </div>
                  <p className="shrink-0 text-[10px] font-bold uppercase text-[#1b1a16]">Siap dibayar</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="rounded-2xl bg-white" disabled={saving} onClick={() => setStep((current) => Math.max(current - 1, 0))}>
                  Kembali
                </Button>
                <Button type="button" className="rounded-2xl gap-2" onClick={submitRequest} disabled={saving}>
                  {saving ? 'Memproses...' : (isManualPayment ? 'Buat pesanan & upload bukti' : 'Bayar sekarang')}
                  {isManualPayment ? <CheckCircle2 className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="rounded-2xl bg-white" disabled={step === 0} onClick={() => setStep((current) => Math.max(current - 1, 0))}>
                Kembali
              </Button>
              <Button type="button" className="rounded-2xl" onClick={nextStep}>Lanjut</Button>
            </div>
          )}
        </StickyBottomActionBar>

      </main>
    </MobileCommerceLayout>
  );
};

export default MobileBespokePage;
