// Adding a batch to a product that already exists (17 Nov 2026). Until then every finished batch minted a
// NEW draft product, so the second batch of a perfume already on sale became a duplicate with a duplicate
// page, and the stock had to be retyped by hand on the real one.
//
// This plans the change only; the service writes it. It moves STOCK and nothing else: price, notes,
// photos and every other variant stay exactly as they are (Dekito: prices are never touched by a tool).

const mlOf = (size) => {
  const match = String(size || '').replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

/** The variant a batch of `bottleMl` bottles belongs to: the one whose size says the same millilitres. */
export const matchingVariantId = (variants = [], bottleMl = 0) => {
  const list = Array.isArray(variants) ? variants : [];
  const hit = list.find((variant) => variant && typeof variant === 'object' && mlOf(variant.size) === Number(bottleMl));
  return hit ? String(hit.id || '') : '';
};

/** Products a batch may restock: real perfumes the Studio can edit, the one made from this formula first. */
export const restockCandidates = (products = [], { formulaId = '', formulaIdOf = () => '', isGift = () => false } = {}) => (
  (Array.isArray(products) ? products : [])
    .filter((product) => product?.id && !String(product.id).startsWith('custom-') && !isGift(product))
    .map((product) => ({ product, same: Boolean(formulaId) && String(formulaIdOf(product) || '') === String(formulaId) }))
    .sort((a, b) => Number(b.same) - Number(a.same) || String(a.product.name || '').localeCompare(String(b.product.name || ''), 'id'))
    .map(({ product }) => product)
);

/**
 * New variants and stock for `row` (the product as stored) after adding `bottles` to `variantId`.
 * Throws in words the Studio shows when the change cannot be made safely.
 */
export const planBatchRestock = ({ row, variantId, bottles, note = '', now = new Date().toISOString() }) => {
  const count = Math.floor(Number(bottles || 0));
  if (!row) throw new Error('Produk tujuan tidak ditemukan. Muat ulang lalu pilih lagi.');
  if (count <= 0) throw new Error('Jumlah botol dari batch ini masih 0.');
  const variants = Array.isArray(row.variants) ? row.variants : [];
  if (!variants.length || variants.some((variant) => !variant || typeof variant !== 'object' || !variant.id)) {
    throw new Error(`${row.name || 'Produk ini'} masih memakai format ukuran lama. Buka produknya dan simpan sekali, lalu coba lagi.`);
  }
  const target = variants.find((variant) => String(variant.id) === String(variantId));
  if (!target) throw new Error('Pilih ukuran produk yang mendapat stok batch ini.');

  const before = Math.max(Number(target.stock || 0), 0);
  const nextVariants = variants.map((variant) => (
    String(variant.id) === String(variantId) ? { ...variant, stock: before + count } : variant
  ));
  const previousStock = variants.reduce((sum, variant) => sum + Math.max(Number(variant.stock || 0), 0), 0);
  const nextStock = previousStock + count;
  return {
    variants: nextVariants,
    stock: nextStock,
    correction: {
      id: `stock-${Date.parse(now) || Date.now()}`,
      at: now,
      actor: 'Admin',
      note: note || `Tambah ${count} botol dari batch`,
      previousStock,
      nextStock,
      variants: [{ id: target.id, size: target.size, before, after: before + count }],
    },
  };
};
