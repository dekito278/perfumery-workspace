-- "Fragrance Notes:" is a heading, not data.
--
-- Dekito asked to tidy up after I mentioned the prefix was polluting catalog search. Tracing where
-- `notes` actually goes turned up more than search: the field is DISPLAYED in three places, and the
-- label is wrong in every one of them.
--
--   CartPage.jsx / InternationalCartPage.jsx   the line under a product in the cart reads
--                                              "{notes} · {size}", so a bottle in the cart said
--                                              "Fragrance Notes: Green, Wet Moss, … · 30 ml"
--   ProductListPage.jsx / mobile               the subtitle under each product in Studio
--   publicStorefront.js                        the subtitle fallback for a product with none
--
-- And two more places it is read rather than shown: the desktop catalog search haystack, where the
-- prefix made "fragrance" and "notes" match all nineteen products, and the category guess for a
-- product filed under nothing.
--
-- The Bortnikoff format Dekito asked for is the comma-separated list of materials with accords
-- labelled as accords. "Fragrance Notes:" is the heading printed above that list on their page --
-- it belongs to the page, not to the value. Removing it fixes every surface above at once and needs
-- no code change.
--
-- Safe to run twice: after the first run nothing matches the WHERE clause.
-- To undo: supabase/manual/20261007170000_notes_without_the_label.rollback.sql

begin;

update public.storefront_products set
    notes    = regexp_replace(notes,    '^Fragrance Notes:\s*', ''),
    notes_en = regexp_replace(notes_en, '^Fragrance Notes:\s*', '')
where notes like 'Fragrance Notes:%' or notes_en like 'Fragrance Notes:%';

commit;

-- Check — the list survives, the heading does not:
-- select slug, notes_en from public.storefront_products where slug <> 'vial-hadiah' order by name;
