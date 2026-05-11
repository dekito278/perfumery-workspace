import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MessageSquareHeart, Send, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  bespokeBudgetOptions,
  bespokeMoodOptions,
  bespokeOccasionOptions,
  bespokeSizeOptions,
  feedbackFlowSteps,
} from '@/data/storefront.js';
import { useCatalogProduct } from '@/hooks/useCatalogProducts.js';
import { cn } from '@/lib/utils.js';
import { Button } from '@/components/ui/button.jsx';
import { lookupCustomerByCode } from '@/services/customerService.js';
import { createBespokeRequest } from '@/services/orderService.js';

const OptionGrid = ({ options, value, onChange }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {options.map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(option)}
        className={cn(
          'min-h-[44px] rounded-2xl border px-4 py-2 text-left text-sm font-bold',
          value === option ? 'border-[#263d27]/30 bg-[#eef2e8] text-[#263d27]' : 'border-stone-200 bg-white text-muted-foreground'
        )}
      >
        {option}
      </button>
    ))}
  </div>
);

const BespokePage = () => {
  const [searchParams] = useSearchParams();
  const referenceProduct = useCatalogProduct(searchParams.get('reference'));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null);
  const [form, setForm] = useState({
    customerCode: '',
    name: '',
    contact: '',
    mood: referenceProduct?.mood || bespokeMoodOptions[0],
    occasion: bespokeOccasionOptions[0],
    budget: bespokeBudgetOptions[1],
    size: bespokeSizeOptions[1],
    preferredNotes: referenceProduct?.notes || '',
    avoidedNotes: '',
    story: '',
  });

  const completion = useMemo(() => {
    const required = ['name', 'contact', 'mood', 'occasion', 'budget', 'size', 'preferredNotes'];
    return Math.round((required.filter((key) => String(form[key] || '').trim()).length / required.length) * 100);
  }, [form]);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const lookupCustomer = async () => {
    if (!form.customerCode.trim()) {
      toast.error('Customer code is required');
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
      name: customer.customerName,
      contact: customer.contact,
    }));
    toast.success(`${customer.customerCode} loaded`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.contact.trim() || !form.preferredNotes.trim()) {
      toast.error('Please fill name, contact, and preferred notes');
      return;
    }

    setSaving(true);
    try {
      const order = await createBespokeRequest({
        ...form,
        customerName: form.name,
        customerCode: form.customerCode,
        referenceProductName: referenceProduct?.name || '',
        referenceProductSlug: referenceProduct?.slug || '',
      });
      setSubmitted(true);
      setSavedOrder(order);
      toast.success(`Custom perfume request saved to Studio: ${order.orderNumber}`);
    } catch (error) {
      toast.error(error.message || 'Failed to save bespoke request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Bespoke Perfume - Solivagant</title>
        <meta name="description" content="Create a bespoke perfume request for Solivagant." />
      </Helmet>
      <main className="min-h-screen bg-[#f7f8f2] text-[#0b130c]">
        <section className="border-b border-[#263d27]/15 bg-[#050705] text-[#eef2e8]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/home" className="inline-flex items-center gap-2 text-sm font-bold text-[#eef2e8]">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
            <Link to="/catalog" className="rounded-2xl border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-[#eef2e8]">Catalog</Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#263d27]/15 bg-white px-3 py-1 text-xs font-bold uppercase text-[#263d27]">
              <WandSparkles className="h-4 w-4" />
              Bespoke perfume
            </div>
            <h1 className="mt-5 text-5xl font-bold leading-none">Custom scent request</h1>
            <p className="mt-5 text-base font-medium leading-relaxed text-muted-foreground">
              Tell us the mood, notes, budget, and size you want. We will turn it into a personal perfume brief.
            </p>
            {referenceProduct ? (
              <div className="mt-5 rounded-2xl border bg-white p-4 text-sm font-bold">
                Reference scent: <span className="text-[#263d27]">{referenceProduct.name}</span>
              </div>
            ) : null}
            <div className="mt-6 rounded-2xl border bg-white p-4">
              <div className="flex justify-between text-xs font-bold uppercase text-muted-foreground">
                <span>Completion</span>
                <span>{completion}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-[#263d27]" style={{ width: `${completion}%` }} />
              </div>
            </div>
            <div className="mt-5 rounded-2xl border bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0b130c]">
                <MessageSquareHeart className="h-4 w-4 text-rose-600" />
                Feedback after sample
              </div>
              <div className="mt-3 grid gap-2">
                {feedbackFlowSteps.map((step, index) => (
                  <div key={step.title} className="rounded-2xl bg-[#f7f8f2] p-3 text-xs font-semibold text-muted-foreground">
                    <span className="font-bold text-[#0b130c]">{index + 1}. {step.title}</span>
                    <span className="mt-1 block">{step.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form className="rounded-2xl border bg-white p-5 shadow-sm" onSubmit={handleSubmit}>
            <div className="mb-4 grid gap-2">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input value={form.customerCode} onChange={(event) => updateField('customerCode', event.target.value.toUpperCase())} className="h-12 rounded-2xl border px-4 text-sm font-semibold uppercase outline-none focus:border-[#263d27]" placeholder="Customer code, e.g. SOLI09232" />
                <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white px-4 text-sm font-bold" onClick={lookupCustomer}>Load</Button>
              </div>
              <p className="rounded-2xl bg-[#f7f8f2] px-4 py-3 text-xs font-semibold leading-relaxed text-muted-foreground">
                Customer baru bisa kosongkan kode. Setelah request tersimpan, Solivagant akan membuat kode unik untuk order berikutnya.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Name</span>
                <input value={form.name} onChange={(event) => updateField('name', event.target.value)} className="mt-2 h-12 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" placeholder="Customer name" />
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Contact</span>
                <input value={form.contact} onChange={(event) => updateField('contact', event.target.value)} className="mt-2 h-12 w-full rounded-2xl border px-4 text-sm font-semibold outline-none focus:border-[#263d27]" placeholder="Nomor WhatsApp / telepon" inputMode="tel" autoComplete="tel" />
              </label>
            </div>
            <div className="mt-5">
              <span className="text-xs font-bold uppercase text-muted-foreground">Mood</span>
              <div className="mt-2"><OptionGrid options={bespokeMoodOptions} value={form.mood} onChange={(value) => updateField('mood', value)} /></div>
            </div>
            <div className="mt-5">
              <span className="text-xs font-bold uppercase text-muted-foreground">Occasion</span>
              <div className="mt-2"><OptionGrid options={bespokeOccasionOptions} value={form.occasion} onChange={(value) => updateField('occasion', value)} /></div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <span className="text-xs font-bold uppercase text-muted-foreground">Budget</span>
                <div className="mt-2"><OptionGrid options={bespokeBudgetOptions} value={form.budget} onChange={(value) => updateField('budget', value)} /></div>
              </div>
              <div>
                <span className="text-xs font-bold uppercase text-muted-foreground">Size</span>
                <div className="mt-2"><OptionGrid options={bespokeSizeOptions} value={form.size} onChange={(value) => updateField('size', value)} /></div>
              </div>
            </div>
            <div className="mt-5 grid gap-4">
              {[
                ['preferredNotes', 'Preferred notes', 'Vanilla, clean musk, rose, sandalwood...'],
                ['avoidedNotes', 'Avoided notes', 'Too sweet, smoky, sharp citrus...'],
                ['story', 'Story', 'Tell us the feeling, person, or moment this scent should represent.'],
              ].map(([key, label, placeholder]) => (
                <label key={key}>
                  <span className="text-xs font-bold uppercase text-muted-foreground">{label}</span>
                  <textarea value={form[key]} onChange={(event) => updateField(key, event.target.value)} rows={key === 'avoidedNotes' ? 2 : 3} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none focus:border-[#263d27]" placeholder={placeholder} />
                </label>
              ))}
            </div>
            <Button type="submit" className="mt-5 h-12 rounded-2xl gap-2" disabled={saving}>
              {saving ? 'Saving request...' : 'Send request'}
              <Send className="h-4 w-4" />
            </Button>
            {submitted ? (
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="mb-2 h-5 w-5" />
                Request saved to Studio: {savedOrder?.orderNumber}. Customer code: {savedOrder?.customerCode || form.customerCode || '-'}. Brief: {form.mood}, {form.occasion}, {form.budget}, {form.size}.
              </div>
            ) : null}
          </form>
        </section>
      </main>
    </>
  );
};

export default BespokePage;
