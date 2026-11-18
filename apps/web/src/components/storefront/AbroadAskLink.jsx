import React from 'react';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import { useTranslate } from '@/hooks/useTranslate.js';

/**
 * For a buyer in Indonesia who wants to send abroad (18 Nov 2026). These sentences used to link to the
 * English shop; since the visitor's country picks the shop (middleware.js), a link from Indonesia to /en
 * just comes back. So the way abroad is a WhatsApp chat with the question already typed. Plain text when no
 * number is configured — a chat with nobody is worse than no link.
 */
const AbroadAskLink = ({ labelKey, draftKey, vars = null, className = 'ng-link' }) => {
  const { t } = useTranslate();
  const phoneNumber = getStorefrontWhatsAppNumber();
  if (!phoneNumber) return null;
  return (
    <a href={buildWhatsAppCheckoutUrl(t(draftKey, vars || {}), phoneNumber)} target="_blank" rel="noopener noreferrer" className={className}>
      {t(labelKey)}
    </a>
  );
};

export default AbroadAskLink;
