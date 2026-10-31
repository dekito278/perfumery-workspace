import React from 'react';
import { Gift } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';
import FreeVialChoices from '@/components/storefront/FreeVialChoices.jsx';
import {
  freeVialChoices,
  isFreeVialProduct,
  splitFreeVialLines,
} from '@/utils/freeVial.js';

// One free vial per ORDER, chosen here rather than at "Tambah ke Keranjang".
//
// The interrupting version was considered and dropped: a modal on add-to-cart is the single highest
// friction moment in the shop, and at that moment the buyer does not yet know how many bottles they are
// taking. Here the cart is settled, and the gift reads as a thank-you rather than a toll.
//
// It renders NOTHING until there is something to render — no vial product, no aroma with stock left, or
// an empty cart — so the feature simply is not there until Dekito creates the product and fills it in.
// That is deliberate: a picker offering a gift the shop cannot pack is worse than no picker.
//
// One component for the desktop cart and the phone cart. Five separate fixes went to one side and not
// the other in this repository before that rule was adopted.
const FreeVialPicker = ({ items = [], products = [], onPick }) => {
  const { t } = useTranslate();
  const vialProduct = products.find(isFreeVialProduct);
  const choices = freeVialChoices(vialProduct);
  const { lines, gift } = splitFreeVialLines(items);

  if (!vialProduct || !choices.length || !lines.length) return null;

  return (
    <section className="flex flex-col gap-4" aria-label={t('cart.giftTitle')}>
      <p className="m-0 flex items-center gap-3 font-ng-display text-[32px] leading-none">
        <Gift className="h-5 w-5 text-ng-ember" aria-hidden="true" />
        {t('cart.giftTitle')}
      </p>
      <p className="m-0 text-[15px] leading-relaxed text-ng-dust" role="status">{gift ? t('cart.giftChosen', { name: gift.size }) : t('cart.giftBody')}</p>
      <FreeVialChoices vialProduct={vialProduct} gift={gift} onPick={onPick} />
      {gift ? (
        <button type="button" className="ng-link ng-mono inline-flex min-h-[44px] items-center self-start border-0 bg-transparent p-0 underline underline-offset-4" onClick={() => onPick(null)}>
          {t('cart.giftRemove')}
        </button>
      ) : null}
    </section>
  );
};

export default FreeVialPicker;
