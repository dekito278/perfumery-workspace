import React from 'react';
import { Globe } from 'lucide-react';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import { useExportPrice } from '@/hooks/useOverseasPrice.js';
import { useInternationalQuote } from '@/hooks/useInternationalQuote.js';
import { useTranslate } from '@/hooks/useTranslate.js';
import { buildOverseasDraft, overseasDraftKeys, quotedInternationalPrice } from '@/utils/overseasEnquiry.js';

/**
 * Asking about an overseas order. Deliberately NOT a checkout — but no longer a question with half the
 * price missing either.
 *
 * It used to read: "international shipping is quoted by hand, so the buyer sees the product price here
 * and the shipping cost comes from a conversation." That was true and it was the problem. The buyer saw
 * US$80 and learned about US$140 in a WhatsApp reply, after they had already decided. Since 2026-10-05
 * InternationalShippingQuote settles the total on the page, and this draft carries it, so the
 * conversation starts at a confirmation rather than at a surprise. The quote is still not a checkout:
 * nothing here reserves stock.
 *
 * Nothing about this reserves stock, and the message says so — otherwise someone who asks on Monday
 * and orders on Friday believes a bottle was being held for them.
 *
 * Hidden when no WhatsApp number is configured (VITE_STOREFRONT_WHATSAPP_NUMBER). A button inviting a
 * buyer to ask a question, which opens WhatsApp with no one to send it to, is worse than no button.
 */
const OverseasInquiryButton = ({ product, variant = null, size = '', price = '', className = '', compact = false, english = false }) => {
  const phoneNumber = getStorefrontWhatsAppNumber();
  // The export price belongs to the product, not to a guess about the reader. Detection decides who gets
  // the English panel; it must not decide who is allowed to know the price at all — a visitor abroad
  // behind a VPN, on a browser that reports no timezone, or simply misread would otherwise have to open
  // WhatsApp to find out, and Dekito could never check his own export prices from Indonesia.
  //
  // Shown here only when the English panel is NOT already showing it, which is exactly the two cases
  // this component is used in: the panel passes english, everything else does not.
  const { price: exportPrice, overseasVisitor } = useExportPrice(product, variant);
  const { t } = useTranslate();
  // The total the quote block settled, when it settled one. Null until the buyer picks a destination,
  // and then the draft quotes the total instead of the bare bottle price — see buildOverseasDraft.
  // The settled total, when the quote block above has one; it rides in the enquiry so Dekito reads the
  // same figures the buyer saw. No gate here since 2026-10-06: this is an ENQUIRY in both shops, and the
  // ORDER — with the gate — lives in the English cart.
  const { draft: internationalDraft } = useInternationalQuote({ price: exportPrice, product, variant });
  const showExportPrice = Boolean(exportPrice) && !english && !overseasVisitor;

  if (!phoneNumber || !product?.name) return null;

  // Written in the language of the SHOP, not in whatever language the caller happened to pass down.
  //
  // It used to follow the `english` prop, which only OverseasPriceNote passes — so on the product page
  // itself, in the English shop, an overseas buyer got an Indonesian draft. They then have to translate
  // their own enquiry before they can send it, which is where most of them stop. The prop still decides
  // whether to repeat the price line (the panel already shows it); it has no business deciding language.
  //
  // This is the one piece of copy that LEAVES the page, so it is also the one the shop's own guard for
  // leftover Indonesian could never see.
  //
  // And it quotes the price this page is actually offering for an overseas shipment. The callers pass a
  // price that is region-gated — null for an Indonesian reader — so it fell back to the DOMESTIC label,
  // and the draft said "the price I saw on your site: Rp 750.000" directly under a line reading "Harga
  // untuk pengiriman ke luar negeri: Rp 2.630.000". Dekito then received an enquiry quoting a number he
  // had not offered for that shipment. The export price is right here, ungated, for exactly this.
  // An ENQUIRY in both shops since 2026-10-06. It was the purchase in the English shop while that shop
  // had no cart; the purchase is the cart's "Order on WhatsApp" now, and this stays the question asked
  // beside it — which is why its draft carries the settled quote when there is one.
  // In dollars, for the same reason the panel shows dollars: this draft is the buyer's own words back to
  // Dekito, and a rupiah figure in it is a number he then has to explain before he can quote a parcel.
  const quoted = quotedInternationalPrice(exportPrice, price);
  const message = buildOverseasDraft({
    t, name: product.name, size, price: quoted, quote: internationalDraft,
  });

  const link = (
    <a
      href={buildWhatsAppCheckoutUrl(message, phoneNumber)}
      target="_blank"
      rel="noopener noreferrer"
      // min-h, not h: the label wraps to two lines on a 375px phone — the English one certainly, the
      // Indonesian one on a narrow screen — and a fixed height clipped it half out of its own box.
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-editorial-charcoal/20 bg-white px-4 py-2 text-center text-sm font-bold leading-snug text-editorial-charcoal transition hover:bg-editorial-paper ${compact ? 'min-h-[2.75rem]' : 'min-h-[3rem]'} ${className}`}
    >
      <Globe className="h-4 w-4" />
      {/* One label for one action. The panel and the always-visible button used to carry different
          wording, which an English visitor saw twice on the same page as two different offers. */}
      {t(overseasDraftKeys().labelKey)}
    </a>
  );

  if (!showExportPrice) return link;

  return (
    <div>
      <p className="mb-2 mt-3 text-xs font-semibold leading-relaxed text-muted-foreground">
        {t('export.priceLine')}{' '}
        {/* The dollar, like everywhere else this buyer looks — see the note in InternationalPrice.jsx. */}
        <strong className="font-bold text-editorial-charcoal">{quoted}</strong>
        {' '}{t('export.notIncluded')}
      </p>
      {link}
    </div>
  );
};

export default OverseasInquiryButton;
