-- Audit round 8 — unpublishing an article destroys the date it was published.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor.
--
-- set_journal_post_share_fields (20260519145000:53-58) does:
--     if new.status = 'published' and new.published_at is null then
--         new.published_at := timezone('utc', now());
--     elsif new.status = 'draft' then
--         new.published_at := null;          <-- here
--     end if;
--
-- So pulling an article back to draft to fix a typo erases its publication date, and republishing
-- back-stamps it to today. An article first published in May comes back dated August: wrong on the page,
-- wrong in the Article JSON-LD `datePublished`, and wrong in the sitemap's lastmod.
--
-- Keeping the date is also what makes it meaningful — "first published" should not move because the author
-- corrected a sentence. The rest of the function (slug generation, id defaulting) is unchanged; only the
-- one `elsif` branch goes.
--
-- Rollback: re-add `elsif new.status = 'draft' then new.published_at := null;` to the function body.

create or replace function public.set_journal_post_share_fields()
returns trigger
language plpgsql
as $$
declare
    base_slug text;
begin
    if new.id is null then
        new.id := gen_random_uuid();
    end if;

    base_slug := lower(regexp_replace(trim(coalesce(new.title, 'journal-note')), '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);

    if base_slug = '' then
        base_slug := 'journal-note';
    end if;

    if new.slug is null or trim(new.slug) = '' then
        new.slug := base_slug || '-' || left(replace(new.id::text, '-', ''), 8);
    else
        new.slug := lower(regexp_replace(trim(new.slug), '[^a-zA-Z0-9]+', '-', 'g'));
        new.slug := trim(both '-' from new.slug);

        if new.slug = '' then
            new.slug := base_slug || '-' || left(replace(new.id::text, '-', ''), 8);
        end if;
    end if;

    -- Stamp the first publication, and never clear it again.
    if new.status = 'published' and new.published_at is null then
        new.published_at := timezone('utc', now());
    end if;

    return new;
end;
$$;
