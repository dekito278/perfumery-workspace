import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, MessageCircle, Send, Sparkles, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  bespokeBudgetOptions,
  bespokeMoodOptions,
  bespokeOccasionOptions,
  bespokeSizeOptions,
} from '@/data/storefront.js';
import { useCatalogProduct } from '@/hooks/useCatalogProducts.js';
import { cn } from '@/lib/utils.js';

const FieldLabel = ({ children }) => (
  <div className="mb-2 text-[10px] font-bold uppercase text-[#8b949e]">{children}</div>
);

const OptionGrid = ({ options, value, onChange }) => (
  <div className="grid grid-cols-2 gap-2">
    {options.map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(option)}
        className={cn(
          'min-h-[44px] rounded-2xl border px-3 py-2 text-left text-xs font-bold leading-snug',
          value === option
            ? 'border-amber-300 bg-amber-50 text-amber-800'
            : 'border-[#e5e7eb] bg-white text-[#6b7280]'
        )}
      >
        {option}
      </button>
    ))}
  </div>
);

const MobileBespokePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referenceProduct = useCatalogProduct(searchParams.get('reference'));
  const [form, setForm] = useState({
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
  const [submittedRequest, setSubmittedRequest] = useState(null);

  const completion = useMemo(() => {
    const required = ['name', 'contact', 'mood', 'occasion', 'budget', 'size', 'preferredNotes'];
    const complete = required.filter((key) => String(form[key] || '').trim()).length;
    return Math.round((complete / required.length) * 100);
  }, [form]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.contact.trim() || !form.preferredNotes.trim()) {
      toast.error('Please fill name, contact, and preferred notes');
      return;
    }
    setSubmittedRequest({
      ...form,
      reference: referenceProduct?.name || '',
      createdAt: new Date().toISOString(),
    });
    toast.success('Custom perfume request drafted');
  };

  return (
    <MobileAuthenticatedLayout showFab={false}>
      <Helmet>
        <title>Bespoke Perfume - Dekito Perfumery</title>
        <meta name="description" content="Create a custom perfume request with mood, notes, budget, size, and occasion." />
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
            1:1 scent brief
          </div>
          <h1 className="mt-3 text-2xl font-bold leading-tight text-[#1f2937]">Build a custom perfume request.</h1>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6b7280]">
            Isi preferensi aroma, budget, dan cerita singkat. Untuk tahap ini request dibuat sebagai draft ringkasan di aplikasi.
          </p>
          {referenceProduct ? (
            <div className="mt-3 rounded-2xl bg-white p-3 text-xs font-bold text-[#1f2937]">
              Reference scent: <span className="text-amber-700">{referenceProduct.name}</span>
            </div>
          ) : null}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${completion}%` }} />
          </div>
        </section>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <section className="mobile-card p-4">
            <h2 className="text-base font-bold text-[#1f2937]">Customer</h2>
            <div className="mt-3 grid gap-3">
              <label>
                <FieldLabel>Name</FieldLabel>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="Customer name"
                  className="h-12 w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300"
                />
              </label>
              <label>
                <FieldLabel>Contact</FieldLabel>
                <input
                  value={form.contact}
                  onChange={(event) => updateField('contact', event.target.value)}
                  placeholder="WhatsApp or email"
                  className="h-12 w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 text-sm font-semibold outline-none focus:border-amber-300"
                />
              </label>
            </div>
          </section>

          <section className="mobile-card p-4">
            <h2 className="text-base font-bold text-[#1f2937]">Scent direction</h2>
            <div className="mt-3">
              <FieldLabel>Mood</FieldLabel>
              <OptionGrid options={bespokeMoodOptions} value={form.mood} onChange={(value) => updateField('mood', value)} />
            </div>
            <div className="mt-4">
              <FieldLabel>Occasion</FieldLabel>
              <OptionGrid options={bespokeOccasionOptions} value={form.occasion} onChange={(value) => updateField('occasion', value)} />
            </div>
          </section>

          <section className="mobile-card p-4">
            <h2 className="text-base font-bold text-[#1f2937]">Budget and size</h2>
            <div className="mt-3">
              <FieldLabel>Budget</FieldLabel>
              <OptionGrid options={bespokeBudgetOptions} value={form.budget} onChange={(value) => updateField('budget', value)} />
            </div>
            <div className="mt-4">
              <FieldLabel>Size</FieldLabel>
              <OptionGrid options={bespokeSizeOptions} value={form.size} onChange={(value) => updateField('size', value)} />
            </div>
          </section>

          <section className="mobile-card p-4">
            <h2 className="text-base font-bold text-[#1f2937]">Notes</h2>
            <div className="mt-3 grid gap-3">
              <label>
                <FieldLabel>Preferred notes</FieldLabel>
                <textarea
                  value={form.preferredNotes}
                  onChange={(event) => updateField('preferredNotes', event.target.value)}
                  placeholder="Vanilla, clean musk, rose, sandalwood..."
                  rows={3}
                  className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
                />
              </label>
              <label>
                <FieldLabel>Avoided notes</FieldLabel>
                <textarea
                  value={form.avoidedNotes}
                  onChange={(event) => updateField('avoidedNotes', event.target.value)}
                  placeholder="Too sweet, smoky, sharp citrus..."
                  rows={2}
                  className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
                />
              </label>
              <label>
                <FieldLabel>Story</FieldLabel>
                <textarea
                  value={form.story}
                  onChange={(event) => updateField('story', event.target.value)}
                  placeholder="Tell us the feeling, person, or moment this scent should represent."
                  rows={3}
                  className="w-full rounded-2xl border border-[#e5e7eb] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-amber-300"
                />
              </label>
            </div>
          </section>

          <Button type="submit" className="h-12 w-full rounded-2xl gap-2">
            Draft request
            <Send className="h-4 w-4" />
          </Button>
        </form>

        {submittedRequest ? (
          <section className="mobile-card p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-[#1f2937]">Request summary</h2>
                <div className="mt-3 space-y-2 text-xs font-semibold text-[#6b7280]">
                  <p><strong className="text-[#1f2937]">Customer:</strong> {submittedRequest.name}</p>
                  <p><strong className="text-[#1f2937]">Contact:</strong> {submittedRequest.contact}</p>
                  <p><strong className="text-[#1f2937]">Direction:</strong> {submittedRequest.mood} for {submittedRequest.occasion}</p>
                  <p><strong className="text-[#1f2937]">Budget:</strong> {submittedRequest.budget}, {submittedRequest.size}</p>
                  <p><strong className="text-[#1f2937]">Notes:</strong> {submittedRequest.preferredNotes}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="rounded-2xl bg-white gap-2" onClick={() => navigate('/mobile/studio')}>
                    <ClipboardList className="h-4 w-4" />
                    Studio
                  </Button>
                  <Button type="button" className="rounded-2xl gap-2">
                    WhatsApp later
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileBespokePage;
