import { normalizeProcessImages } from '../utils/processImages.js';
// The shop's own facts that Dekito changes in Studio (Pengaturan toko), stored as one jsonb object in
// storefront_site_settings. Until 2026-11-03 each was typed into the code, so only a developer could
// change them ("cari kolom-kolom yang harusnya bisa saya edit tapi masih statis").
//
// THE DEFAULTS ARE WHAT THE SHOP SAID THAT DAY, so an empty row, a failed fetch or a key nobody has set
// leaves every page saying exactly what it said before. Every fact here is language-neutral — a number,
// a range, a proper noun — because buyer SENTENCES live in the message file in two languages; a fact is
// put into a sentence there, never the sentence stored here.
//
// Left out on purpose: the gift vial's size feeds the parcel weight the ORDER SERVER prices shipping
// from (api/orders/create.js), so it cannot be a browser-side setting; bank details and the WhatsApp
// number stay in Vercel env by Dekito's choice (a stolen Studio login must not redirect buyers' money).
//
// Import-free so the guard and the build run it as it is.

export const DEFAULT_JOURNAL_CATEGORIES = [
  { value: 'formula_accord', label: 'Formula Accord' },
  { value: 'experience', label: 'Experience' },
  { value: 'material_note', label: 'Material Note' },
  { value: 'process', label: 'Process' },
  { value: 'product_idea', label: 'Product Idea' },
];

export const DEFAULT_SITE_FACTS = {
  // The help page (13 Nov 2026). EMPTY by default, on purpose: each is a promise to a buyer, and the shop
  // makes none until Dekito sets it in Studio. Empty means the sentence that would carry it is not shown.
  //   dispatchDays       working days from payment to the parcel leaving, e.g. "1–3"
  //   problemReportDays  days after delivery to report a broken or wrong parcel; 0 = no such promise
  //   contactEmail       an address buyers may write to
  dispatchDays: '',
  problemReportDays: 0,
  contactEmail: '',
  bespokeDays: '7–14',
  quoteHours: 24,
  brandCity: 'Bogor',
  brandFoundedYear: 2023,
  footerOwner: 'SOLIVAGANT by Dekito',
  // Up to four of Dekito's own photos of the work, shown on About when set (brief P2-6). Never stock photos.
  aboutProcessImages: [],
  journalCategories: DEFAULT_JOURNAL_CATEGORIES,
};

/** journal_posts_category_check, mirrored: a key the table would refuse never reaches it. */
export const JOURNAL_CATEGORY_VALUE = /^[a-z][a-z0-9_]{0,39}$/;

export const journalCategoryValueFor = (label) => String(label || '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  .replace(/^(\d)/, 'c_$1').slice(0, 40);

const text = (value, fallback) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);
const whole = (value, fallback, min, max) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

/** "7-14", "7 – 14" or "10" — a day or a range of days, written the way the shop prints a range. */
const dayRange = (value, fallback) => {
  const match = /^\s*(\d{1,3})(?:\s*[–-]\s*(\d{1,3}))?\s*$/.exec(String(value ?? ''));
  if (!match) return fallback;
  const [low, high] = [Number(match[1]), match[2] === undefined ? null : Number(match[2])];
  if (low < 1 || (high !== null && high < low)) return fallback;
  return high === null || high === low ? String(low) : `${low}–${high}`;
};

const categories = (value) => {
  if (!Array.isArray(value)) return DEFAULT_JOURNAL_CATEGORIES;
  const seen = new Set();
  const list = value
    .map((item) => ({ value: String(item?.value || '').trim(), label: text(item?.label, '') }))
    .filter((item) => JOURNAL_CATEGORY_VALUE.test(item.value) && item.label && !seen.has(item.value) && seen.add(item.value));
  return list.length ? list : DEFAULT_JOURNAL_CATEGORIES;
};

/** Every fact, valid, whatever arrives — a typo falls back to the shipped value rather than reaching a page. */
export const normalizeSiteFacts = (input = {}) => {
  const raw = input && typeof input === 'object' ? input : {};
  const email = text(raw.contactEmail, '');
  return {
    dispatchDays: dayRange(raw.dispatchDays, DEFAULT_SITE_FACTS.dispatchDays),
    problemReportDays: whole(raw.problemReportDays, DEFAULT_SITE_FACTS.problemReportDays, 0, 60),
    contactEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120 ? email : DEFAULT_SITE_FACTS.contactEmail,
    bespokeDays: dayRange(raw.bespokeDays, DEFAULT_SITE_FACTS.bespokeDays),
    quoteHours: whole(raw.quoteHours, DEFAULT_SITE_FACTS.quoteHours, 1, 168),
    brandCity: text(raw.brandCity, DEFAULT_SITE_FACTS.brandCity),
    brandFoundedYear: whole(raw.brandFoundedYear, DEFAULT_SITE_FACTS.brandFoundedYear, 1900, 2100),
    footerOwner: text(raw.footerOwner, DEFAULT_SITE_FACTS.footerOwner),
    aboutProcessImages: normalizeProcessImages(raw.aboutProcessImages),
    journalCategories: categories(raw.journalCategories),
  };
};

/** A stored key nobody has in the list any more reads as itself, tidied — never as another category. */
export const journalCategoryLabelIn = (list, value) => (
  (list || []).find((category) => category.value === value)?.label
  || String(value || '').replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase())
);
