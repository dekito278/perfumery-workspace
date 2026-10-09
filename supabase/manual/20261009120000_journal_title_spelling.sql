-- "Vorhees" -> "Voorhees" in the one journal article.
--
-- The shop sells a perfume called Jason Voorhees. The article about it is titled "Kisah Jason
-- Vorhees" — one O — so the atelier's own two spellings of the same name disagree, on the page a
-- curious reader clicks through to. Dekito has decided the NAME stays; this is only the spelling of
-- it being made consistent with the bottle.
--
-- The SLUG is deliberately left alone: kisah-jason-vorhees-32209a44 is a live URL, and changing it
-- breaks every link already pointing at it for the sake of a letter nobody reads in an address bar.
--
-- Deliberately kept OUT of supabase/migrations/ — it edits content, not schema, and content is
-- Dekito's to change.
-- Safe to run twice.

begin;

update public.journal_posts
set title = replace(title, 'Vorhees', 'Voorhees')
where title like '%Vorhees%' and title not like '%Voorhees%';

commit;

-- Check:
-- select slug, title from public.journal_posts order by created_at desc;
