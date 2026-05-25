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
        <section className="rounded-3xl border border-[#263d27]/10 bg-[#eef2e8] p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#263d27]">
                <Truck className="h-4 w-4" />
                Ongkir checkout
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#0b130c]">Aturan gratis ongkir dan subsidi area</h1>
              <p className="mt-2 text-sm font-medium leading-6 text-[#51624b]">
                Atur promo ongkir dari satu tempat. Checkout produk, mobile checkout, dan bespoke akan memakai nominal akhir yang sama.
              </p>
              <p className="mt-1 text-xs font-bold text-[#6f7d61]">
                Area Pulau Jawa dibaca dari provinsi tujuan: Banten, DKI Jakarta, Jawa Barat, Jawa Tengah, DI Yogyakarta, dan Jawa Timur.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateSetting('enabled', !settings.enabled)}
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition ${
                settings.enabled ? 'bg-[#263d27] text-white' : 'bg-white text-[#51624b]'
              }`}
            >
              {settings.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              {settings.enabled ? 'Aktif' : 'Nonaktif'}
            </button>
          </div>
        </section>

        <form onSubmit={handleSave} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-3xl border border-[#263d27]/10 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-[#0b130c]">
              <BadgePercent className="h-4 w-4 text-[#263d27]" />
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
                      active ? 'border-[#263d27] bg-[#eef2e8]' : 'border-[#263d27]/10 bg-[#fbfaf7] hover:border-[#263d27]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[#0b130c]">{shippingPromotionPresetLabels[preset]}</span>
                      {active ? <span className="rounded-full bg-[#263d27] px-2.5 py-1 text-[10px] font-bold uppercase text-white">Dipakai</span> : null}
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[#6b7280]">{presetDescriptions[preset]}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-[#263d27]/10 bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-[#0b130c]">Nominal</div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase text-[#6f7d61]">Minimal belanja</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={settings.minimumSubtotal}
                    onChange={(event) => updateSetting('minimumSubtotal', Number(event.target.value || 0))}
                    className="h-12 rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-[#263d27]"
                  />
                </label>
                <label className={`grid gap-2 ${needsJavaAmount ? '' : 'opacity-50'}`}>
                  <span className="text-xs font-bold uppercase text-[#6f7d61]">Maksimal Pulau Jawa</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={settings.javaAmount}
                    onChange={(event) => updateSetting('javaAmount', Number(event.target.value || 0))}
                    disabled={!needsJavaAmount}
                    className="h-12 rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-[#263d27] disabled:cursor-not-allowed"
                  />
                </label>
                <label className={`grid gap-2 ${needsOtherAmount ? '' : 'opacity-50'}`}>
                  <span className="text-xs font-bold uppercase text-[#6f7d61]">Diskon luar Jawa / semua area</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={settings.otherAmount}
                    onChange={(event) => updateSetting('otherAmount', Number(event.target.value || 0))}
                    disabled={!needsOtherAmount}
                    className="h-12 rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-[#263d27] disabled:cursor-not-allowed"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-[#263d27]/10 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0b130c]">
                <CalendarDays className="h-4 w-4 text-[#263d27]" />
                Periode promo
              </div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase text-[#6f7d61]">Tanggal mulai</span>
                  <input
                    type="date"
                    value={settings.startsAt}
                    onChange={(event) => updateSetting('startsAt', event.target.value)}
                    className="h-12 rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-[#263d27]"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase text-[#6f7d61]">Tanggal selesai</span>
                  <input
                    type="date"
                    value={settings.endsAt}
                    onChange={(event) => updateSetting('endsAt', event.target.value)}
                    className="h-12 rounded-2xl border border-[#263d27]/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-[#263d27]"
                  />
                </label>
                <p className="rounded-2xl bg-[#eef2e8] px-3 py-2 text-xs font-semibold leading-5 text-[#51624b]">
                  Kosongkan tanggal jika promo ingin aktif terus selama toggle masih aktif.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-[#263d27]/10 bg-[#fbfaf7] p-5 shadow-sm">
              <div className="text-sm font-bold text-[#0b130c]">Preview checkout</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#51624b]">{preview}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-[#263d27]">
                <div className="rounded-2xl bg-white p-3">
                  <div className="uppercase text-[#6f7d61]">Jawa</div>
                  <div className="mt-1">{needsJavaAmount ? formatRupiah(settings.javaAmount) : settings.enabled ? 'Gratis / normal' : 'Normal'}</div>
                </div>
                <div className="rounded-2xl bg-white p-3">
                  <div className="uppercase text-[#6f7d61]">Luar Jawa</div>
                  <div className="mt-1">{needsOtherAmount ? `Potong ${formatRupiah(settings.otherAmount)}` : settings.enabled && settings.preset === SHIPPING_PROMOTION_PRESETS.FREE_ALL ? 'Gratis' : 'Normal'}</div>
                </div>
              </div>
              <div className="mt-2 rounded-2xl bg-white p-3 text-xs font-bold text-[#263d27]">
                <div className="uppercase text-[#6f7d61]">Syarat</div>
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
