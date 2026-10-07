-- Undo 20261007170000_notes_without_the_label.sql: put the "Fragrance Notes:" heading back.
--
-- Worth knowing before running it: the heading is shown to buyers in the cart line and to Dekito in
-- the Studio product list, and it makes "fragrance" and "notes" match every product in catalog
-- search. That is why it was removed.
--
-- Deliberately kept OUT of supabase/migrations/ so no migration run can apply it by accident.
-- Safe to run twice.

begin;

update public.storefront_products set
    notes    = 'Fragrance Notes: ' || notes,
    notes_en = 'Fragrance Notes: ' || notes_en
where slug <> 'vial-hadiah'
  and coalesce(notes, '') <> ''
  and notes not like 'Fragrance Notes:%';

commit;
