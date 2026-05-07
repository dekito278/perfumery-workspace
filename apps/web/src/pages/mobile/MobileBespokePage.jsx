import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, MessageCircle, MessageSquareHeart, Send, Sparkles, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.jsx';
import {
  bespokeBudgetOptions,
  bespokeCapOptions,
  bespokeExoticMaterialOptions,
  bespokeOccasionOptions,
  bespokeSizeOptions,
  paymentProviderOptions,
  feedbackFlowSteps,
} from '@/data/storefront.js';
import { useCatalogProduct } from '@/hooks/useCatalogProducts.js';
import { cn } from '@/lib/utils.js';

const OptionButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'min-h-[48px] rounded-2xl border px-3 py-2 text-left text-xs font-bold leading-snug transition',
      active
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : 'border-[#e5e7eb] bg-white text-[#6b7280]'
    )}
  >
    {children}
  </button>
);

const MobileBespokePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referenceProduct = useCatalogProduct(searchParams.get('reference'));
  const [wizardOpen, setWizardOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [submittedRequest, setSubmittedRequest] = useState(null);
  const [form, setForm] = useState({
    scentDescription: referenceProduct?.notes || '',
    occasion: bespokeOccasionOptions[0],
    size: bespokeSizeOptions[1],
    capDesign: bespokeCapOptions[0],
    exoticMaterial: bespokeExoticMaterialOptions[0],
    budget: bespokeBudgetOptions[1],
    customerName: '',
    contact: '',
    paymentProvider: 'manual',
  });

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const steps = useMemo(() => [
    {
      key: 'scentDescription',
      title: 'Deskripsi aroma',
      description: 'Ceritakan aroma yang kamu bayangkan.',
      render: () => (
        <textarea
          value={form.scentDescription}
          onChange={(event) => updateField('scentDescription', event.target.value)}
          placeholder="Contoh: woody clean, sedikit vanilla, tidak terlalu manis..."
          rows={5}
          className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
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
      description: 'Mulai dari trial sampai full bottle.',
      render: () => (
        <div className="grid gap-2">
          {bespokeSizeOptions.map((option) => (
            <OptionButton key={option} active={form.size === option} onClick={() => updateField('size', option)}>{option}</OptionButton>
          ))}
        </div>
      ),
      isComplete: () => Boolean(form.size),
    },
    {
      key: 'capDesign',
      title: 'Pilih desain cap',
      description: 'Untuk arah packaging awal.',
      render: () => (
        <div className="grid grid-cols-2 gap-2">
          {bespokeCapOptions.map((option) => (
            <OptionButton key={option} active={form.capDesign === option} onClick={() => updateField('capDesign', option)}>{option}</OptionButton>
          ))}
        </div>
      ),
      isComplete: () => Boolean(form.capDesign),
    },
    {
      key: 'exoticMaterial',
      title: 'Material eksotis',
      description: 'Pilih aksen khusus bila dibutuhkan.',
      render: () => (
        <div className="grid gap-2">
          {bespokeExoticMaterialOptions.map((option) => (
            <OptionButton key={option} active={form.exoticMaterial === option} onClick={() => updateField('exoticMaterial', option)}>{option}</OptionButton>
          ))}
        </div>
      ),
      isComplete: () => Boolean(form.exoticMaterial),
    },
    {
      key: 'budget',
      title: 'Budget',
      description: 'Budget membantu menentukan material dan ukuran.',
      render: () => (
        <div className="grid gap-2">
          {bespokeBudgetOptions.map((option) => (
            <OptionButton key={option} active={form.budget === option} onClick={() => updateField('budget', option)}>{option}</OptionButton>
          ))}
        </div>
      ),
      isComplete: () => Boolean(form.budget),
    },
    {
      key: 'contact',
      title: 'Kontak customer',
      description: 'Supaya tim Dekito bisa follow-up request.',
      render: () => (
        <div className="grid gap-2">
          <input
            value={form.customerName}
            onChange={(event) => updateField('customerName', event.target.value)}
            placeholder="Customer name"
            className="h-12 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300"
          />
          <input
            value={form.contact}
            onChange={(event) => updateField('contact', event.target.value)}
            placeholder="WhatsApp or email"
            className="h-12 rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300"
          />
        </div>
      ),
      isComplete: () => form.customerName.trim() && form.contact.trim(),
    },
    {
      key: 'paymentProvider',
      title: 'Metode pembayaran',
      description: 'Pilih cara follow-up pembayaran untuk request ini.',
      render: () => (
        <div className="grid gap-2">
          {paymentProviderOptions.map((option) => (
            <OptionButton key={option.value} active={form.paymentProvider === option.value} onClick={() => updateField('paymentProvider', option.value)}>
              <span className="block text-sm">{option.label}</span>
              <span className="mt-1 block text-[11px] font-semibold opacity-75">{option.description}</span>
            </OptionButton>
          ))}
        </div>
      ),
      isComplete: () => Boolean(form.paymentProvider),
    },
  ], [form]);

  const activeStep = steps[step];
  const completion = Math.round(((step + Number(activeStep.isComplete())) / steps.length) * 100);
  const selectedPayment = paymentProviderOptions.find((option) => option.value === form.paymentProvider);

  const nextStep = () => {
    if (!activeStep.isComplete()) {
      toast.error('Please complete this step first');
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const submitRequest = () => {
    const incompleteStep = steps.find((item) => !item.isComplete());
    if (incompleteStep) {
      toast.error(`Please complete: ${incompleteStep.title}`);
      setStep(steps.indexOf(incompleteStep));
      return;
    }

    setSubmittedRequest({
      ...form,
      reference: referenceProduct?.name || '',
      createdAt: new Date().toISOString(),
    });
    setWizardOpen(false);
    toast.success('Custom perfume request saved');
  };

  return (
    <MobileCommerceLayout>
      <Helmet>
        <title>Bespoke Perfume - Dekito Perfumery</title>
        <meta name="description" content="Create a custom perfume request with aroma, bottle size, cap design, exotic materials, and payment preference." />
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar
          title="Custom perfume"
          subtitle={`${completion}% complete`}
          eyebrow="Bespoke"
          onBack={() => navigate('/mobile/dashboard')}
          action={<WandSparkles className="h-5 w-5 text-amber-700" />}
        />

        <section className="mobile-soft-card p-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase text-amber-700">
            <Sparkles className="h-3.5 w-3.5" />
            Custom brief
          </div>
          <h1 className="mt-3 text-2xl font-bold leading-tight text-[#1f2937]">Buat custom perfume dari cerita dan preferensi aroma.</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
            Isi aroma, ukuran, budget, dan kontak agar tim Dekito bisa menyiapkan rekomendasi yang pas.
          </p>
          {referenceProduct ? (
            <div className="mt-3 rounded-2xl bg-white p-3 text-xs font-bold text-[#1f2937]">
              Reference scent: <span className="text-amber-700">{referenceProduct.name}</span>
            </div>
          ) : null}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${completion}%` }} />
          </div>
          <Button type="button" className="mt-4 h-12 w-full rounded-2xl gap-2" onClick={() => setWizardOpen(true)}>
            Start custom wizard
            <Send className="h-4 w-4" />
          </Button>
        </section>

        <section className="mobile-card p-4">
          <h2 className="text-base font-bold text-[#1f2937]">Current brief</h2>
          <div className="mt-3 space-y-2 text-xs font-semibold text-[#6b7280]">
            <p><strong className="text-[#1f2937]">Aroma:</strong> {form.scentDescription || '-'}</p>
            <p><strong className="text-[#1f2937]">Bottle:</strong> {form.size} / {form.capDesign}</p>
            <p><strong className="text-[#1f2937]">Material:</strong> {form.exoticMaterial}</p>
            <p><strong className="text-[#1f2937]">Payment rail:</strong> {selectedPayment?.label}</p>
          </div>
        </section>

        <section className="mobile-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-700">
              <MessageSquareHeart className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-[#1f2937]">After-sample feedback</h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6b7280]">
                Setelah sample dicoba, feedback bisa dipakai untuk revisi aroma atau final bottle.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {feedbackFlowSteps.map((item, index) => (
              <div key={item.title} className="rounded-2xl bg-[#fbfaf7] p-3 text-xs font-semibold text-[#6b7280]">
                <span className="font-bold text-[#1f2937]">{index + 1}. {item.title}</span>
                <span className="mt-1 block">{item.description}</span>
              </div>
            ))}
          </div>
        </section>

        {submittedRequest ? (
          <section className="mobile-card p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-[#1f2937]">Request summary</h2>
                <div className="mt-3 space-y-2 text-xs font-semibold text-[#6b7280]">
                  <p><strong className="text-[#1f2937]">Customer:</strong> {submittedRequest.customerName}</p>
                  <p><strong className="text-[#1f2937]">Contact:</strong> {submittedRequest.contact}</p>
                  <p><strong className="text-[#1f2937]">Aroma:</strong> {submittedRequest.scentDescription}</p>
                  <p><strong className="text-[#1f2937]">Bottle:</strong> {submittedRequest.size}, {submittedRequest.capDesign}</p>
                  <p><strong className="text-[#1f2937]">Material:</strong> {submittedRequest.exoticMaterial}</p>
                  <p><strong className="text-[#1f2937]">Payment:</strong> {selectedPayment?.label}</p>
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

        <Sheet open={wizardOpen} onOpenChange={setWizardOpen}>
          <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-[28px] border-0 bg-[#fbfaf7] p-4">
            <SheetHeader className="pr-8 text-left">
              <SheetTitle>{activeStep.title}</SheetTitle>
              <SheetDescription>Step {step + 1} of {steps.length}. {activeStep.description}</SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
              </div>
              {activeStep.render()}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="rounded-2xl bg-white" disabled={step === 0} onClick={() => setStep((current) => Math.max(current - 1, 0))}>
                  Back
                </Button>
                {step === steps.length - 1 ? (
                  <Button type="button" className="rounded-2xl gap-2" onClick={submitRequest}>
                    Save brief
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" className="rounded-2xl" onClick={nextStep}>Next</Button>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </main>
    </MobileCommerceLayout>
  );
};

export default MobileBespokePage;
