// Why buy here rather than on a marketplace — the four things a marketplace cannot offer.
//
// The greeting card in every parcel sends buyers to this site; this is what the site says to them once
// they arrive. Pure data, rendered by one component on both homes so the two never drift. Paths are
// desktop; the component prefixes /mobile when it needs to.
//
// The WhatsApp reason carries no number. The number lives in ONE place (VITE_STOREFRONT_WHATSAPP_NUMBER,
// read through getStorefrontWhatsAppNumber) and the component builds the link — a second copy of the
// number is how the collaboration button on the home page ended up hardcoding it.

// `titleKey` / `bodyKey` / `ctaKey` go through the message file. `to` is a route and stays here.
//
// The member reason carries an `en` override, and that override is the reason this file is not a plain
// list of translation keys. An international buyer does not get the member discount — outside Indonesia
// the price is the export price and signing in does not lower it — so in English this card cannot promise
// one, and its link cannot send them to a sign-in that does nothing for them. Same slot, different true
// statement, different destination.
export const WHY_DIRECT_REASONS = [
  {
    key: 'member',
    titleKey: 'why.member.title',
    bodyKey: 'why.member.body',
    to: '/customer',
    ctaKey: 'why.member.cta',
    en: { titleKey: 'why.intl.title', bodyKey: 'why.intl.body', to: '/catalog', ctaKey: 'why.intl.cta' },
  },
  {
    key: 'atelier',
    titleKey: 'why.atelier.title',
    bodyKey: 'why.atelier.body',
    to: '/bespoke',
    ctaKey: 'why.atelier.cta',
  },
  {
    key: 'first',
    titleKey: 'why.first.title',
    bodyKey: 'why.first.body',
    to: '/catalog',
    ctaKey: 'why.first.cta',
  },
  {
    key: 'whatsapp',
    titleKey: 'why.whatsapp.title',
    bodyKey: 'why.whatsapp.body',
    whatsapp: true,
    ctaKey: 'why.whatsapp.cta',
  },
];

/** The reasons as this shop's visitor should read them. */
export const whyDirectReasons = (region) => WHY_DIRECT_REASONS.map((reason) => (
  region === 'en' && reason.en ? { ...reason, ...reason.en } : reason
));
