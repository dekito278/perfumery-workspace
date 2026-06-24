import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { BadgePercent, Save, Truck } from 'lucide-react';
import { toast } from 'sonner';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  getShippingPromotionPreview,
  getShippingPromotionSettings,
  getShippingPromotionSettingsAsync,
  saveShippingPromotionSettings,
  SHIPPING_PROMOTION_PRESETS,
  SHIPPING_PROMOTION_UPDATED_EVENT,
  shippingPromotionPresetLabels,
} from '@/services/shippingPromotionService.js';

const formatRupiah = (value) => `Rp ${new Intl.NumberFormat('id-ID').format(Number(value || 0))}`;
const presetOptions = Object.values(SHIPPING_PROMOTION_PRESETS);

const MobileShippingPromotionPage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(() => getShippingPromotionSettings());
  const preview = useMemo(() => getShippingPromotionPreview(settings), [settings]);

  useEffect(() => {
    const handleUpdate = () => setSettings(getShippingPromotionSettings());
    getShippingPromotionSettingsAsync().then(setSettings).catch(() => {});
    window.addEventListener(SHIPPING_PROMOTION_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(SHIPPING_PROMOTION_UPDATED_EVENT, handleUpdate);
  }, []);

  const updateSetting = (field, value) => setSettings((current) => ({ ...current, [field]: value }));

  const handleSave = async (event) => {
    event.preventDefault();
    if (settings.startsAt && settings.endsAt && settings.startsAt > settings.endsAt) {
      toast.error('Tanggal selesai tidak boleh lebih awal');
      return;
    }

    try {
      const savedSettings = await saveShippingPromotionSettings(settings);
      setSettings(savedSettings);
      toast.success('Aturan ongkir tersimpan');
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan aturan ongkir');
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
    <MobileAuthenticatedLayout>
      <Helmet>
        <title>Ongkir | Solivagant Mobile Studio</title>
      </Helmet>

      <div className="mobile-page-shell">
        <MobileTopBar
          title="Ongkir"
          subtitle="Gratis ongkir, subsidi area, dan periode promo"
          onBack={() => navigate('/mobile/studio')}
          action={<Truck className="h-5 w-5 text-[#1b1a16]" />}
        />

        <form onSubmit={handleSave} className="grid gap-3 pb-24">
          <section className="mobile-commerce-panel p-4">
            <button
              type="button"
              onClick={() => updateSetting('enabled', !settings.enabled)}
              className={`mobile-interactive mobile-pressable flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold ${
                settings.enabled ? 'bg-[#1b1a16] text-white' : 'bg-[#f7f1e5] text-[#6f695f]'
              }`}
            >
              <BadgePercent className="h-4 w-4" />
              {settings.enabled ? 'Promo ongkir aktif' : 'Promo ongkir nonaktif'}
            </button>
            <p className="mt-3 text-xs font-semibold leading-5 text-[#6f695f]">{preview}</p>
            <p className="mt-2 text-[11px] font-bold leading-5 text-[#6f695f]">
              Area Jawa dibaca dari provinsi tujuan: Banten, DKI Jakarta, Jawa Barat, Jawa Tengah, DI Yogyakarta, dan Jawa Timur.
            </p>
          </section>

          <section className="mobile-commerce-panel p-4">
            <div className="text-xs font-bold uppercase text-[#6f695f]">Pola promo</div>
            <div className="mt-3 grid gap-2">
              {presetOptions.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => updateSetting('preset', preset)}
                  className={`mobile-commerce-choice px-3 py-3 text-left text-xs font-bold ${settings.preset === preset ? 'is-active' : ''}`}
                >
                  {shippingPromotionPresetLabels[preset]}
                </button>
              ))}
            </div>
          </section>

          <section className="mobile-commerce-panel grid gap-3 p-4">
            <label className="grid gap-2">
              <span className="text-[10px] font-bold uppercase text-[#6f695f]">Minimal belanja</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={settings.minimumSubtotal}
                onChange={(event) => updateSetting('minimumSubtotal', Number(event.target.value || 0))}
                className="h-12 rounded-2xl border border-[#1b1a16]/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-[#1b1a16]"
              />
            </label>
            <label className={`grid gap-2 ${needsJavaAmount ? '' : 'opacity-50'}`}>
              <span className="text-[10px] font-bold uppercase text-[#6f695f]">Maksimal Pulau Jawa</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={settings.javaAmount}
                onChange={(event) => updateSetting('javaAmount', Number(event.target.value || 0))}
                disabled={!needsJavaAmount}
                className="h-12 rounded-2xl border border-[#1b1a16]/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-[#1b1a16] disabled:cursor-not-allowed"
              />
            </label>
            <label className={`grid gap-2 ${needsOtherAmount ? '' : 'opacity-50'}`}>
              <span className="text-[10px] font-bold uppercase text-[#6f695f]">Diskon luar Jawa / semua area</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={settings.otherAmount}
                onChange={(event) => updateSetting('otherAmount', Number(event.target.value || 0))}
                disabled={!needsOtherAmount}
                className="h-12 rounded-2xl border border-[#1b1a16]/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-[#1b1a16] disabled:cursor-not-allowed"
              />
            </label>
          </section>

          <section className="mobile-commerce-panel grid gap-3 p-4">
            <div className="text-xs font-bold uppercase text-[#6f695f]">Periode</div>
            <label className="grid gap-2">
              <span className="text-[10px] font-bold uppercase text-[#6f695f]">Mulai</span>
              <input
                type="date"
                value={settings.startsAt}
                onChange={(event) => updateSetting('startsAt', event.target.value)}
                className="h-12 rounded-2xl border border-[#1b1a16]/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-[#1b1a16]"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-[10px] font-bold uppercase text-[#6f695f]">Selesai</span>
              <input
                type="date"
                value={settings.endsAt}
                onChange={(event) => updateSetting('endsAt', event.target.value)}
                className="h-12 rounded-2xl border border-[#1b1a16]/10 bg-[#fbfaf7] px-4 text-sm font-bold outline-none focus:border-[#1b1a16]"
              />
            </label>
          </section>

          <section className="mobile-commerce-panel p-4 text-xs font-bold text-[#1b1a16]">
            <div className="flex justify-between gap-3"><span>Minimal</span><span>{Number(settings.minimumSubtotal || 0) > 0 ? formatRupiah(settings.minimumSubtotal) : '-'}</span></div>
            <div className="mt-2 flex justify-between gap-3"><span>Status</span><span>{settings.enabled ? 'Aktif' : 'Nonaktif'}</span></div>
          </section>

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1b1a16]/10 bg-white/95 p-3 backdrop-blur">
            <Button type="submit" className="mobile-interactive h-12 w-full rounded-2xl gap-2">
              <Save className="h-4 w-4" />
              Simpan aturan ongkir
            </Button>
          </div>
        </form>
      </div>
    </MobileAuthenticatedLayout>
  );
};

export default MobileShippingPromotionPage;
