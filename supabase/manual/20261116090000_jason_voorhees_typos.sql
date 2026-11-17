-- Two typos in the journal article "Kisah Jason Voorhees" (fresh buyer audit, 15 Nov 2026; Dekito, 16 Nov 2026).
-- Run ONCE in the Supabase SQL editor. Safe to run twice: the second run finds nothing to change.
--
--   "Haloween 2025"   -> "Halloween 2025"
--   "Jason Vorhees"   -> "Jason Voorhees"   (the perfume's own name, as the title already spells it)
--
-- Only the article BODY changes. The title is already right. The address stays
-- /articles/kisah-jason-vorhees-32209a44 on purpose: it is the link already shared, and changing it would
-- break it.

begin;

update public.journal_posts
   set content = replace(replace(content, 'Haloween', 'Halloween'), 'Vorhees', 'Voorhees')
 where slug = 'kisah-jason-vorhees-32209a44'
   and (content like '%Haloween%' or content like '%Vorhees%');

commit;

-- VERIFY
--   select content from public.journal_posts where slug = 'kisah-jason-vorhees-32209a44';
--   -> "Halloween 2025 kemarin saya membuat parfum “Jason Voorhees”, …"
--
-- AFTER: the live page shows the new text at once. The copy that search engines read is written at build
-- time, so it follows on the next deploy of the site.
--
-- UNDO
--   update public.journal_posts
--      set content = replace(replace(content, 'Halloween', 'Haloween'), 'Voorhees', 'Vorhees')
--    where slug = 'kisah-jason-vorhees-32209a44';
