// Turning a journal category into an address, and an address back into a category.
//
// Lives here rather than inside PublicJournalPage so it can actually be RUN by a guard. A rule asserted
// against JSX is a rule asserted against the shape of a file; these three lines decide whether a reader
// who shares /journal?category=material_note lands on the material stories or silently on All, and that
// is worth executing rather than pattern-matching.
//
// The URL carries the stored `value` (material_note), not the label (Material Note), because the value
// is what the database and the editor already agree on. Labels are display text: the day one is reworded
// every link anyone ever shared would break.
//
// The param name is English because ONE component serves both shops — /en/journal is the same page, so
// an Indonesian param would put Indonesian in the English shop's address bar. A parameter name is an
// identifier, not text to translate, so it gets a neutral name rather than a message key. The i18n guard
// caught this the first time round, when it read ?kategori=.

import { JOURNAL_CATEGORIES } from '@/services/journalPostsSupabaseService.js';

export const JOURNAL_TAB_PARAM = 'category';

/** The tab every reader starts on, and the one an unknown value falls back to. */
export const JOURNAL_ALL_TAB = 'All';

export const journalCategoryValue = (label) => (
  JOURNAL_CATEGORIES.find((category) => category.label === label)?.value || ''
);

/** An unknown, empty or removed value lands on All rather than on an empty grid. */
export const journalCategoryLabelFromUrl = (value) => (
  JOURNAL_CATEGORIES.find((category) => category.value === value)?.label || JOURNAL_ALL_TAB
);

/** All has no parameter: the plain /journal stays the plain /journal. */
export const journalTabPath = (label) => {
  const value = journalCategoryValue(label);
  return value ? `/journal?${JOURNAL_TAB_PARAM}=${value}` : '/journal';
};
