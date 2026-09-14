import React from 'react';
import { Globe } from 'lucide-react';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import { useTranslate } from '@/hooks/useTranslate.js';

/**
 * Told before the address form, not after it fails.
 *
 * Shipping destinations come from RajaOngkir, an Indonesian domestic courier API: a search for a foreign
 * city returns an EMPTY LIST with no error. Without this, a buyer outside Indonesia types their city,
 * sees nothing come back, and never learns why — a dead end that says nothing.
 *
 * It also reconciles two numbers the same visitor has just seen. The product page quotes them the
 * international price; this cart totals the Indonesian one. Both are true, and which applies depends on
 * where the parcel goes — so the notice says exactly that.
 *
 * It does NOT block checkout. The region is a language and pricing choice, not proof of location: an
 * Indonesian who reads English, or anyone shipping to an Indonesian address, must still be able to buy.
 * Blocking on a guess would refuse real orders, which is worse than the confusion it would prevent.
 */
const InternationalCheckoutNotice = ({ className = '' }) => {
  const { t, isInternational } = useTranslate();
  const whatsapp = getStorefrontWhatsAppNumber();

  if (!isInternational) return null;

  return (
    <aside className={`rounded-2xl border border-editorial-charcoal/15 bg-[#fbfaf7] p-4 ${className}`} role="note">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-editorial-charcoal">
        <Globe className="h-3.5 w-3.5" aria-hidden="true" /> {t('intl.noticeTitle')}
      </p>
      <p className="mt-2 text-xs font-semibold leading-relaxed text-muted-foreground">{t('intl.noticeBody')}</p>
      <p className="mt-2 text-xs font-semibold leading-relaxed text-muted-foreground">{t('intl.domesticOk')}</p>
      {whatsapp ? (
        <a
          href={buildWhatsAppCheckoutUrl(t('intl.noticeMessage'), whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-editorial-charcoal/20 bg-white px-4 py-2 text-center text-sm font-bold leading-snug text-editorial-charcoal transition hover:bg-editorial-paper"
        >
          <Globe className="h-4 w-4" /> {t('intl.noticeCta')}
        </a>
      ) : null}
    </aside>
  );
};

export default InternationalCheckoutNotice;
