import React from 'react';
import { Globe } from 'lucide-react';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';

/**
 * Asking about an overseas order. Deliberately NOT a checkout: international shipping is quoted by
 * hand, so the buyer sees the product price here and the shipping cost comes from a conversation.
 *
 * Nothing about this reserves stock, and the message says so — otherwise someone who asks on Monday
 * and orders on Friday believes a bottle was being held for them.
 *
 * Hidden when no WhatsApp number is configured (VITE_STOREFRONT_WHATSAPP_NUMBER). A button inviting a
 * buyer to ask a question, which opens WhatsApp with no one to send it to, is worse than no button.
 */
const OverseasInquiryButton = ({ product, size = '', price = '', className = '', compact = false }) => {
  const phoneNumber = getStorefrontWhatsAppNumber();
  if (!phoneNumber || !product?.name) return null;

  const message = [
    `Halo SOLIVAGANT, saya mau tanya pengiriman ke luar negeri untuk ${product.name}${size ? ` (${size})` : ''}.`,
    price ? `Harga yang saya lihat di website: ${price}.` : null,
    'Boleh dibantu perkiraan ongkir dan harga akhirnya ke negara saya?',
    'Saya mengerti pertanyaan ini belum memesan stok.',
  ].filter(Boolean).join('\n');

  return (
    <a
      href={buildWhatsAppCheckoutUrl(message, phoneNumber)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-editorial-charcoal/20 bg-white px-4 text-sm font-bold text-editorial-charcoal transition hover:bg-editorial-paper ${compact ? 'h-11' : 'h-12'} ${className}`}
    >
      <Globe className="h-4 w-4" />
      Kirim ke luar negeri? Tanya ongkir
    </a>
  );
};

export default OverseasInquiryButton;
