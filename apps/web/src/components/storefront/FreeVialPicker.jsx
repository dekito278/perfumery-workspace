import React, { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { useTranslate } from '@/hooks/useTranslate.js';
import FreeVialChoices from '@/components/storefront/FreeVialChoices.jsx';
import {
  boughtNames,
  freeVialAllowance,
  freeVialChoices,
  giftScentIsBought,
  giftVariantIds,
  isFreeVialProduct,
  splitFreeVialLines,
} from '@/utils/freeVial.js';

// The free vials, chosen here as well as at "Tambah ke Keranjang" (FreeVialPrompt).
//
// ONE PER BOTTLE, at most three, each a different scent (Dekito, 18 Nov 2026; it was one per order). So
// this shows one dropdown per vial the bottles have earned: two bottles, two dropdowns. Each dropdown leaves
// out the scents chosen in the others, and the scents being bought as bottles.
//
// It renders NOTHING until there is something to render — no vial product, no aroma with stock left, or
// an empty cart — so the feature simply is not there until Dekito creates the product and fills it in.
// That is deliberate: a picker offering a gift the shop cannot pack is worse than no picker.
//
// One component for every cart and the checkout. Five separate fixes went to one side and not the other
// in this repository before that rule was adopted.
//
// `onPick` is handed the WHOLE set of vials, in order (useCart's setGifts); `[]` takes them all out.
const FreeVialPicker = ({ items = [], products = [], onPick }) => {
  const { t } = useTranslate();
  const vialProduct = products.find(isFreeVialProduct);
  const bought = boughtNames(items);
  const { lines, gifts, bottles } = splitFreeVialLines(items);
  const allowance = freeVialAllowance(bottles);
  // A chosen aroma whose BOTTLE is now in the cart: release that vial and say so (see giftScentIsBought).
  const [released, setReleased] = useState('');
  const stale = gifts.filter((gift) => giftScentIsBought(gift, bought));
  const kept = gifts.filter((gift) => !giftScentIsBought(gift, bought));
  const staleNames = stale.map((gift) => gift.size).join(', ');
  useEffect(() => {
    if (!staleNames) return;
    setReleased(staleNames);
    onPick(kept);
    // `kept` is derived from the same items as staleNames; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staleNames, onPick]);

  if (!vialProduct || !lines.length || !allowance) return null;
  if (!kept.length && !freeVialChoices(vialProduct, bought).length) return null;

  const slots = Array.from({ length: allowance }, (_, index) => kept[index] || null);
  const setSlot = (index, item) => {
    setReleased('');
    onPick(slots.map((gift, slot) => (slot === index ? item : gift)).filter(Boolean));
  };
  const open = allowance - kept.length;

  let status = t('cart.giftBody');
  if (released) status = t('cart.giftReleased', { name: released });
  else if (kept.length) {
    status = t('cart.giftChosenList', { names: kept.map((gift) => gift.size).join(', ') });
    if (open > 0) status = `${status} ${t('cart.giftMore', { count: open })}`;
  }

  return (
    <section className="flex flex-col gap-4" aria-label={t('cart.giftTitle')}>
      <p className="m-0 flex items-center gap-3 font-ng-display text-[32px] leading-none">
        <Gift className="h-5 w-5 text-ng-ember" aria-hidden="true" />
        {t('cart.giftTitle')}
      </p>
      <p className="m-0 text-[15px] leading-relaxed text-ng-dust" role="status">{status}</p>
      {slots.map((gift, index) => (
        <FreeVialChoices
          // The slot, not the aroma: the dropdown must keep its place while its aroma changes.
          key={`vial-slot-${index}`}
          vialProduct={vialProduct}
          gift={gift}
          bought={bought}
          taken={giftVariantIds(slots.filter((other, slot) => other && slot !== index))}
          label={allowance > 1 ? t('cart.giftSlot', { n: index + 1 }) : ''}
          onPick={(item) => setSlot(index, item)}
        />
      ))}
      {kept.length ? (
        <button type="button" className="ng-link ng-mono inline-flex min-h-[44px] items-center self-start border-0 bg-transparent p-0 underline underline-offset-4" onClick={() => onPick([])}>
          {t('cart.giftRemove')}
        </button>
      ) : null}
    </section>
  );
};

export default FreeVialPicker;
