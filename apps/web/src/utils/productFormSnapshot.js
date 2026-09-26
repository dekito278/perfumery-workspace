// One snapshot of a product form, so "are there unsaved changes" is the same question on both layouts.
//
// It was written twice, by hand, and the two lists drifted. The phone's omitted mood, wear and
// intensity — three fields its own form edits — so changing any of them on a phone left the form
// looking untouched: no beforeunload warning, no "discard changes?" on the way out, and the edit gone.
//
// Written by hand is the root of it. A field is added to the form, wired to an input, and the snapshot
// twenty lines up is not where anyone looks. productFormCoversTheForm.selfcheck.mjs closes that by
// deriving the field list from the inputs themselves.
import { moodForEditing } from '@/utils/productMood.js';

export const snapshotProductForm = (product = {}) => JSON.stringify({
  id: product.id || '',
  name: product.name || '',
  category: product.category || '',
  priceNumber: Number(product.priceNumber || 0),
  compareAtPriceNumber: Number(product.compareAtPriceNumber || 0),
  stock: Number(product.stock || 0),
  restockThreshold: Number(product.restockThreshold || 0),
  size: product.size || '',
  variants: product.variants || [],
  notes: product.notes || '',
  topNotes: product.topNotes || '',
  heartNotes: product.heartNotes || '',
  baseNotes: product.baseNotes || '',
  description: product.description || '',
  imageUrl: product.imageUrl || '',
  images: product.images || [],
  tags: product.tags || '',
  // Normalised, not raw: the stored mood and the mood in the editor are different strings for the same
  // thing, so comparing them raw reports an unsaved change on a form nobody has touched.
  mood: moodForEditing(product.mood),
  wear: product.wear || {},
  intensity: product.intensity || 'Medium',
  featured: Boolean(product.featured),
  limited: Boolean(product.limited),
  catalogVisible: Boolean(product.catalogVisible),
});

export default snapshotProductForm;
