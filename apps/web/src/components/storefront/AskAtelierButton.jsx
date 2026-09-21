import React from 'react';
import { MessageCircle } from 'lucide-react';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import { useTranslate } from '@/hooks/useTranslate.js';

/**
 * The way to follow an instruction the page just gave.
 *
 * A buyer reading "the tracking number is not in the system yet — message us on WhatsApp" is usually
 * standing somewhere holding a phone, mildly worried about a parcel. Telling them to message us and then
 * leaving them to find the number in the footer is the same defect as a broken link, only politer.
 *
 * The draft names the order, so the first thing Dekito receives is the number he needs to answer.
 *
 * Hidden when no WhatsApp number is configured: a button that opens a chat with nobody is worse than no
 * button (same rule as OverseasInquiryButton).
 */
// labelKey/draftKey so the same button can carry the errand of whatever sentence it answers: asking
// about a parcel on the tracking page, arranging an order from abroad on the account page — where the
// English shop has no checkout, and WhatsApp is not a help channel but the way to buy at all.
const AskAtelierButton = ({ orderNumber = '', className = '', labelKey = 'track.askAtelier', draftKey = '' }) => {
  const { t } = useTranslate();
  const phoneNumber = getStorefrontWhatsAppNumber();
  if (!phoneNumber) return null;

  // One t() call, not a ternary of two: the shop's guard for inline WhatsApp drafts reads the expression
  // handed to buildWhatsAppCheckoutUrl and wants it to start at the message file. It is right to.
  const message = t(draftKey || (orderNumber ? 'track.waDraft' : 'track.waDraftNoOrder'), { order: orderNumber });

  return (
    <a
      href={buildWhatsAppCheckoutUrl(message, phoneNumber)}
      target="_blank"
      rel="noopener noreferrer"
      // min-h, not h: the label wraps on a narrow phone.
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-editorial-charcoal/20 bg-white px-4 py-2 text-center text-sm font-bold leading-snug text-editorial-charcoal transition hover:bg-editorial-paper min-h-[2.75rem] ${className}`}
    >
      <MessageCircle className="h-4 w-4" />
      {t(labelKey)}
    </a>
  );
};

export default AskAtelierButton;
