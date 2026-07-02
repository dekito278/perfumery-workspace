import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BadgePercent, CalendarDays, RotateCcw, Save, ToggleLeft, ToggleRight, Truck } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  getShippingPromotionPreview,
  getShippingPromotionSettings,
  getShippingPromotionSettingsAsync,
  resetShippingPromotionSettings,
  saveShippingPromotionSettings,
  SHIPPING_PROMOTION_PRESETS,
  SHIPPING_PROMOTION_UPDATED_EVENT,
  shippingPromotionPresetLabels,
} from '@/services/shippingPromotionService.js';

const formatRupiah = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;

const presetDescriptions = {
  [SHIPPING_PROMOTION_PRESETS.FREE_JAVA]: 'Untuk campaign Jawa saja. Customer di luar Jawa tetap melihat ongkir normal.',
  [SHIPPING_PROMOTION_PRESETS.FREE_JAVA_DISCOUNT_OTHER]: 'Pilihan paling seimbang: Jawa gratis, luar Jawa tetap terasa dapat subsidi.',
  [SHIPPING_PROMOTION_PRESETS.FLAT_JAVA]: 'Cocok kalau ingin customer Jawa tidak membayar ongkir di atas batas tertentu.',
  [SHIPPING_PROMOTION_PRESETS.FLAT_JAVA_DISCOUNT_OTHER]: 'Jawa dibuat maksimal sesuai batas, luar Jawa tetap dapat potongan supaya tidak terasa berat.',
  [SHIPPING_PROMOTION_PRESETS.FREE_ALL]: 'Campaign besar untuk semua area.',
  [SHIPPING_PROMOTION_PRESETS.DISCOUNT_ALL]: 'Subsidi ongkir rata untuk semua area tanpa membedakan pulau.',
};

const presetOptions = Object.values(SHIPPING_PROMOTION_PRESETS);

const ShippingPromotionPage = () => {
  const [settings, setSettings] = useState(() => getShippingPromotionSettings());

  useEffect(() => {
    const handleUpdate = () => setSettings(getShippingPromotionSettings());
    getShippingPromotionSettingsAsync().then(setSettings).catch(() => {});
    window.addEventListener(SHIPPING_PROMOTION_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(SHIPPING_PROMOTION_UPDATED_EVENT, handleUpdate);
  }, []);

  const preview = useMemo(() => getShippingPromotionPreview(settings), [settings]);

  const updateSetting = (field, value) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (settings.startsAt && settings.endsAt && settings.startsAt > settings.endsAt) {
      toast.error('Tanggal selesai tidak boleh lebih awal dari tanggal mulai');
      return;
    }

    try {
      const savedSettings = await saveShippingPromotionSettings(settings);
      setSettings(savedSettings);
      toast.success(savedSettings.enabled ? 'Aturan ongkir aktif tersimpan' : 'Aturan ongkir disimpan sebagai nonaktif');
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan aturan ongkir');
    }
  };

  const handleReset = async () => {
    try {
      const nextSettings = await resetShippingPromotionSettings();
      setSettings(nextSettings);
      toast.success('Aturan ongkir dikembalikan ke default');
    } catch (error) {
      toast.error(error.message || 'Gagal reset aturan ongkir');
    }
  };

  const needsJavaAmount = [
    SHIPPING_PROMOTION_PRESETS.FLAT_JAVA,
    SHIPPING_PROMOTION_PRESETS.FLAT_JAVA_DISCOUNT_OTHER,
  ].includes(settings.preset);
  const needsOtherAmount = [
    SHIPPING_PROMOTION_PRESETS.FREE_JAVA_DISCOUNT_OTHER,
    SHIPPING_PROMOTION_PRESETS.FLAT_JAVA_DISCOUNT_OTHER,
    SHIPPING_PROMOTION_PRESETS.DISCOUNT_ALL,
  ].includes(settings.preset);

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Aturan Ongkir | Solivagant Studio</title>
      </Helmet>

      <div className="page-container space-y-6">
        <section className="rounded-3xl border border-editorial-charcoal/10 bg-editorial-ivory p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-editorial-charcoal">
                <Truck className="h-4 w-4" />
                Ongkir checkout
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-editorial-charcoal">Aturan gratis ongkir dan subsidi area</h1>
              <p className="mt-2 text-sm font-medium leading-6 text-editorial-muted">
                Atur promo ongkir dari satu tempat. Checkout produk, mobile checkout, dan bespoke akan memakai nominal akhir yang sama.
              </p>
              <p className="mt-1 text-xs font-bold text-editorial-muted">
                Area Pulau Jawa dibaca dari provinsi tujuan: Banten, DKI Jakarta, Jawa Barat, Jawa Tengah, DI Yogyakarta, dan Jawa Timur.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateSetting('enabled', !settings.enabled)}
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${
                settings.enabled ? 'bg-editorial-charcoal text-white' : 'bg-white text-editorial-muted'
              }`}
            >
              {settings.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              {settings.enabled ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>
        </section>

        <form onSubmit={handleSave} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-3xl border border-editorial-charcoal/10 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-editorial-charcoal">
              <BadgePercent className="h-4 w-4 text-editorial-charcoal" />
              Pilih pola promo
            </div>

            <div className="mt-4 grid gap-3">
              {presetOptions.map((preset) => {
                const active = settings.preset === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => updateSetting('preset', preset)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active ? 'border-editorial-charcoal bg-editorial-ivory' : 'border-editorial-charcoal/10 bg-[#fbfaf7] hover:border-editorial-charcoal/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-editorial-charcoal">{shippingPromotionPresetLabels[preset]}</span>
                      {active ? <span className="rounded-full bg-editorial-charcoal px-2.5 py-1 text-[10px] font-bold uppercase text-white">Dipakai</span> : null}
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">{presetDescriptions[preset]}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-editorial-charcoal/10 bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-editorial-charcoal">Nominal</div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase text-editorial-muted">Minimal belanja</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={settings.minimumSubtotal}
                    onChange={(event) => updateSetting('minimumSubtotal', Number(event.target.value || 0))}
                    className="h-12 rounded-2xl border border-editorial-charcoal/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-editorial-charcoal"
                  />
                </label>
                <label className={`grid gap-2 ${needsJavaAmount ? '' : 'opacity-50'}`}>
                  <span className="text-xs font-bold uppercase text-editorial-muted">Maksimal Pulau Jawa</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={settings.javaAmount}
                    onChange={(event) => updateSetting('javaAmount', Number(event.target.value || 0))}
                    disabled={!needsJavaAmount}
                    className="h-12 rounded-2xl border border-editorial-charcoal/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-editorial-charcoal disabled:cursor-not-allowed"
                  />
                </label>
                <label className={`grid gap-2 ${needsOtherAmount ? '' : 'opacity-50'}`}>
                  <span className="text-xs font-bold uppercase text-editorial-muted">Diskon luar Jawa / semua area</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={settings.otherAmount}
                    onChange={(event) => updateSetting('otherAmount', Number(event.target.value || 0))}
                    disabled={!needsOtherAmount}
                    className="h-12 rounded-2xl border border-editorial-charcoal/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-editorial-charcoal disabled:cursor-not-allowed"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-editorial-charcoal/10 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-bold text-editorial-charcoal">
                <CalendarDays className="h-4 w-4 text-editorial-charcoal" />
                Periode promo
              </div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase text-editorial-muted">Tanggal mulai</span>
                  <input
                    type="date"
                    value={settings.startsAt}
                    onChange={(event) => updateSetting('startsAt', event.target.value)}
                    className="h-12 rounded-2xl border border-editorial-charcoal/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-editorial-charcoal"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase text-editorial-muted">Tanggal selesai</span>
                  <input
                    type="date"
                    value={settings.endsAt}
                    onChange={(event) => updateSetting('endsAt', event.target.value)}
                    className="h-12 rounded-2xl border border-editorial-charcoal/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-editorial-charcoal"
                  />
                </label>
                <p className="rounded-2xl bg-editorial-ivory px-3 py-2 text-xs font-semibold leading-5 text-editorial-muted">
                  Kosongkan tanggal jika promo ingin aktif terus selama toggle masih aktif.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-editorial-charcoal/10 bg-[#fbfaf7] p-5 shadow-sm">
              <div className="text-sm font-bold text-editorial-charcoal">Preview checkout</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-editorial-muted">{preview}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-editorial-charcoal">
                <div className="rounded-2xl bg-white p-3">
                  <div className="uppercase text-editorial-muted">Jawa</div>
                  <div className="mt-1">{needsJavaAmount ? formatRupiah(settings.javaAmount) : settings.enabled ? 'Gratis / normal' : 'Normal'}</div>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <div className="uppercase text-editorial-muted">Luar Jawa</div>
                  <div className="mt-1">{needsOtherAmount ? `Potong ${formatRupiah(settings.otherAmount)}` : settings.enabled && settings.preset === SHIPPING_PROMOTION_PRESETS.FREE_ALL ? 'Gratis' : 'Normal'}</div>
                </div>
              </div>
              <div className="mt-2 rounded-2xl bg-white p-3 text-xs font-bold text-editorial-charcoal">
                <div className="uppercase text-editorial-muted">Syarat</div>
                <div className="mt-1">{Number(settings.minimumSubtotal || 0) > 0 ? `Minimal ${formatRupiah(settings.minimumSubtotal)}` : 'Tanpa minimal belanja'}</div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-12 rounded-2xl bg-white gap-2" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button type="submit" className="h-12 rounded-2xl gap-2">
                <Save className="h-4 w-4" />
                Simpan
              </Button>
            </div>
          </aside>
        </form>
      </div>
    </AuthenticatedLayout>
  );
};

export default ShippingPromotionPage;
