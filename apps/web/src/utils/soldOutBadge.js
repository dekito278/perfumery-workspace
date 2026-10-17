/**
 * Does this card have to say "Stok habis"?
 *
 * Only the PUBLIC catalogue shape carries publicStatus — getPublicFragranceCatalog derives it from the
 * variant stock total. A Studio row has a raw `stock`, a cart line has `maxStock`, and neither has the
 * field at all, so both are inert here rather than being badged on a missing value: `undefined !==
 * 'Available'` is true, and keying the badge off that alone would have stamped "Stok habis" across every
 * product in the Studio and every line in the cart.
 *
 * `soldOut` is the opt-out for a surface that already states the state in its own words — the product
 * page's disabled button, the catalogue's disabled quick-add pill.
 */
export const showsSoldOutBadge = (product, soldOut = true) => (
  Boolean(soldOut) && Boolean(product?.publicStatus) && product.publicStatus !== 'Available'
);

export default showsSoldOutBadge;
