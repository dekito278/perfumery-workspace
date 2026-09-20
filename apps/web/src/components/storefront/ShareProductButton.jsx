import React, { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { copyTextToClipboard } from '@/utils/clipboard.js';
import { productShareUrl } from '@/utils/productShare.js';
import { routerBasename } from '@/utils/storefrontRegion.js';
import { useTranslate } from '@/hooks/useTranslate.js';

/**
 * "Cium ini deh" — the moment a buyer wants to send a bottle to someone else.
 *
 * Everything this needs was already built: each product page prerenders its own og:title, og:description
 * and og:image, so the card that appears in WhatsApp is finished work. What was missing was the door.
 * The journal article page has had a share card for months; the product page — the thing people actually
 * forward — had none, so sharing meant copying the address bar by hand, which on a phone means leaving
 * the page.
 *
 * navigator.share is the native sheet: one tap to WhatsApp, Instagram or a message. Where it does not
 * exist (most desktop browsers) the link goes to the clipboard instead, which is the same errand.
 */
const ShareProductButton = ({ product, className = '', compact = false }) => {
  const { t } = useTranslate();
  const [copied, setCopied] = useState(false);

  if (!product?.slug || !product?.name) return null;

  const share = async () => {
    const url = productShareUrl(product.slug, {
      origin: window.location.origin,
      basename: routerBasename(),
    });
    const title = `${product.name} — SOLIVAGANT`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Closing the sheet throws AbortError. That is someone changing their mind, not a failure, and
        // telling them "sharing failed" for it would be a lie. Anything else falls through to the copy.
        if (error?.name === 'AbortError') return;
      }
    }

    if (!await copyTextToClipboard(url)) {
      toast.error(t('pdp.shareFailed'));
      return;
    }
    setCopied(true);
    toast.success(t('pdp.shareCopied'));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={share}
      // min-h, not h: "Bagikan wangi ini" wraps on a 375px screen.
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-editorial-charcoal/15 bg-transparent px-4 py-2 text-center text-sm font-bold leading-snug text-editorial-charcoal transition hover:bg-editorial-paper ${compact ? 'min-h-[2.75rem]' : 'min-h-[3rem]'} ${className}`}
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? t('pdp.shareCopied') : t('pdp.share')}
    </button>
  );
};

export default ShareProductButton;
