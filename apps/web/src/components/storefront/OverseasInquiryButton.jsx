import React from 'react';
import { Globe } from 'lucide-react';
import { buildWhatsAppCheckoutUrl, getStorefrontWhatsAppNumber } from '@/services/cartService.js';
import { formatRupiah } from '@/services/productCatalogService.js';
import { useExportPrice } from '@/hooks/useOverseasPrice.js';

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
  const showExportPrice = Boolean(exportPrice) && !english && !overseasVisitor;

  if (!phoneNumber || !product?.name) return null;

  // Written in the language the buyer was reading when they pressed it. A visitor who has just read an
  // English panel and receives an Indonesian draft message has to translate their own enquiry before
  // they can send it, which is where most of them stop.
  const message = english
    ? [
      `Hello SOLIVAGANT, I would like to ask about international shipping for ${product.name}${size ? ` (${size})` : ''}.`,
      price ? `The international price shown on your site: ${price}.` : null,
      'Could you let me know the shipping cost and final total to my country?',
      'I understand this enquiry does not reserve a bottle.',
    ].filter(Boolean).join('\n')
    : [
      `Halo SOLIVAGANT, saya mau tanya pengiriman ke luar negeri untuk ${product.name}${size ? ` (${size})` : ''}.`,
      price ? `Harga yang saya lihat di website: ${price}.` : null,
      'Boleh dibantu perkiraan ongkir dan harga akhirnya ke negara saya?',
      'Saya mengerti pertanyaan ini belum memesan stok.',
    ].filter(Boolean).join('\n');

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
      {english ? 'Ask about shipping to my country' : 'Kirim ke luar negeri? Tanya ongkir'}
    </a>
  );

  if (!showExportPrice) return link;

  return (
    <div>
      <p className="mb-2 mt-3 text-xs font-semibold leading-relaxed text-muted-foreground">
        Harga untuk pengiriman ke luar negeri:{' '}
        <strong className="font-bold text-editorial-charcoal">{formatRupiah(exportPrice)}</strong>
        {' '}— belum termasuk ongkir.
      </p>
      {link}
    </div>
  );
};

export default OverseasInquiryButton;
