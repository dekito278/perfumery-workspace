// What a product form starts with when you open a product to edit it.
//
// This was written twice, by hand, once per layout — and the copies drifted on exactly one field. The
// phone ran the stored mood through moodForEditing(); the desktop spread it straight from the product.
//
// normalizeProduct fills an empty mood with 'Profil parfum bespoke', so every product in the catalogue
// carries a placeholder there. The phone therefore opened the Mood box empty, ready to type, and the
// desktop opened it pre-filled with a phrase nobody chose — the precise thing productMood.js was
// written to stop, quoting its own header: "the forms must not pre-fill an editor with it, or the owner
// has to clear the same phrase eighteen times before typing anything real."
//
// One builder now, holding the union of what either layout needs. stockAdjustmentNote is only rendered
// by the desktop form; carrying the empty string on the phone costs nothing and removes the reason to
// keep two versions of this function.
import {
  getProductRestockThreshold,
  getProductStockCorrections,
  getVisibleProductTags,
  isProductDraft,
} from '@/services/productCatalogService.js';
import { moodForEditing } from '@/utils/productMood.js';

export const toProductFormState = (product) => {
  const visibleTags = getVisibleProductTags(product);
  return {
    ...product,
    mood: moodForEditing(product.mood),
    intensity: product.intensity || 'Medium',
    catalogVisible: !isProductDraft(product),
    topNotes: product.topNotes.join(', '),
    heartNotes: product.heartNotes.join(', '),
    baseNotes: product.baseNotes.join(', '),
    variants: product.variants,
    tags: visibleTags.join(', '),
    // Carry internal tags (batch key, formula id, SKU, stock movement, threshold, correction history)
    // separately — the visible `tags` string above strips them, and without this a save would drop
    // every internal tag.
    internalTags: product.tags.filter((tag) => !visibleTags.includes(tag)),
    restockThreshold: getProductRestockThreshold(product),
    stockAdjustmentNote: '',
    stockCorrections: getProductStockCorrections(product),
    images: product.images || (product.imageUrl ? [product.imageUrl] : []),
  };
};

export default toProductFormState;
