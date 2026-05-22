import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CreditCard,
  MapPin,
  PackageCheck,
  Send,
  Sparkles,
  Ticket,
  WandSparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import {
  bespokeBottleSizeOptions,
  bespokeCapDesignOptions,
  bespokeOccasionOptions,
} from '@/data/storefront.js';
import { useBespokeSettings } from '@/hooks/useBespokeSettings.js';
import { useAppliedVoucher } from '@/hooks/useAppliedVoucher.js';
import { useCatalogProduct } from '@/hooks/useCatalogProducts.js';
import { cn } from '@/lib/utils.js';
import { checkoutPaymentMethods, getCheckoutPaymentMethod, isManualTransferPayment } from '@/services/cartService.js';
import { lookupCustomerByCode } from '@/services/customerService.js';
import { createDokuCheckout } from '@/services/dokuCheckoutService.js';
import { createBespokeRequest, updateOrderPaymentStatus, updateOrderStatus } from '@/services/orderService.js';
import { formatRupiah } from '@/services/productCatalogService.js';
import {
  recordVoucherUsageForOrder,
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

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';
const BESPOKE_DRAFT_STORAGE_KEY = 'dekito.storefront.bespokeDraft.v1';

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

const fallbackBottleTypeOptions = [
  { value: 'Classic glass', label: 'Classic glass', description: 'Clean everyday profile.', price: 0 },
  { value: 'Square glass', label: 'Square glass', description: 'Sharper display shape.', price: 0 },
];

const fallbackLabelDesignOptions = [
  { value: 'Minimal label', label: 'Minimal label', description: 'Clean Solivagant label.', price: 0 },
  { value: 'Personal label', label: 'Personal label', description: 'Personal text label.', price: 0 },
];

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

const getEnabledOptions = (options, fallback = []) => {
  const list = Array.isArray(options) ? options.filter((option) => option.enabled !== false) : [];
  return list.length ? list : fallback;
};

const StepRail = ({ currentStep, steps }) => (
  <div className="grid gap-2">
    {steps.map((step, index) => {
      const isActive = index === currentStep;
      const isDone = index < currentStep;
      return (
        <div
          key={step.key}
          className={cn(
            'grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-2xl border px-3 py-3 transition',
            isActive ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white'
          )}
        >
          <span className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
            isDone ? 'bg-[#263d27] text-white' : 'bg-[#f7f8f2] text-[#6b7280]'
          )}
          >
            {isDone ? <Check className="h-4 w-4" /> : index + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-[#0b130c]">{step.shortLabel}</span>
            <span className="mt-0.5 block truncate text-xs font-semibold text-[#6b7280]">{step.description}</span>
          </span>
        </div>
      );
    })}
  </div>
);

const OptionCard = ({ active, children, description = '', imageUrl = '', meta = '', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'min-h-[88px] rounded-2xl border p-3 text-left transition hover:border-[#263d27]/35',
      active ? 'border-[#263d27] bg-[#eef2e8] text-[#263d27]' : 'border-[#263d27]/10 bg-white text-[#6b7280]'
    )}
  >
    {imageUrl ? (
      <span className="mb-3 block aspect-[4/3] overflow-hidden rounded-xl bg-[#f7f8f2]">
        <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" width="320" height="240" />
      </span>
    ) : null}
    <span className="flex items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[#0b130c]">{children}</span>
        {description ? <span className="mt-1 block text-xs font-semibold leading-relaxed">{description}</span> : null}
      </span>
      {active ? <span className="rounded-full bg-[#263d27] px-2 py-1 text-[9px] font-bold uppercase text-white">Dipilih</span> : null}
    </span>
    {meta ? <span className="mt-3 block text-xs font-bold text-[#263d27]">{meta}</span> : null}
  </button>
);

const BottlePreview = ({ bottle, cap, label }) => {
  const visualImage = bottle?.imageUrl || cap?.imageUrl || label?.imageUrl;
  const isSquare = /square|kotak/i.test(`${bottle?.label || ''} ${bottle?.value || ''}`);

  if (visualImage) {
    return (
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-[#263d27]/10 bg-white">
        <img src={visualImage} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" width="420" height="520" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <div className="flex flex-wrap gap-2">
            {[bottle?.label, cap?.label, label?.label].filter(Boolean).map((item) => (
              <span key={item} className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-[#263d27]">{item}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-[#263d27]/10 bg-[#f7f8f2]">
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#d8c8a4]/55 to-transparent" />
      <div className={cn(
        'absolute left-1/2 top-[25%] h-[45%] w-[30%] -translate-x-1/2 border border-[#263d27]/20 bg-white shadow-sm',
        isSquare ? 'rounded-xl' : 'rounded-b-[28px] rounded-t-xl'
      )}
      />
      <div className="absolute left-1/2 top-[14%] h-[16%] w-[38%] -translate-x-1/2 rounded-xl border border-[#263d27]/20 bg-[#1f2937] shadow-sm" />
      <div className="absolute left-1/2 top-[48%] min-w-16 -translate-x-1/2 rounded-lg border border-[#263d27]/10 bg-[#eef2e8] px-3 py-2 text-center text-[10px] font-bold text-[#263d27]">
        {label?.label || 'Label'}
      </div>
      <div className="absolute bottom-4 left-4 rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-[#263d27]">{bottle?.label || 'Botol'}</div>
      <div className="absolute bottom-4 right-4 rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-[#263d27]">{cap?.label || 'Cap'}</div>
    </div>
  );
};

const SummaryLine = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 text-sm font-bold">
    <span className="text-[#6b7280]">{label}</span>
    <span className="max-w-[60%] text-right text-[#0b130c]">{value || '-'}</span>
  </div>
);

const BespokePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referenceProduct = useCatalogProduct(searchParams.get('reference'));
  const bespokeSettings = useBespokeSettings();

  const bottleSizeOptions = useMemo(
    () => getEnabledOptions(bespokeSettings.bottleSizes, bespokeBottleSizeOptions),
    [bespokeSettings.bottleSizes]
  );
  const bottleTypeOptions = useMemo(
    () => getEnabledOptions(bespokeSettings.bottleTypes, fallbackBottleTypeOptions),
    [bespokeSettings.bottleTypes]
  );
  const capDesignOptions = useMemo(
    () => getEnabledOptions(bespokeSettings.capDesigns, bespokeCapDesignOptions),
    [bespokeSettings.capDesigns]
  );
  const labelDesignOptions = useMemo(
    () => getEnabledOptions(bespokeSettings.labelDesigns, fallbackLabelDesignOptions),
    [bespokeSettings.labelDesigns]
  );
  const exoticMaterialOptions = useMemo(
    () => getEnabledOptions(bespokeSettings.exoticMaterials, []),
    [bespokeSettings.exoticMaterials]
  );

  const savedDraft = useMemo(() => readBespokeDraft(), []);
  const savedForm = savedDraft.form && typeof savedDraft.form === 'object' && !Array.isArray(savedDraft.form) ? savedDraft.form : {};
  const [step, setStep] = useState(Number.isInteger(savedDraft.step) ? Math.min(Math.max(savedDraft.step, 0), 4) : 0);
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
    if (!referenceProduct?.notes) return;
    setForm((current) => (
      current.scentDescription ? current : { ...current, scentDescription: referenceProduct.notes }
    ));
  }, [referenceProduct]);

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

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedSize = bottleSizeOptions.find((option) => option.value === form.size) || bottleSizeOptions[0];
  const selectedBottleType = bottleTypeOptions.find((option) => option.value === form.bottleType) || bottleTypeOptions[0];
  const selectedCap = capDesignOptions.find((option) => option.value === form.capDesign) || capDesignOptions[0];
  const selectedLabel = labelDesignOptions.find((option) => option.value === form.labelDesign) || labelDesignOptions[0];
  const selectedExoticMaterial = exoticMaterialOptions.find((option) => option.value === form.exoticMaterial);
  const selectedPaymentMethod = getCheckoutPaymentMethod(form.paymentMethod);
  const isManualPayment = isManualTransferPayment(selectedPaymentMethod.provider);
  const estimatedTotal = Number(selectedSize?.price || 0)
    + Number(selectedBottleType?.price || 0)
    + Number(selectedCap?.price || 0)
    + Number(selectedLabel?.price || 0)
    + Number(selectedExoticMaterial?.price || 0);
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
  const shippingSummary = selectedShipping ? describeShippingRate(selectedShipping) : '';
  const shippingWeight = useMemo(() => getCheckoutShippingWeight([{ quantity: 1 }]), []);
  const visibleShippingOptions = selectedCourier
    ? shippingOptions.filter((rate) => rate.courierCode === selectedCourier)
    : shippingOptions;
  const budgetSummary = [
    selectedSize?.label,
    selectedBottleType?.label,
    selectedCap?.label,
    selectedLabel?.label,
    selectedExoticMaterial?.label,
  ].filter(Boolean).join(' / ');

  const lookupCustomer = async () => {
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
  };

  const pasteCustomerCode = async () => {
    try {
      const clipboardText = await navigator.clipboard?.readText?.();
      const nextCode = String(clipboardText || '').trim().toUpperCase();
      if (!nextCode) {
        toast.error('Clipboard kosong. Tempel manual jika browser belum memberi izin.');
        return;
      }
      updateField('customerCode', nextCode);
      toast.success('Kode customer ditempel');
    } catch {
      toast.error('Tempel otomatis belum diizinkan browser.');
    }
  };

  const resetShipping = ({ keepSearch = true, keepCourier = true } = {}) => {
    setSelectedDestination(null);
    setSelectedShipping(null);
    setShippingOptions([]);
    setDestinationOptions([]);
    setShippingError('');
    if (!keepCourier) setSelectedCourier('');
    if (!keepSearch) setDestinationSearch('');
  };

  const updateDestinationSearch = (value) => {
    setDestinationSearch(String(value || ''));
    resetShipping({ keepSearch: true });
  };

  const searchDestinations = async () => {
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
  };

  const loadShippingRates = async (destination, { courierCode = selectedCourier, autoSelectCheapest = false } = {}) => {
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
  };

  const autoCalculateShipping = async ({
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
  };

  const handleCourierChange = (courierCode) => {
    setSelectedCourier(courierCode);
    setSelectedShipping(null);
    setShippingOptions([]);
    setShippingError('');
    if (!courierCode) return;
    const searchText = destinationSearch.trim() || form.deliveryAddress.trim();
    if (searchText.length >= 3) {
      autoCalculateShipping({ courierCode, searchText, autoSelectBest: true });
    }
  };

  const stepContent = [
    {
      key: 'aroma',
      shortLabel: 'Aroma',
      title: 'Brief aroma',
      description: 'Beri nama parfum, lalu ceritakan arah aroma dan momen pemakaian.',
      isComplete: () => form.perfumeName.trim().length > 1 && form.scentDescription.trim().length > 3,
      render: () => (
        <div className="grid gap-5">
          <label>
            <span className="text-xs font-bold uppercase text-[#6b7280]">Nama parfum</span>
            <input
              value={form.perfumeName}
              onChange={(event) => updateField('perfumeName', event.target.value)}
              placeholder="Contoh: After Rain, Morning Letter, Kayu Senja"
              className="mt-2 h-12 w-full rounded-2xl border border-[#263d27]/15 bg-white px-4 text-base font-semibold text-[#0b130c] outline-none focus:border-[#263d27]"
            />
          </label>
          <label>
            <span className="text-xs font-bold uppercase text-[#6b7280]">Cerita aroma</span>
            <textarea
              value={form.scentDescription}
              onChange={(event) => updateField('scentDescription', event.target.value)}
              placeholder="Contoh: bersih, dewasa, woody, sedikit vanila, tidak terlalu manis."
              rows={7}
              className="mt-2 min-h-[180px] w-full resize-none rounded-2xl border border-[#263d27]/15 bg-white px-4 py-4 text-base font-semibold leading-relaxed text-[#0b130c] outline-none focus:border-[#263d27]"
            />
          </label>
          <div className="grid grid-cols-4 gap-2">
            {['Bersih', 'Woody', 'Vanila', 'Segar'].map((item) => (
              <button
                key={item}
                type="button"
                className="rounded-2xl border border-[#263d27]/10 bg-white px-3 py-3 text-sm font-bold text-[#263d27] hover:border-[#263d27]/35"
                onClick={() => updateField('scentDescription', `${form.scentDescription}${form.scentDescription.trim() ? ', ' : ''}${item}`)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'preferences',
      shortLabel: 'Preferensi',
      title: 'Preferensi pemakaian',
      description: 'Pilih momen pemakaian agar arah custom lebih jelas.',
      isComplete: () => Boolean(form.occasion),
      render: () => (
        <div className="grid gap-5">
          <div>
            <span className="text-xs font-bold uppercase text-[#6b7280]">Momen pemakaian</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {bespokeOccasionOptions.map((option) => (
                <OptionCard key={option} active={form.occasion === option} onClick={() => updateField('occasion', option)}>
                  {option}
                </OptionCard>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-[#263d27]/10 bg-[#f7f8f2] p-5">
            <div className="text-sm font-bold text-[#0b130c]">Ringkasan aroma</div>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
              {form.scentDescription.trim() || 'Isi cerita aroma di langkah sebelumnya.'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'package',
      shortLabel: 'Botol',
      title: 'Ukuran dan tampilan',
      description: 'Pilih size, botol, cap, label, dan material.',
      isComplete: () => Boolean(form.size && form.bottleType && form.capDesign && form.labelDesign),
      render: () => (
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <BottlePreview bottle={selectedBottleType} cap={selectedCap} label={selectedLabel} />
          <div className="grid gap-5">
            <div>
              <span className="text-xs font-bold uppercase text-[#6b7280]">Ukuran</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {bottleSizeOptions.map((option) => (
                  <OptionCard
                    key={option.value}
                    active={form.size === option.value}
                    imageUrl={option.imageUrl}
                    onClick={() => updateField('size', option.value)}
                  >
                    {option.label}
                  </OptionCard>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-bold uppercase text-[#6b7280]">Botol</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {bottleTypeOptions.map((option) => (
                  <OptionCard
                    key={option.value}
                    active={form.bottleType === option.value}
                    description={option.description}
                    imageUrl={option.imageUrl}
                    onClick={() => updateField('bottleType', option.value)}
                  >
                    {option.label}
                  </OptionCard>
                ))}
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <span className="text-xs font-bold uppercase text-[#6b7280]">Cap</span>
                <div className="mt-2 grid gap-2">
                  {capDesignOptions.map((option) => (
                    <OptionCard
                      key={option.value}
                      active={form.capDesign === option.value}
                      description={option.description}
                      imageUrl={option.imageUrl}
                      onClick={() => updateField('capDesign', option.value)}
                    >
                      {option.label}
                    </OptionCard>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-[#6b7280]">Label</span>
                <div className="mt-2 grid gap-2">
                  {labelDesignOptions.map((option) => (
                    <OptionCard
                      key={option.value}
                      active={form.labelDesign === option.value}
                      description={option.description}
                      imageUrl={option.imageUrl}
                      onClick={() => updateField('labelDesign', option.value)}
                    >
                      {option.label}
                    </OptionCard>
                  ))}
                </div>
              </div>
            </div>
            {exoticMaterialOptions.length ? (
              <div>
                <span className="text-xs font-bold uppercase text-[#6b7280]">Material eksotis</span>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <OptionCard active={!form.exoticMaterial} onClick={() => updateField('exoticMaterial', '')}>
                    Tanpa tambahan
                  </OptionCard>
                  {exoticMaterialOptions.map((option) => (
                    <OptionCard
                      key={option.value}
                      active={form.exoticMaterial === option.value}
                      imageUrl={option.imageUrl}
                      onClick={() => updateField('exoticMaterial', option.value)}
                    >
                      {option.label}
                    </OptionCard>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'delivery',
      shortLabel: 'Ongkir',
      title: 'Kontak dan pengiriman',
      description: 'Pakai pola checkout produk: customer, alamat, kurir.',
      isComplete: () => Boolean(form.customerName.trim() && form.contact.trim() && form.deliveryAddress.trim() && selectedDestination && selectedCourier && selectedShipping),
      render: () => (
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
          <div className="grid gap-4">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <input
                value={form.customerCode}
                onChange={(event) => updateField('customerCode', event.target.value.toUpperCase())}
                placeholder="Kode customer"
                className="h-12 min-w-0 rounded-2xl border border-[#263d27]/15 bg-white px-4 text-sm font-semibold uppercase outline-none focus:border-[#263d27]"
              />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={pasteCustomerCode}>Tempel</Button>
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-5 text-xs font-bold" onClick={lookupCustomer}>Cek</Button>
            </div>
            <p className="rounded-2xl bg-[#f7f8f2] px-4 py-3 text-xs font-semibold leading-relaxed text-[#6b7280]">
              Pembeli baru bisa kosongkan kode. Kode unik dibuat otomatis setelah request tersimpan.
            </p>
            <input
              value={form.customerName}
              onChange={(event) => updateField('customerName', event.target.value)}
              placeholder="Nama pembeli"
              className="h-12 rounded-2xl border border-[#263d27]/15 bg-white px-4 text-sm font-semibold outline-none focus:border-[#263d27]"
            />
            <input
              value={form.contact}
              onChange={(event) => updateField('contact', event.target.value)}
              placeholder="Nomor WhatsApp / telepon"
              inputMode="tel"
              autoComplete="tel"
              className="h-12 rounded-2xl border border-[#263d27]/15 bg-white px-4 text-sm font-semibold outline-none focus:border-[#263d27]"
            />
            <textarea
              value={form.deliveryAddress}
              onChange={(event) => updateField('deliveryAddress', event.target.value)}
              placeholder="Alamat lengkap pengiriman"
              rows={5}
              className="rounded-2xl border border-[#263d27]/15 bg-white px-4 py-4 text-sm font-semibold outline-none focus:border-[#263d27]"
            />
          </div>
          <div className="grid content-start gap-3 rounded-3xl border border-[#263d27]/10 bg-[#f7f8f2] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0b130c]">
              <MapPin className="h-4 w-4 text-[#263d27]" />
              Ongkir
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={destinationSearch}
                onChange={(event) => updateDestinationSearch(event.target.value)}
                placeholder="Kecamatan / kota tujuan"
                className="h-12 min-w-0 rounded-2xl border border-[#263d27]/15 bg-white px-4 text-sm font-semibold outline-none focus:border-[#263d27]"
              />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={searchDestinations} disabled={shippingLoading || destinationSearch.trim().length < 3}>
                Cari
              </Button>
            </div>
            <label className={cn(
              'relative flex h-12 items-center justify-between gap-3 rounded-2xl border bg-white px-4 text-sm font-bold',
              selectedCourier ? 'border-[#263d27] text-[#263d27]' : 'border-[#263d27]/15 text-[#6b7280]'
            )}
            >
              <span>{selectedCourier ? (courierLabels[selectedCourier] || selectedCourier.toUpperCase()) : 'Pilih kurir'}</span>
              <ChevronDown className="h-4 w-4" />
              <select
                value={selectedCourier}
                onChange={(event) => handleCourierChange(event.target.value)}
                aria-label="Pilih kurir pengiriman"
                className="absolute inset-0 opacity-0"
              >
                <option value="">Pilih kurir</option>
                {checkoutCourierOptions.map((courier) => (
                  <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
                ))}
              </select>
            </label>
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={autoCalculateShipping} disabled={shippingLoading || destinationSearch.trim().length < 3 || !selectedCourier}>
              {shippingLoading ? 'Menghitung...' : selectedDestination ? 'Tampilkan ongkir' : 'Cari ongkir'}
            </Button>
            {selectedDestination ? <p className="rounded-2xl bg-[#eef2e8] px-3 py-2 text-xs font-bold text-[#263d27]">Area: {selectedDestination.label}</p> : null}
            {destinationOptions.length && !selectedDestination ? (
              <div className="grid gap-2">
                {destinationOptions.map((destination) => (
                  <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)} className="rounded-2xl border border-[#263d27]/10 bg-white px-3 py-3 text-left text-xs font-bold text-[#263d27]">
                    {destination.label}
                  </button>
                ))}
              </div>
            ) : null}
            {visibleShippingOptions.length ? (
              <div className="grid gap-2">
                {visibleShippingOptions.map((rate) => {
                  const active = selectedShipping?.courierCode === rate.courierCode && selectedShipping?.service === rate.service;
                  return (
                    <button key={`${rate.courierCode}-${rate.service}-${rate.cost}`} type="button" onClick={() => setSelectedShipping(rate)} className={cn('rounded-2xl border px-3 py-3 text-left transition', active ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white')}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-[#1f2937]">{courierLabels[rate.courierCode] || rate.courierName} {rate.serviceLabel || rate.service}</span>
                        <span className="text-sm font-bold text-[#263d27]">{formatRupiah(rate.cost)}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[#6b7280]">{rate.etd ? `ETA ${rate.etd}` : rate.description || 'Estimasi mengikuti kurir'}</p>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {shippingError ? <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{shippingError}</p> : null}
          </div>
        </div>
      ),
    },
    {
      key: 'payment',
      shortLabel: 'Bayar',
      title: 'Review dan pembayaran',
      description: 'Cek total dan pilih metode pembayaran.',
      isComplete: () => Boolean(form.paymentMethod && form.preorderAcknowledged),
      render: () => (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-3">
            <div className="rounded-3xl border border-[#263d27]/10 bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0b130c]">
                <Ticket className="h-4 w-4 text-[#263d27]" />
                Voucher
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={voucher.inputCode}
                  onChange={(event) => voucher.setInputCode(event.target.value.toUpperCase())}
                  placeholder="Kode voucher"
                  className="h-12 min-w-0 rounded-2xl border border-[#263d27]/15 bg-white px-4 text-sm font-bold uppercase outline-none focus:border-[#263d27]"
                />
                <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={voucher.applyVoucher} disabled={voucher.loading}>
                  {voucher.loading ? 'Cek...' : 'Pakai'}
                </Button>
              </div>
              {voucher.appliedVoucher ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#263d27]/15 bg-[#eef2e8] px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-[#263d27]">{voucher.appliedVoucher.code} diterapkan</div>
                    <div className="mt-0.5 text-xs font-semibold text-[#51624b]">Potongan voucher masuk ke nominal pembayaran tanpa menampilkan harga bespoke.</div>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-xl text-[#263d27]" onClick={voucher.removeVoucher} aria-label="Hapus voucher">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : voucher.message ? (
                <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">{voucher.message}</p>
              ) : null}
            </div>
            {checkoutPaymentMethods.map((method) => {
              const active = form.paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => updateField('paymentMethod', method.id)}
                  className={cn(
                    'rounded-3xl border px-5 py-5 text-left transition',
                    active ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span>
                      <span className="flex items-center gap-2 text-base font-bold text-[#0b130c]">
                        <CreditCard className="h-4 w-4 text-[#263d27]" />
                        {method.label}
                      </span>
                      <span className="mt-2 block text-sm font-semibold leading-relaxed text-[#6b7280]">{method.description}</span>
                    </span>
                    {active ? <span className="rounded-full bg-[#263d27] px-3 py-1 text-[10px] font-bold uppercase text-white">Dipilih</span> : null}
                  </div>
                  {method.accountNumber ? (
                    <div className="mt-4 rounded-2xl bg-white/85 px-4 py-3 text-sm font-bold text-[#263d27]">
                      {method.bankName} {method.accountNumber} / A/N {method.accountName}
                    </div>
                  ) : null}
                </button>
              );
            })}
            <label className={cn(
              'flex items-start gap-3 rounded-3xl border px-5 py-4 text-left transition',
              form.preorderAcknowledged ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white'
            )}
            >
              <input
                type="checkbox"
                checked={Boolean(form.preorderAcknowledged)}
                onChange={(event) => updateField('preorderAcknowledged', event.target.checked)}
                className="mt-1 h-4 w-4 accent-[#263d27]"
              />
              <span>
                <span className="block text-sm font-bold text-[#0b130c]">Konfirmasi pre-order</span>
                <span className="mt-1 block text-sm font-semibold leading-relaxed text-[#6b7280]">
                  Saya memahami bahwa bespoke perfume adalah pre-order dengan estimasi pengerjaan 7-14 hari setelah brief dikonfirmasi.
                </span>
              </span>
            </label>
          </div>
          <div className="rounded-3xl border border-[#263d27]/10 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0b130c]">
              <PackageCheck className="h-4 w-4 text-[#263d27]" />
              Ringkasan
            </div>
            <div className="mt-4 grid gap-3">
              <SummaryLine label="Nama parfum" value={form.perfumeName || '-'} />
              <SummaryLine label="Custom perfume" value="Dikonfirmasi Studio" />
              <SummaryLine label="Voucher" value={voucher.appliedVoucher ? `${voucher.appliedVoucher.code} diterapkan` : '-'} />
              <SummaryLine label="Ongkir" value={shippingFee ? formatRupiah(shippingFee) : '-'} />
              <div className="border-t border-[#263d27]/10 pt-3">
                <SummaryLine label="Total bayar" value="Dikonfirmasi setelah brief" />
              </div>
              <p className="rounded-2xl bg-[#f7f8f2] px-4 py-3 text-xs font-semibold leading-relaxed text-[#6b7280]">{budgetSummary}</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const activeStep = stepContent[step];
  const completion = Math.round(((step + Number(activeStep.isComplete())) / stepContent.length) * 100);

  const goNext = () => {
    if (!activeStep.isComplete()) {
      toast.error('Lengkapi langkah ini dulu');
      return;
    }
    setStep((current) => Math.min(current + 1, stepContent.length - 1));
  };

  const submitRequest = async () => {
    const incompleteStep = stepContent.find((item) => !item.isComplete());
    if (incompleteStep) {
      toast.error(`Lengkapi dulu: ${incompleteStep.title}`);
      setStep(stepContent.indexOf(incompleteStep));
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
        perfumeName: form.perfumeName,
        preferredNotes: form.scentDescription,
        preorderAcknowledged: form.preorderAcknowledged,
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
        toast.success(`Custom perfume request saved to Studio: ${order.orderNumber}`);
        clearBespokeDraft();
        (voucherSnapshot?.code ? voucher.removeVoucher : clearAppliedVoucherCode)();
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
      toast.success(`Custom perfume request saved to Studio: ${order.orderNumber}`);
      clearBespokeDraft();
      (voucherSnapshot?.code ? voucher.removeVoucher : clearAppliedVoucherCode)();
      navigate(`/payment?order=${encodeURIComponent(order.orderNumber)}&payment=doku`);
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
    <>
      <Helmet>
        <title>Bespoke Perfume - Solivagant</title>
        <meta name="description" content="Create a bespoke perfume request with aroma, bottle, shipping, and payment flow." />
      </Helmet>
      <main className="min-h-screen bg-[#f7f8f2] text-[#0b130c]">
        <section className="border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/home" className="inline-flex items-center gap-2 text-sm font-bold text-[#eef2e8]">
              <ArrowLeft className="h-4 w-4" />
              Beranda
            </Link>
            <div className="flex items-center gap-2">
              <Link to="/catalog" className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]">Katalog</Link>
              <Link to="/cart" className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]">Keranjang</Link>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-[28px] border border-[#263d27]/10 bg-white p-5 shadow-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#263d27]/15 bg-[#eef2e8] px-3 py-1 text-xs font-bold uppercase text-[#263d27]">
                <WandSparkles className="h-4 w-4" />
                Brief custom
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-none lg:text-5xl">Request parfum custom</h1>
              <p className="mt-4 text-sm font-semibold leading-relaxed text-[#6b7280]">
                Cerita aroma, pilihan botol, delivery, dan payment dalam flow yang sama dengan aplikasi mobile.
              </p>
              <div className="mt-4 inline-flex items-center rounded-full bg-[#263d27] px-3 py-1 text-xs font-bold uppercase text-white">
                Pre-order / 7-14 hari
              </div>
              {referenceProduct ? (
                <div className="mt-4 rounded-2xl border border-[#263d27]/10 bg-[#f7f8f2] p-4 text-sm font-bold">
                  Referensi aroma: <span className="text-[#263d27]">{referenceProduct.name}</span>
                </div>
              ) : null}
              <div className="mt-5">
                <div className="flex justify-between text-xs font-bold uppercase text-[#6b7280]">
                  <span>Progress</span>
                  <span>{completion}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f7f8f2]">
                  <div className="h-full rounded-full bg-[#263d27]" style={{ width: `${completion}%` }} />
                </div>
              </div>
              <div className="mt-5">
                <StepRail currentStep={step} steps={stepContent} />
              </div>
            </div>
            <div className="mt-4 rounded-[28px] border border-[#263d27]/10 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0b130c]">
                <Sparkles className="h-4 w-4 text-[#263d27]" />
                Live summary
              </div>
              <div className="mt-4 grid gap-3">
                <SummaryLine label="Nama" value={form.perfumeName || '-'} />
                <SummaryLine label="Aroma" value={form.scentDescription.trim() ? form.scentDescription.slice(0, 58) : '-'} />
                <SummaryLine label="Momen" value={form.occasion} />
                <SummaryLine label="Package" value={budgetSummary} />
                <SummaryLine label="Ongkir" value={shippingSummary || '-'} />
              </div>
            </div>
          </aside>

          <section className="rounded-[28px] border border-[#263d27]/10 bg-white p-5 shadow-sm lg:p-6">
            <header className="border-b border-[#263d27]/10 pb-5">
              <div className="text-xs font-bold uppercase text-[#6b7280]">Langkah {step + 1} dari {stepContent.length}</div>
              <h2 className="mt-2 text-3xl font-bold leading-tight text-[#0b130c]">{activeStep.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">{activeStep.description}</p>
            </header>
            <div className="py-6">
              {activeStep.render()}
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#263d27]/10 pt-5">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-2xl bg-white px-6 text-sm font-bold"
                onClick={() => setStep((current) => Math.max(current - 1, 0))}
                disabled={step === 0 || saving}
              >
                Kembali
              </Button>
              {step < stepContent.length - 1 ? (
                <Button type="button" className="h-12 rounded-2xl gap-2 px-7 text-sm font-bold" onClick={goNext}>
                  Lanjut
                  <ChevronDown className="-rotate-90 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" className="h-12 rounded-2xl gap-2 px-7 text-sm font-bold" onClick={submitRequest} disabled={saving}>
                  {saving ? 'Menyimpan request...' : 'Kirim request'}
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </footer>
          </section>
        </section>
      </main>
    </>
  );
};

export default BespokePage;
