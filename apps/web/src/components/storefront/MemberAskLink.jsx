import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import { useTranslate } from '@/hooks/useTranslate.js';

/**
 * "Cara jadi member" — the way to ASK for a member code (Dekito, 18 Nov 2026). A new buyer has no code yet,
 * so sending them to a sign-in page with a code box asked for something they did not have. It opens a
 * WhatsApp chat with "Halo, saya mau jadi member" already typed; Dekito answers with the code, and the
 * account page takes it from there.
 *
 * With no WhatsApp number configured it falls back to the account page, which explains the steps: a chat
 * button that opens wa.me with nobody on the other end is worse than no button.
 */
const MemberAskLink = ({ className = '', labelKey = 'price.howToMember', withIcon = false }) => {
  const { t } = useTranslate();
  const phoneNumber = getStorefrontWhatsAppNumber();
  if (!phoneNumber) {
    return <Link to="/customer" className={className}>{t(labelKey)}</Link>;
  }
  return (
    <a
      href={buildWhatsAppCheckoutUrl(t('member.waDraft'), phoneNumber)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {withIcon ? <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {t(labelKey)}
    </a>
  );
};

export default MemberAskLink;
