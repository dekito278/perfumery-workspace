import React from 'react';
import { formatRupiah } from '@/services/productCatalogService.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useOverseasPrice } from '@/hooks/useOverseasPrice.js';
import { useTranslate } from '@/hooks/useTranslate.js';

const TIER_LABELS = { member: 'price.memberTier', reseller: 'price.resellerTier' };

/**
 * The one line under a price that explains why it is what it is. Two reasons exist and only one may
 * show at a time, or a discounted product bought by a member renders two struck-through numbers and the
 * buyer cannot tell which is the real comparison.
 *
 * Tier wins. "Harga member" is the reason that changes what THIS buyer pays; a compare-at price is
 * marketing that applies to everyone.
 *
 * Renders nothing when neither applies — which, until the tier migration runs and a compare-at price is
 * set above the selling price, is every product. The storefront stays exactly as it is.
 */
const PriceNote = ({ product, variant = null, className = '' }) => {
  const { loginWithGoogle } = useAuth();
  const { t } = useTranslate();
  const overseasPrice = useOverseasPrice(product, variant);
  const price = Number(variant?.priceNumber ?? product?.priceNumber ?? 0);

  const tierLabelKey = TIER_LABELS[product?.priceTier];
  const retail = Number(variant?.retailPriceNumber ?? product?.retailPriceNumber ?? 0);
  if (tierLabelKey && retail && price && retail !== price) {
    return (
      <p className={`mt-1 flex flex-wrap items-baseline gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700 ${className}`}>
        {t(tierLabelKey)}
        {retail > price ? (
          <span className="font-semibold normal-case tracking-normal text-muted-foreground line-through">{formatRupiah(retail)}</span>
        ) : null}
      </p>
    );
  }

  // Not a member yet, and a member price exists for this line: say so, with the number and the way in.
  // attachMemberPrices only sets memberPriceNumber when it is strictly below the price on the line, so
  // this branch cannot fire for a signed-in member (their price already IS the member price) nor for a
  // product with no member price — which, until Dekito fills them in, is every product.
  //
  // Not shown to a visitor being quoted internationally. Their price is the export price — Rp 1.400.000
  // where this line would offer Rp 550.000 — so inviting them to sign in for the member price promises
  // a number they will never be charged. That is the same bait-and-switch the export panel exists to
  // prevent, pointing the other way, and a broken promise is worse than a missed nudge.
  const memberPrice = Number(variant?.memberPriceNumber ?? product?.memberPriceNumber ?? 0);
  if (!overseasPrice && price && memberPrice && memberPrice < price) {
    return (
      <p className={`mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs font-bold uppercase tracking-[0.12em] text-amber-700 ${className}`}>
        <span>{t('price.memberIs', { price: formatRupiah(memberPrice) })}</span>
        <span className="font-semibold normal-case tracking-normal text-muted-foreground">{t('price.saveShort', { amount: formatRupiah(price - memberPrice) })}</span>
        <button
          type="button"
          onClick={() => loginWithGoogle(window.location.href).catch(() => {})}
          className="font-bold normal-case tracking-normal underline underline-offset-2"
        >
          {t('price.signInGoogle')}
        </button>
      </p>
    );
  }

  // A compare-at price is only a comparison when it is ABOVE what is being charged. Two live products
  // carry stray values (Rp10 and Rp5 against prices in the hundreds of thousands) precisely because
  // nothing ever displayed this field, so a lower number has to read as "not set" rather than as a
  // price rise.
  const compareAt = Number(variant?.compareAtPriceNumber ?? product?.compareAtPriceNumber ?? 0);
  if (!price || !(compareAt > price)) return null;

  return (
    <p className={`mt-1 flex flex-wrap items-baseline gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700 ${className}`}>
      <span className="font-semibold normal-case tracking-normal text-muted-foreground line-through">{formatRupiah(compareAt)}</span>
      {t('price.save', { amount: formatRupiah(compareAt - price) })}
    </p>
  );
};

export default PriceNote;
