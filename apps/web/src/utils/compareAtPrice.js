// Why a struck-through price is not showing.
//
// PriceNote renders a compare-at only when it is ABOVE what is being charged — correctly, since a lower
// number is not a discount. But neither product form ever said so, so typing 5 into "Harga coret" saved
// happily, showed nothing on the storefront, and gave the owner no way to tell a broken field from a
// working one.
//
// Two live products carry exactly that: lintang-asmoro at Rp5 against Rp329.000, and patchouli-so-sexy at
// Rp10 against Rp297.000. Neither has ever displayed anything.
//
// This is a note, not a block. The owner may be mid-keystroke, and a form that refuses to hold a number
// while you are still typing it is worse than one that explains itself.
//
// Import-free so the node guard can test the rule as behaviour.

export const compareAtPriceNote = (variant = {}) => {
  const compareAt = Number(variant?.compareAtPriceNumber || 0);
  const price = Number(variant?.priceNumber || 0);

  // Empty is the normal state: most products have no strike-through at all.
  if (!(compareAt > 0)) return '';

  if (!(price > 0)) return 'Isi harga jual dulu, harga coret belum bisa dibandingkan.';

  if (compareAt <= price) return 'Harga coret harus DI ATAS harga jual, kalau tidak tidak akan tampil di etalase.';

  return '';
};
