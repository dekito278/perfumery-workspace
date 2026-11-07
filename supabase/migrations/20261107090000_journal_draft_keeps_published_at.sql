-- Pulling an article back to draft erases the date it was first published.
--
-- 20260819126000 took the clearing branch out of set_journal_post_share_fields, but the save could
-- not use it: journal_posts_published_at_matches_status (20260519145000) still demanded
-- `status = 'draft' and published_at is null`, so the client had to send null for every draft.
-- An article first published in May, unpublished to fix a typo, came back dated today — on the page,
-- in the Article JSON-LD datePublished and in the sitemap.
--
-- Only the draft half goes. A published article still needs a date (the trigger stamps one when the
-- save sends none); a draft may now keep the date it was first published on.
--
-- Rollback: update journal_posts set published_at = null where status = 'draft'; then re-add the old
-- check under its old name.

alter table public.journal_posts
    drop constraint if exists journal_posts_published_at_matches_status;

alter table public.journal_posts
    drop constraint if exists journal_posts_published_has_date;

alter table public.journal_posts
    add constraint journal_posts_published_has_date
    check (status <> 'published' or published_at is not null);
