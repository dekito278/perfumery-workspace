alter table public.accords
    add column if not exists author_name text;

alter table public.accords
    drop constraint if exists accords_author_name_not_blank;

alter table public.accords
    add constraint accords_author_name_not_blank
    check (author_name is null or char_length(trim(author_name)) > 0);
