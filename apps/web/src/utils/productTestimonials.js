// Buyer quotes: what the owner pasted, cleaned up, never invented.
//
// Dekito chose this over a review system on 25 Oct against his own numbers: 35 orders ever, 24 paid, and
// the best-selling perfume has four buyers. A form with stars and a moderation queue would, at full
// participation, show 4 reviews on the best page and 0 or 1 on most — and "Ulasan (0)" on 14 of 18
// product pages announces that nobody has bought. So these are quotes from WhatsApp and Instagram,
// pasted by hand, with no rating attached and nothing averaged.
//
// NOTHING HERE GENERATES A QUOTE. There is no placeholder, no sample, no filler. An empty column stays
// empty and the product page says nothing, because a fabricated customer sentence is a fake review
// whatever it is called and whatever it is for.
//
// Free of framework imports: the storefront, the Studio form and the guards all read these rules.

/** Caps, so one pasted wall of text cannot push the add-to-cart button off the screen. */
export const TESTIMONIAL_LIMITS = { quote: 400, name: 60, city: 60, count: 12 };

const clean = (value, limit) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);

/**
 * The quotes worth showing, in the order they were written.
 *
 * A quote is the only required part: a buyer who did not want their name used still said the thing. An
 * entry with no quote is dropped rather than rendered as an empty card with a name under it.
 */
export const normalizeTestimonials = (value) => {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((row) => ({
      quote: clean(row?.quote ?? row?.text, TESTIMONIAL_LIMITS.quote),
      name: clean(row?.name, TESTIMONIAL_LIMITS.name),
      city: clean(row?.city, TESTIMONIAL_LIMITS.city),
    }))
    .filter((row) => row.quote.length > 0)
    .slice(0, TESTIMONIAL_LIMITS.count);
};

export const hasTestimonials = (product) => normalizeTestimonials(product?.testimonials).length > 0;

/** "Rina, Bandung" / "Rina" / "Bandung" / "" — whichever parts the buyer let us print. */
export const testimonialAttribution = (row) => [row?.name, row?.city].map((part) => String(part || '').trim()).filter(Boolean).join(', ');
