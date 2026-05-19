import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, CreditCard, MessageCircle, Sparkles, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import {
  bespokeOccasionOptions,
} from '@/data/storefront.js';
import { useBespokeSettings } from '@/hooks/useBespokeSettings.js';
import { useCatalogProduct } from '@/hooks/useCatalogProducts.js';
import { cn } from '@/lib/utils.js';
import { checkoutPaymentMethods, getCheckoutPaymentMethod, isManualTransferPayment } from '@/services/cartService.js';
import { lookupCustomerByCode } from '@/services/customerService.js';
import { createBespokeRequest, updateOrderPaymentStatus, updateOrderStatus } from '@/services/orderService.js';
import { createDokuCheckout } from '@/services/dokuCheckoutService.js';
import {
  describeShippingRate,
  getCheckoutShippingWeight,
  getShippingRates,
  searchShippingDestinations,
} from '@/services/shippingService.js';
import { formatRupiah } from '@/services/productCatalogService.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';

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
      <div className={`absolute left-1/2 top-[24%] h-[44%] w-[27%] -translate-x-1/2 border border-[#263d27]/20 bg-white shadow-sm ${isSquare ? 'rounded-xl' : 'rounded-b-[24px] rounded-t-xl'}`} />
      <div className="absolute left-1/2 top-[14%] h-[16%] w-[36%] -translate-x-1/2 rounded-xl border border-[#263d27]/20 bg-[#1f2937] shadow-sm" />
      {isStone ? <div className="absolute left-1/2 top-[10%] h-[18%] w-[42%] -translate-x-1/2 rounded-[18px] bg-[radial-gradient(circle_at_30%_25%,#f9fafb,#8b8a7c_45%,#2f352f)] shadow-md" /> : null}
      {isAcrylic ? <div className="absolute left-1/2 top-[10%] h-[18%] w-[42%] -translate-x-1/2 rounded-xl bg-[linear-gradient(135deg,rgba(245,158,11,.85),rgba(236,72,153,.75),rgba(59,130,246,.8))] shadow-md" /> : null}
      <div className="absolute left-1/2 top-[47%] min-w-10 -translate-x-1/2 rounded-lg border border-[#263d27]/10 bg-[#eef2e8] px-2 py-1 text-center text-[9px] font-bold text-[#263d27]">{label?.label || 'Label'}</div>
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
  const [step, setStep] = useState(0);
  const [submittedRequest, setSubmittedRequest] = useState(null);
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
    customerCode: '',
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

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedSize = bottleSizeOptions.find((option) => option.value === form.size) || bottleSizeOptions[0];
  const selectedBottleType = bottleTypeOptions.find((option) => option.value === form.bottleType) || bottleTypeOptions[0];
  const selectedCap = capDesignOptions.find((option) => option.value === form.capDesign) || capDesignOptions[0];
  const selectedLabel = labelDesignOptions.find((option) => option.value === form.labelDesign) || labelDesignOptions[0];
  const selectedExoticMaterial = exoticMaterialOptions.find((option) => option.value === form.exoticMaterial);
  const selectedPaymentMethod = getCheckoutPaymentMethod(form.paymentMethod);
  const isManualPayment = isManualTransferPayment(selectedPaymentMethod.provider);
  const estimatedTotal = Number(selectedSize?.price || 0) + Number(selectedBottleType?.price || 0) + Number(selectedCap?.price || 0) + Number(selectedLabel?.price || 0) + Number(selectedExoticMaterial?.price || 0);
  const shippingFee = Number(selectedShipping?.cost || 0);
  const totalDue = estimatedTotal + shippingFee;
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
        toast.error('Clipboard kosong. Tekan lama kolom kode untuk tempel manual.');
        return;
      }
      updateField('customerCode', nextCode);
      toast.success('Kode customer ditempel');
    } catch (error) {
      toast.error('Tempel otomatis belum diizinkan browser. Tekan lama kolom kode lalu pilih Tempel.');
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
    const nextValue = String(value || '');
    setDestinationSearch(nextValue);
    resetShipping({ keepSearch: true });
  };

  const chooseShippingCourier = (courierCode) => {
    setSelectedCourier(courierCode);
    setSelectedShipping(null);
    setShippingOptions([]);
    setShippingError('');
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

  const loadShippingRates = async (destination) => {
    setSelectedDestination(destination);
    setDestinationSearch(destination.label);
    setDestinationOptions([]);
    setSelectedShipping(null);
    setShippingOptions([]);
    if (!selectedCourier) {
      setShippingError('Pilih ekspedisi dulu untuk melihat layanan ongkir.');
      return;
    }

    setShippingLoading(true);
    setShippingError('');
    try {
      const rates = await getShippingRates({
        destinationId: destination.id,
        weight: shippingWeight,
        couriers: [selectedCourier],
      });
      setShippingOptions(rates);
      if (!rates.length) {
        setShippingError('Belum ada ongkir untuk area ini');
      }
    } catch (error) {
      setShippingError(getFriendlyShippingError(error, 'Gagal menghitung ongkir. Coba pilih area atau kurir lain.'));
    } finally {
      setShippingLoading(false);
    }
  };

  const autoCalculateShipping = async () => {
    const search = destinationSearch.trim();
    if (search.length < 3) {
      toast.error('Isi area ongkir dulu, contoh: Jakarta Selatan');
      return;
    }
    if (!selectedCourier) {
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
          weight: shippingWeight,
          couriers: [selectedCourier],
        });
        const sortedRates = [...rates].sort((first, second) => Number(first.cost || 0) - Number(second.cost || 0));
        setShippingOptions(sortedRates);
        if (!sortedRates.length) {
          setShippingError('Area ditemukan, tapi ongkir belum tersedia untuk kurir ini. Pilih area lain atau kurir lain.');
        }
        return;
      }

      setSelectedDestination(null);
      const destinations = await searchShippingDestinations(search);
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

  const steps = useMemo(() => [
    {
      key: 'scentDescription',
      title: 'Silakan bercerita',
      description: 'Ceritakan suasana, karakter, orang, tempat, atau memori yang ingin dijadikan aroma.',
      render: () => (
        <div className="space-y-3">
          <textarea
            value={form.scentDescription}
            onChange={(event) => updateField('scentDescription', event.target.value)}
            placeholder="Contoh: clean, dewasa, woody, sedikit vanilla, tidak terlalu manis. Cocok untuk kerja dan malam."
            rows={8}
            className="min-h-[184px] w-full resize-none rounded-2xl border border-[#263d27]/25 bg-white px-4 py-4 text-base font-semibold leading-relaxed text-[#0b130c] outline-none focus:border-[#263d27]"
          />
          <div className="grid grid-cols-2 gap-2">
            {['Bersih', 'Woody', 'Vanila', 'Segar'].map((item) => (
              <button
                key={item}
                type="button"
                className="rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 text-left text-xs font-bold text-[#263d27]"
                onClick={() => updateField('scentDescription', `${form.scentDescription}${form.scentDescription.trim() ? ', ' : ''}${item}`)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ),
      isComplete: () => form.scentDescription.trim().length > 3,
    },
    {
      key: 'occasion',
      title: 'Untuk momen apa?',
      description: 'Ini membantu menentukan karakter dan intensitas.',
      render: () => (
        <div className="grid grid-cols-2 gap-2">
          {bespokeOccasionOptions.map((option) => (
            <OptionButton key={option} active={form.occasion === option} onClick={() => updateField('occasion', option)}>{option}</OptionButton>
          ))}
        </div>
      ),
      isComplete: () => Boolean(form.occasion),
    },
    {
      key: 'size',
      title: 'Pilih ukuran botol',
      description: 'Untuk bespoke saat ini tersedia 30 ml dan 50 ml.',
      render: () => (
        <div className="grid grid-cols-2 gap-2">
          {bottleSizeOptions.map((option) => (
            <OptionButton key={option.value} active={form.size === option.value} imageUrl={option.imageUrl} onClick={() => updateField('size', option.value)}>{option.label}</OptionButton>
          ))}
        </div>
      ),
      isComplete: () => Boolean(form.size),
    },
    {
      key: 'bottleType',
      title: 'Pilih jenis botol',
      description: 'Jenis botol bisa kamu atur dari Studio Bespoke.',
      render: () => (
        <div className="grid gap-3">
          <div className="mx-auto w-full max-w-[280px]">
            <CapMockup bottle={selectedBottleType} cap={selectedCap} label={selectedLabel} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {bottleTypeOptions.map((option) => (
              <OptionButton key={option.value} active={form.bottleType === option.value} imageUrl={option.imageUrl} onClick={() => updateField('bottleType', option.value)}>
                <span className="block text-sm">{option.label}</span>
                <span className="mt-1 block text-[11px] font-semibold opacity-75">{option.description}</span>
              </OptionButton>
            ))}
          </div>
        </div>
      ),
      isComplete: () => Boolean(form.bottleType),
    },
    {
      key: 'capDesign',
      title: 'Pilih desain cap',
      description: 'Mockup sementara. Gambar final bisa diganti nanti.',
      render: () => (
        <div className="grid gap-3">
          <div className="mx-auto w-full max-w-[280px]">
            <CapMockup bottle={selectedBottleType} cap={selectedCap} label={selectedLabel} />
          </div>
          <div className="grid grid-cols-2 gap-2">
          {capDesignOptions.map((option) => (
            <OptionButton key={option.value} active={form.capDesign === option.value} imageUrl={option.imageUrl} onClick={() => updateField('capDesign', option.value)}>
              <span className="block text-sm">{option.label}</span>
              <span className="mt-1 block text-[11px] font-semibold opacity-75">{option.description}</span>
            </OptionButton>
          ))}
          </div>
        </div>
      ),
      isComplete: () => Boolean(form.capDesign),
    },
    {
      key: 'labelDesign',
      title: 'Pilih desain label',
      description: 'Label bisa dibuat minimal atau personal sesuai opsi Studio.',
      render: () => (
        <div className="grid gap-3">
          <div className="mx-auto w-full max-w-[280px]">
            <CapMockup bottle={selectedBottleType} cap={selectedCap} label={selectedLabel} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {labelDesignOptions.map((option) => (
              <OptionButton key={option.value} active={form.labelDesign === option.value} imageUrl={option.imageUrl} onClick={() => updateField('labelDesign', option.value)}>
                <span className="block text-sm">{option.label}</span>
                <span className="mt-1 block text-[11px] font-semibold opacity-75">{option.description}</span>
              </OptionButton>
            ))}
          </div>
        </div>
      ),
      isComplete: () => Boolean(form.labelDesign),
    },
    ...(exoticMaterialOptions.length ? [{
      key: 'exoticMaterial',
      title: 'Material eksotis',
      description: 'Material ini mengikuti daftar yang aktif dari Studio.',
      render: () => (
        <div className="grid grid-cols-2 gap-2">
          <OptionButton active={!form.exoticMaterial} onClick={() => updateField('exoticMaterial', '')}>Tanpa material eksotis</OptionButton>
          {exoticMaterialOptions.map((option) => (
            <OptionButton key={option.value} active={form.exoticMaterial === option.value} imageUrl={option.imageUrl} onClick={() => updateField('exoticMaterial', option.value)}>
              {option.label}
            </OptionButton>
          ))}
        </div>
      ),
      isComplete: () => true,
    }] : []),
    {
      key: 'budget',
      title: 'Budget estimate',
      description: 'Total mengikuti ukuran, cap, dan material tambahan.',
      render: () => (
        <div className="rounded-2xl border border-[#263d27]/10 bg-white p-4">
          <div className="text-[10px] font-bold uppercase text-[#6b7280]">Estimasi custom perfume</div>
          <div className="mt-2 text-3xl font-bold text-[#0b130c]">{formatRupiah(estimatedTotal)}</div>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b7280]">{budgetSummary}</p>
        </div>
      ),
      isComplete: () => estimatedTotal > 0,
    },
    {
      key: 'contact',
      title: 'Data pengiriman',
      description: 'Isi seperti checkout biasa. Pembeli lama bisa dicek pakai kode.',
      render: () => (
        <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <input
              value={form.customerCode}
              onChange={(event) => updateField('customerCode', event.target.value.toUpperCase())}
              placeholder="Kode customer, contoh SOLI09232"
              className="h-12 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold uppercase outline-none focus:border-[#263d27]"
            />
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-3 text-xs font-bold" onClick={pasteCustomerCode}>Tempel</Button>
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={lookupCustomer}>Cek</Button>
          </div>
          <p className="rounded-2xl bg-white px-3 py-2 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
            Pembeli baru bisa kosongkan kode. Kode unik dibuat otomatis setelah request tersimpan.
          </p>
          <input
            value={form.customerName}
            onChange={(event) => updateField('customerName', event.target.value)}
            placeholder="Nama pembeli"
            className="h-12 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold outline-none focus:border-[#263d27]"
          />
          <input
            value={form.contact}
            onChange={(event) => updateField('contact', event.target.value)}
            placeholder="Nomor WhatsApp / telepon"
            inputMode="tel"
            autoComplete="tel"
            className="h-12 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold outline-none focus:border-[#263d27]"
          />
          <textarea
            value={form.deliveryAddress}
            onChange={(event) => updateField('deliveryAddress', event.target.value)}
            placeholder="Alamat lengkap pengiriman"
            rows={3}
            className="rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#263d27]"
          />
        </div>
      ),
      isComplete: () => form.customerName.trim() && form.contact.trim() && form.deliveryAddress.trim(),
    },
    {
      key: 'shipping',
      title: 'Pilih ongkir',
      description: 'Cari area RajaOngkir, pilih ekspedisi, lalu pilih layanan pengiriman.',
      render: () => (
        <div className="grid gap-3">
          <div className="rounded-2xl border border-[#263d27]/10 bg-white p-4 text-xs font-bold text-[#263d27]">
            <div className="flex items-center justify-between gap-3">
              <span>Budget parfum</span>
              <span>{formatRupiah(estimatedTotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[#1f2937]">
              <span>Ongkir</span>
              <span>{shippingFee ? formatRupiah(shippingFee) : '-'}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#263d27]/10 pt-3 text-sm">
              <span>Total bayar</span>
              <span>{formatRupiah(totalDue)}</span>
            </div>
          </div>
          <div className="grid gap-2">
            <div className="text-[10px] font-bold uppercase text-[#263d27]">Kecamatan / kota tujuan</div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={destinationSearch}
                onChange={(event) => updateDestinationSearch(event.target.value)}
                placeholder="Contoh: Kebayoran Baru"
                className="h-12 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold outline-none focus:border-[#263d27]"
              />
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-3 text-xs font-bold" onClick={searchDestinations} disabled={shippingLoading || destinationSearch.trim().length < 3}>
                Cari area
              </Button>
            </div>
            <p className="rounded-2xl bg-white px-3 py-2 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
              Alamat lengkap tetap diambil dari step data pengiriman. Kolom ini hanya untuk menemukan tarif ongkir.
            </p>
          </div>
          <select
            value={selectedCourier}
            onChange={(event) => chooseShippingCourier(event.target.value)}
            className="h-12 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-bold text-[#1f2937] outline-none focus:border-[#263d27]"
          >
            <option value="">Pilih kurir</option>
            {checkoutCourierOptions.map((courier) => (
              <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
            ))}
          </select>
          <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={autoCalculateShipping} disabled={shippingLoading || destinationSearch.trim().length < 3 || !selectedCourier}>
            {shippingLoading ? 'Menghitung ongkir...' : selectedDestination ? 'Tampilkan layanan ongkir' : 'Cari area ongkir'}
          </Button>
          {selectedDestination ? (
            <p className="rounded-2xl bg-[#eef2e8] px-3 py-2 text-[11px] font-bold text-[#263d27]">
              Area ongkir: {selectedDestination.label}
            </p>
          ) : null}
          {destinationOptions.length ? (
            <div className="grid gap-2">
              <div className="text-[10px] font-bold uppercase text-[#263d27]">Pilih area tujuan</div>
              {destinationOptions.map((destination) => (
                <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)} className="rounded-2xl border border-[#263d27]/10 bg-white px-3 py-2 text-left text-xs font-bold text-[#263d27]">
                  {destination.label}
                </button>
              ))}
            </div>
          ) : null}
          {visibleShippingOptions.length ? (
            <div className="grid gap-2">
              <div className="text-[10px] font-bold uppercase text-[#263d27]">Harga {courierLabels[selectedCourier] || 'ekspedisi'}</div>
              {visibleShippingOptions.map((rate) => {
                const active = selectedShipping?.courierCode === rate.courierCode && selectedShipping?.service === rate.service;
                return (
                  <button key={`${rate.courierCode}-${rate.service}-${rate.cost}`} type="button" onClick={() => setSelectedShipping(rate)} className={cn('rounded-2xl border px-3 py-3 text-left transition', active ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-white')}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[#1f2937]">{courierLabels[rate.courierCode] || rate.courierName} {rate.serviceLabel || rate.service}</span>
                      <span className="text-sm font-bold text-[#263d27]">{formatRupiah(rate.cost)}</span>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-[#6b7280]">{rate.etd ? `ETA ${rate.etd}` : rate.description || 'Estimasi mengikuti kurir'}</p>
                  </button>
                );
              })}
            </div>
          ) : null}
          {shippingError ? <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">{shippingError}</p> : null}
        </div>
      ),
      isComplete: () => Boolean(selectedDestination && selectedCourier && selectedShipping),
    },
    {
      key: 'payment',
      title: 'Pilih metode bayar',
      description: 'Pilih DOKU untuk pembayaran digital, atau BCA untuk transfer manual dengan upload bukti.',
      render: () => (
        <div className="grid gap-2">
          {checkoutPaymentMethods.map((method) => {
            const active = form.paymentMethod === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => updateField('paymentMethod', method.id)}
                className={cn(
                  'rounded-2xl border px-4 py-4 text-left transition',
                  active ? 'border-[#263d27] bg-[#eef2e8] text-[#263d27]' : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-[#0b130c]">{method.label}</span>
                  {active ? <span className="rounded-full bg-[#263d27] px-2 py-1 text-[9px] font-bold uppercase text-white">Dipilih</span> : null}
                </div>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed">{method.description}</p>
                {method.accountNumber ? (
                  <div className="mt-3 rounded-2xl bg-white/80 px-3 py-2 text-[11px] font-bold text-[#263d27]">
                    {method.bankName} {method.accountNumber} / A/N {method.accountName}
                  </div>
                ) : null}
              </button>
            );
          })}
          <div className="rounded-2xl border border-[#263d27]/10 bg-white px-4 py-3 text-xs font-bold text-[#263d27]">
            Total bayar: {formatRupiah(totalDue)}
          </div>
        </div>
      ),
      isComplete: () => Boolean(form.paymentMethod),
    },
  ], [bottleSizeOptions, bottleTypeOptions, budgetSummary, capDesignOptions, destinationOptions, destinationSearch, estimatedTotal, exoticMaterialOptions, form, labelDesignOptions, selectedBottleType, selectedCap, selectedCourier, selectedDestination, selectedLabel, selectedShipping, shippingError, shippingFee, shippingLoading, totalDue, visibleShippingOptions]);

  const flowSteps = useMemo(() => [
    {
      key: 'aroma',
      title: 'Brief aroma',
      shortLabel: 'Aroma',
      description: 'Ceritakan arah aroma, lalu pilih momen pemakaian.',
      render: () => (
        <div className="grid gap-3">
          <textarea
            value={form.scentDescription}
            onChange={(event) => updateField('scentDescription', event.target.value)}
            placeholder="Contoh: bersih, dewasa, woody, sedikit vanila, tidak terlalu manis."
            rows={3}
            className="mobile-commerce-control min-h-[96px] w-full resize-none px-3 py-3 text-sm font-semibold leading-relaxed text-[#0b130c]"
          />
          <div className="grid grid-cols-4 gap-1.5">
            {['Bersih', 'Woody', 'Vanila', 'Segar'].map((item) => (
              <button
                key={item}
                type="button"
                className="mobile-commerce-choice px-2 py-2 text-center text-[10px] font-bold text-[#263d27]"
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
                  form.occasion === option ? 'border-[#263d27]/30 bg-[#eef2e8] text-[#263d27]' : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ),
      isComplete: () => form.scentDescription.trim().length > 3 && Boolean(form.occasion),
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
              <div className="text-[10px] font-bold uppercase text-[#263d27]">Material eksotis</div>
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
            <div className="grid content-start gap-2 text-xs font-bold text-[#263d27]">
              <div className="rounded-2xl bg-[#eef2e8] px-3 py-2">{selectedBottleType?.label || 'Botol'}</div>
              <div className="rounded-2xl bg-white px-3 py-2">{selectedCap?.label || 'Cap'}</div>
              <div className="rounded-2xl bg-white px-3 py-2">{selectedLabel?.label || 'Label'}</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-[#263d27]">Botol</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {bottleTypeOptions.map((option) => (
                <OptionButton key={option.value} active={form.bottleType === option.value} imageUrl={option.imageUrl} onClick={() => updateField('bottleType', option.value)}>{option.label}</OptionButton>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-[#263d27]">Cap</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {capDesignOptions.map((option) => (
                <OptionButton key={option.value} active={form.capDesign === option.value} imageUrl={option.imageUrl} onClick={() => updateField('capDesign', option.value)}>{option.label}</OptionButton>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-[#263d27]">Label</div>
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
      description: 'Isi data penerima, cari area, lalu pilih layanan ongkir.',
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
            <select value={selectedCourier} onChange={(event) => chooseShippingCourier(event.target.value)} className="mobile-commerce-control h-12 px-3 text-sm font-bold text-[#1f2937]">
              <option value="">Pilih kurir</option>
              {checkoutCourierOptions.map((courier) => (
                <option key={courier.courierCode} value={courier.courierCode}>{courier.label}</option>
              ))}
            </select>
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={autoCalculateShipping} disabled={shippingLoading || destinationSearch.trim().length < 3 || !selectedCourier}>
              {shippingLoading ? 'Menghitung...' : selectedDestination ? 'Tampilkan ongkir' : 'Cari ongkir'}
            </Button>
          </div>
          {selectedDestination ? <p className="rounded-2xl bg-[#eef2e8] px-3 py-2 text-[11px] font-bold text-[#263d27]">Area: {selectedDestination.label}</p> : null}
          {destinationOptions.length ? (
            <div className="grid gap-2">
              {destinationOptions.map((destination) => (
                <button key={destination.id} type="button" onClick={() => loadShippingRates(destination)} className="mobile-commerce-choice px-3 py-2 text-xs font-bold text-[#263d27]">{destination.label}</button>
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
                      <span className="text-sm font-bold text-[#263d27]">{formatRupiah(rate.cost)}</span>
                    </div>
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
          <div className="mobile-commerce-summary p-4 text-xs font-bold text-[#263d27]">
            <div className="flex justify-between gap-3"><span>Custom perfume</span><span>{formatRupiah(estimatedTotal)}</span></div>
            <div className="mt-2 flex justify-between gap-3 text-[#6b7280]"><span>Ongkir</span><span>{shippingFee ? formatRupiah(shippingFee) : '-'}</span></div>
            <div className="mt-3 flex justify-between gap-3 border-t border-[#263d27]/10 pt-3 text-sm text-[#0b130c]"><span>Total bayar</span><span>{formatRupiah(totalDue)}</span></div>
            <p className="mt-3 text-[11px] font-semibold leading-relaxed text-[#6b7280]">{budgetSummary}</p>
          </div>
          {checkoutPaymentMethods.map((method) => {
            const active = form.paymentMethod === method.id;
            return (
              <button key={method.id} type="button" onClick={() => updateField('paymentMethod', method.id)} className={cn('mobile-commerce-choice px-4 py-4', active ? 'is-active' : 'text-[#6b7280]')}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-[#0b130c]">{method.label}</span>
                  {active ? <span className="rounded-full bg-[#263d27] px-2 py-1 text-[9px] font-bold uppercase text-white">Dipilih</span> : null}
                </div>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed">{method.description}</p>
                {method.accountNumber ? <div className="mobile-commerce-panel mt-3 border-0 bg-white/80 px-3 py-2 text-[11px] font-bold text-[#263d27]">{method.bankName} {method.accountNumber} / A/N {method.accountName}</div> : null}
              </button>
            );
          })}
        </div>
      ),
      isComplete: () => Boolean(form.paymentMethod),
    },
  ], [bottleSizeOptions, bottleTypeOptions, budgetSummary, capDesignOptions, destinationOptions, destinationSearch, estimatedTotal, exoticMaterialOptions, form, labelDesignOptions, selectedBottleType, selectedCap, selectedCourier, selectedDestination, selectedLabel, selectedShipping, shippingError, shippingFee, shippingLoading, totalDue, visibleShippingOptions]);

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
      const order = await createBespokeRequest({
        ...form,
        deliveryArea: selectedDestination?.label || destinationSearch,
        preferredNotes: form.scentDescription,
        budget: formatRupiah(estimatedTotal),
        itemPrice: estimatedTotal,
        estimatedTotal,
        shippingFee,
        shippingSummary,
        totalPrice: totalDue,
        paymentProvider: selectedPaymentMethod.provider,
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
          amount: totalDue,
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
          amount: totalDue,
          customerName: form.customerName,
          paymentStatus: 'pending',
          manualTransfer: manualPaymentResponse,
          shippingSummary,
          shippingFee,
          createdAt: new Date().toISOString(),
        }));

        setSubmittedRequest({
          ...form,
          orderNumber: order.orderNumber,
          customerCode: order.customerCode || form.customerCode,
          budget: formatRupiah(estimatedTotal),
          shipping: shippingSummary,
          shippingFee,
          totalDue: formatRupiah(totalDue),
          reference: referenceProduct?.name || '',
          createdAt: new Date().toISOString(),
        });
        toast.success(`Custom perfume request saved to Studio: ${order.orderNumber}`);
        navigate(`/mobile/payment?order=${encodeURIComponent(order.orderNumber)}&payment=manual`);
        return;
      }

      const checkout = await createDokuCheckout({
        order,
        amount: totalDue,
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
        amount: totalDue,
        customerName: form.customerName,
        paymentStatus: 'pending',
        paymentExpiresAt: checkout.paymentExpiresAt || '',
        paymentSessionId: checkout.paymentSessionId || '',
        shippingSummary,
        shippingFee,
        createdAt: new Date().toISOString(),
      }));

      setSubmittedRequest({
        ...form,
        orderNumber: order.orderNumber,
        customerCode: order.customerCode || form.customerCode,
        budget: formatRupiah(estimatedTotal),
        shipping: shippingSummary,
        shippingFee,
        totalDue: formatRupiah(totalDue),
        reference: referenceProduct?.name || '',
        createdAt: new Date().toISOString(),
      });
      toast.success(`Custom perfume request saved to Studio: ${order.orderNumber}`);
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
          <h1 className="mt-1.5 text-lg font-bold leading-tight text-[#0b130c]">Request parfum custom.</h1>
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
            Cerita aroma, pilihan botol, delivery, dan payment dalam flow singkat.
          </p>
          {referenceProduct ? (
            <div className="mobile-commerce-panel mt-3 border-0 p-3 text-xs font-bold text-[#0b130c]">
              Referensi aroma: <span className="text-[#263d27]">{referenceProduct.name}</span>
            </div>
          ) : null}
        </section>

        <section className="mobile-bespoke-wizard mobile-card overflow-hidden">
          <header className="border-b border-[#263d27]/10 bg-white px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#263d27]">Langkah {step + 1} dari {flowSteps.length}</p>
                <h2 className="mt-1 text-base font-bold text-[#0b130c]">{activeStep.title}</h2>
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
                    index === step ? 'bg-[#263d27] text-white' : item.isComplete() ? 'bg-[#eef2e8] text-[#263d27]' : 'bg-[#f8f7f4] text-[#6b7280]'
                  )}
                >
                  {item.shortLabel}
                </button>
              ))}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eef2e8]">
              <div className="h-full rounded-full bg-[#263d27]" style={{ width: `${((step + 1) / flowSteps.length) * 100}%` }} />
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
                <h2 className="text-sm font-bold text-[#0b130c]">Brief ringkas</h2>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-[#6b7280]">{form.scentDescription || 'Aroma belum diisi.'}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-bold uppercase text-[#8b949e]">Total</div>
                <div className="text-sm font-bold text-[#263d27]">{formatRupiah(totalDue)}</div>
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
                <h2 className="text-base font-bold text-[#0b130c]">Ringkasan request</h2>
                <div className="mt-3 space-y-2 text-xs font-semibold text-[#6b7280]">
                  <p><strong className="text-[#0b130c]">Pembeli:</strong> {submittedRequest.customerName}</p>
                  <p><strong className="text-[#0b130c]">Kode customer:</strong> {submittedRequest.customerCode || '-'}</p>
                  <p><strong className="text-[#0b130c]">Studio order:</strong> {submittedRequest.orderNumber}</p>
                  <p><strong className="text-[#0b130c]">Kontak:</strong> {submittedRequest.contact}</p>
                  <p><strong className="text-[#0b130c]">Aroma:</strong> {submittedRequest.scentDescription}</p>
                  <p><strong className="text-[#0b130c]">Botol:</strong> {submittedRequest.size}, {submittedRequest.bottleType}, {submittedRequest.capDesign}, {submittedRequest.labelDesign}</p>
                  {submittedRequest.exoticMaterial ? <p><strong className="text-[#0b130c]">Material:</strong> {submittedRequest.exoticMaterial}</p> : null}
                  <p><strong className="text-[#0b130c]">Budget:</strong> {submittedRequest.budget}</p>
                  <p><strong className="text-[#0b130c]">Ongkir:</strong> {submittedRequest.shipping || '-'}</p>
                  <p><strong className="text-[#0b130c]">Total bayar:</strong> {submittedRequest.totalDue || submittedRequest.budget}</p>
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
          contentClassName="rounded-2xl border-[#263d27]/10 bg-white/95"
        >
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="rounded-2xl bg-white" disabled={step === 0} onClick={() => setStep((current) => Math.max(current - 1, 0))}>
              Kembali
            </Button>
            {step === flowSteps.length - 1 ? (
              <Button type="button" className="rounded-2xl gap-2" onClick={submitRequest} disabled={saving}>
                {saving ? 'Memproses...' : (isManualPayment ? 'Buat pesanan & upload bukti' : 'Bayar sekarang')}
                {isManualPayment ? <CheckCircle2 className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              </Button>
            ) : (
              <Button type="button" className="rounded-2xl" onClick={nextStep}>Lanjut</Button>
            )}
          </div>
        </StickyBottomActionBar>

      </main>
    </MobileCommerceLayout>
  );
};

export default MobileBespokePage;
