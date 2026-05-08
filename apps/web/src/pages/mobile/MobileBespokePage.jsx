import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, MessageCircle, Send, Sparkles, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import {
  bespokeOccasionOptions,
} from '@/data/storefront.js';
import { useBespokeSettings } from '@/hooks/useBespokeSettings.js';
import { useCatalogProduct } from '@/hooks/useCatalogProducts.js';
import { cn } from '@/lib/utils.js';
import { lookupCustomerByCode } from '@/services/customerService.js';
import { createBespokeRequest } from '@/services/orderService.js';
import { createDokuCheckout } from '@/services/dokuCheckoutService.js';
import { formatRupiah } from '@/services/productCatalogService.js';

const PAYMENT_SESSION_KEY = 'solivagant:doku-payment';

const OptionButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'min-h-[48px] rounded-2xl border px-3 py-2 text-left text-xs font-bold leading-snug transition',
      active
        ? 'border-[#263d27]/30 bg-[#eef2e8] text-[#263d27]'
        : 'border-[#e5e7eb] bg-white text-[#6b7280]'
    )}
  >
    {children}
  </button>
);

const CapMockup = ({ cap, bottle, label }) => {
  const isStone = cap?.value === 'Cap batu';
  const isAcrylic = cap?.value === 'Cap custom akrilik';
  const isSquare = /square|kotak/i.test(`${bottle?.label || ''} ${bottle?.value || ''}`);

  return (
    <div className="relative h-32 overflow-hidden rounded-2xl border border-[#263d27]/10 bg-[#f8f7f4]">
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#d8c8a4]/50 to-transparent" />
      <div className={`absolute left-1/2 top-5 h-20 w-11 -translate-x-1/2 border border-[#263d27]/20 bg-white shadow-sm ${isSquare ? 'rounded-xl' : 'rounded-b-[24px] rounded-t-xl'}`} />
      <div className="absolute left-1/2 top-2 h-7 w-14 -translate-x-1/2 rounded-xl border border-[#263d27]/20 bg-[#1f2937] shadow-sm" />
      {isStone ? <div className="absolute left-1/2 top-1 h-8 w-16 -translate-x-1/2 rounded-[18px] bg-[radial-gradient(circle_at_30%_25%,#f9fafb,#8b8a7c_45%,#2f352f)] shadow-md" /> : null}
      {isAcrylic ? <div className="absolute left-1/2 top-1 h-8 w-16 -translate-x-1/2 rounded-xl bg-[linear-gradient(135deg,rgba(245,158,11,.85),rgba(236,72,153,.75),rgba(59,130,246,.8))] shadow-md" /> : null}
      <div className="absolute left-1/2 top-14 min-w-10 -translate-x-1/2 rounded-lg border border-[#263d27]/10 bg-[#eef2e8] px-2 py-1 text-center text-[9px] font-bold text-[#263d27]">{label?.label || 'Label'}</div>
      <div className="absolute bottom-3 left-3 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-[#263d27]">{bottle?.label || 'Bottle'}</div>
      <div className="absolute bottom-3 right-3 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-[#263d27]">{cap?.label}</div>
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
  const [wizardOpen, setWizardOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [submittedRequest, setSubmittedRequest] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerCode: '',
    scentDescription: referenceProduct?.notes || '',
    occasion: bespokeOccasionOptions[0],
    size: bottleSizeOptions[0]?.value || '',
    bottleType: bottleTypeOptions[0]?.value || '',
    capDesign: capDesignOptions[0]?.value || '',
    labelDesign: labelDesignOptions[0]?.value || '',
    exoticMaterial: '',
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
  const estimatedTotal = Number(selectedSize?.price || 0) + Number(selectedBottleType?.price || 0) + Number(selectedCap?.price || 0) + Number(selectedLabel?.price || 0) + Number(selectedExoticMaterial?.price || 0);
  const budgetSummary = [
    selectedSize ? `${selectedSize.label} bottle` : '',
    selectedBottleType ? `${selectedBottleType.label}${selectedBottleType.price ? ` +${formatRupiah(selectedBottleType.price)}` : ''}` : '',
    selectedCap ? `${selectedCap.label}${selectedCap.price ? ` +${formatRupiah(selectedCap.price)}` : ''}` : '',
    selectedLabel ? `${selectedLabel.label}${selectedLabel.price ? ` +${formatRupiah(selectedLabel.price)}` : ''}` : '',
    selectedExoticMaterial ? `${selectedExoticMaterial.label} +${formatRupiah(selectedExoticMaterial.price)}` : '',
  ].filter(Boolean).join(' / ');

  const lookupCustomer = async () => {
    if (!form.customerCode.trim()) {
      toast.error('Customer code is required');
      return;
    }

    const customer = await lookupCustomerByCode(form.customerCode);
    if (!customer) {
      toast.error('Customer code not found');
      return;
    }

    setForm((current) => ({
      ...current,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      contact: customer.contact,
      deliveryAddress: customer.deliveryAddress || '',
    }));
    toast.success(`${customer.customerCode} loaded`);
  };

  const steps = useMemo(() => [
    {
      key: 'scentDescription',
      title: 'Silakan bercerita',
      description: 'Ceritakan suasana, karakter, orang, tempat, atau memori yang ingin dijadikan aroma.',
      render: () => (
        <textarea
          value={form.scentDescription}
          onChange={(event) => updateField('scentDescription', event.target.value)}
          placeholder="Contoh: aku mau parfum yang terasa clean, dewasa, agak woody, sedikit vanilla, tapi tidak terlalu manis. Cocok untuk kerja dan malam..."
          rows={5}
          className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#263d27]"
        />
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
            <OptionButton key={option.value} active={form.size === option.value} onClick={() => updateField('size', option.value)}>{option.label}</OptionButton>
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
          <CapMockup bottle={selectedBottleType} cap={selectedCap} label={selectedLabel} />
          <div className="grid gap-2">
            {bottleTypeOptions.map((option) => (
              <OptionButton key={option.value} active={form.bottleType === option.value} onClick={() => updateField('bottleType', option.value)}>
                <span className="block text-sm">{option.label}</span>
                <span className="mt-1 block text-[11px] font-semibold opacity-75">{option.description}</span>
                {option.price ? <span className="mt-1 block text-[11px] text-[#263d27]">+{formatRupiah(option.price)}</span> : null}
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
          <CapMockup bottle={selectedBottleType} cap={selectedCap} label={selectedLabel} />
          <div className="grid gap-2">
          {capDesignOptions.map((option) => (
            <OptionButton key={option.value} active={form.capDesign === option.value} onClick={() => updateField('capDesign', option.value)}>
              <span className="block text-sm">{option.label}</span>
              <span className="mt-1 block text-[11px] font-semibold opacity-75">{option.description}</span>
              {option.price ? <span className="mt-1 block text-[11px] text-[#263d27]">+{formatRupiah(option.price)}</span> : null}
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
          <CapMockup bottle={selectedBottleType} cap={selectedCap} label={selectedLabel} />
          <div className="grid gap-2">
            {labelDesignOptions.map((option) => (
              <OptionButton key={option.value} active={form.labelDesign === option.value} onClick={() => updateField('labelDesign', option.value)}>
                <span className="block text-sm">{option.label}</span>
                <span className="mt-1 block text-[11px] font-semibold opacity-75">{option.description}</span>
                {option.price ? <span className="mt-1 block text-[11px] text-[#263d27]">+{formatRupiah(option.price)}</span> : null}
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
        <div className="grid gap-2">
          <OptionButton active={!form.exoticMaterial} onClick={() => updateField('exoticMaterial', '')}>Tanpa material eksotis</OptionButton>
          {exoticMaterialOptions.map((option) => (
            <OptionButton key={option.value} active={form.exoticMaterial === option.value} onClick={() => updateField('exoticMaterial', option.value)}>
              {option.label} {option.price ? `+${formatRupiah(option.price)}` : ''}
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
      description: 'Isi seperti checkout biasa. Customer lama bisa load pakai kode.',
      render: () => (
        <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              value={form.customerCode}
              onChange={(event) => updateField('customerCode', event.target.value.toUpperCase())}
              placeholder="Customer code, e.g. SOLI09232"
              className="h-12 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold uppercase outline-none focus:border-[#263d27]"
            />
            <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-xs font-bold" onClick={lookupCustomer}>Load</Button>
          </div>
          <p className="rounded-2xl bg-white px-3 py-2 text-[11px] font-semibold leading-relaxed text-[#6b7280]">
            Customer baru bisa kosongkan kode. Kode unik dibuat otomatis setelah request tersimpan.
          </p>
          <input
            value={form.customerName}
            onChange={(event) => updateField('customerName', event.target.value)}
            placeholder="Customer name"
            className="h-12 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold outline-none focus:border-[#263d27]"
          />
          <input
            value={form.contact}
            onChange={(event) => updateField('contact', event.target.value)}
            placeholder="WhatsApp or email"
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
  ], [bottleSizeOptions, bottleTypeOptions, budgetSummary, capDesignOptions, estimatedTotal, exoticMaterialOptions, form, labelDesignOptions, selectedBottleType, selectedCap, selectedLabel]);

  const activeStep = steps[step];
  const completion = Math.round(((step + Number(activeStep.isComplete())) / steps.length) * 100);

  const nextStep = () => {
    if (!activeStep.isComplete()) {
      toast.error('Please complete this step first');
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const submitRequest = async () => {
    const incompleteStep = steps.find((item) => !item.isComplete());
    if (incompleteStep) {
      toast.error(`Please complete: ${incompleteStep.title}`);
      setStep(steps.indexOf(incompleteStep));
      return;
    }

    setSaving(true);
    try {
      const order = await createBespokeRequest({
        ...form,
        preferredNotes: form.scentDescription,
        budget: formatRupiah(estimatedTotal),
        totalPrice: estimatedTotal,
        paymentProvider: 'doku',
        referenceProductName: referenceProduct?.name || '',
        referenceProductSlug: referenceProduct?.slug || '',
      });
      const checkout = await createDokuCheckout({
        order,
        amount: estimatedTotal,
        customerName: form.customerName,
        contact: form.contact,
        callbackPath: '/mobile/payment',
      });
      sessionStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify({
        paymentUrl: checkout.paymentUrl,
        invoiceNumber: checkout.invoiceNumber || order.orderNumber,
        orderNumber: order.orderNumber,
        customerCode: order.customerCode || form.customerCode,
        amount: estimatedTotal,
        customerName: form.customerName,
        createdAt: new Date().toISOString(),
      }));

      setSubmittedRequest({
        ...form,
        orderNumber: order.orderNumber,
        customerCode: order.customerCode || form.customerCode,
        budget: formatRupiah(estimatedTotal),
        reference: referenceProduct?.name || '',
        createdAt: new Date().toISOString(),
      });
      setWizardOpen(false);
      toast.success(`Custom perfume request saved to Studio: ${order.orderNumber}`);
      navigate('/mobile/payment');
    } catch (error) {
      toast.error(error.message || 'Failed to save bespoke request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileCommerceLayout>
      <Helmet>
        <title>Bespoke Perfume - Solivagant</title>
        <meta name="description" content="Create a custom perfume request with aroma, bottle size, cap design, exotic materials, and payment preference." />
      </Helmet>
      <main className="mobile-page space-y-4">
        <section className="mobile-soft-card p-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase text-[#263d27]">
            <Sparkles className="h-3.5 w-3.5" />
            Custom brief
          </div>
          <h1 className="mt-3 text-2xl font-bold leading-tight text-[#0b130c]">Buat custom perfume dari cerita dan preferensi aroma.</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
            Isi aroma, ukuran, budget, dan kontak agar tim Solivagant bisa menyiapkan rekomendasi yang pas.
          </p>
          {referenceProduct ? (
            <div className="mt-3 rounded-2xl bg-white p-3 text-xs font-bold text-[#0b130c]">
              Reference scent: <span className="text-[#263d27]">{referenceProduct.name}</span>
            </div>
          ) : null}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[#263d27]" style={{ width: `${completion}%` }} />
          </div>
          <Button type="button" className="mt-4 h-12 w-full rounded-2xl gap-2" onClick={() => setWizardOpen(true)}>
            Start custom wizard
            <Send className="h-4 w-4" />
          </Button>
        </section>

        <section className="mobile-card p-4">
          <h2 className="text-base font-bold text-[#0b130c]">Current brief</h2>
          <div className="mt-3 space-y-2 text-xs font-semibold text-[#6b7280]">
            <p><strong className="text-[#0b130c]">Aroma:</strong> {form.scentDescription || '-'}</p>
            <p><strong className="text-[#0b130c]">Bottle:</strong> {form.size} / {form.bottleType} / {form.capDesign} / {form.labelDesign}</p>
            {selectedExoticMaterial ? <p><strong className="text-[#0b130c]">Material:</strong> {selectedExoticMaterial.label}</p> : null}
            <p><strong className="text-[#0b130c]">Budget:</strong> {formatRupiah(estimatedTotal)}</p>
          </div>
        </section>

        {submittedRequest ? (
          <section className="mobile-card p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-[#0b130c]">Request summary</h2>
                <div className="mt-3 space-y-2 text-xs font-semibold text-[#6b7280]">
                  <p><strong className="text-[#0b130c]">Customer:</strong> {submittedRequest.customerName}</p>
                  <p><strong className="text-[#0b130c]">Customer code:</strong> {submittedRequest.customerCode || '-'}</p>
                  <p><strong className="text-[#0b130c]">Studio order:</strong> {submittedRequest.orderNumber}</p>
                  <p><strong className="text-[#0b130c]">Contact:</strong> {submittedRequest.contact}</p>
                  <p><strong className="text-[#0b130c]">Aroma:</strong> {submittedRequest.scentDescription}</p>
                  <p><strong className="text-[#0b130c]">Bottle:</strong> {submittedRequest.size}, {submittedRequest.bottleType}, {submittedRequest.capDesign}, {submittedRequest.labelDesign}</p>
                  {submittedRequest.exoticMaterial ? <p><strong className="text-[#0b130c]">Material:</strong> {submittedRequest.exoticMaterial}</p> : null}
                  <p><strong className="text-[#0b130c]">Budget:</strong> {submittedRequest.budget}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => navigate('/mobile/catalog')}>
                    <ClipboardList className="h-4 w-4" />
                    Catalog
                  </Button>
                  <Button
                    type="button"
                    className="rounded-2xl gap-2"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${submittedRequest.customerName} / ${submittedRequest.contact}\n${submittedRequest.scentDescription}`);
                      toast.success('Request contact copied');
                    }}
                  >
                    Copy contact
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <MobileBottomSheet
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          title={activeStep.title}
          description={`Step ${step + 1} of ${steps.length}. ${activeStep.description}`}
        >
          <div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-[#263d27]" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
            {activeStep.render()}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="rounded-2xl bg-white" disabled={step === 0} onClick={() => setStep((current) => Math.max(current - 1, 0))}>
                Back
              </Button>
              {step === steps.length - 1 ? (
                <Button type="button" className="rounded-2xl gap-2" onClick={submitRequest} disabled={saving}>
                  {saving ? 'Saving...' : 'Save brief'}
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" className="rounded-2xl" onClick={nextStep}>Next</Button>
              )}
            </div>
          </div>
        </MobileBottomSheet>
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileBespokePage;
