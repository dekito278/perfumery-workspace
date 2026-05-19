update public.journal_posts
set category = 'process'
where category = 'experiment';

alter table public.journal_posts
    drop constraint if exists journal_posts_category_check;

alter table public.journal_posts
    add constraint journal_posts_category_check
    check (category in ('formula_accord', 'experience', 'material_note', 'process', 'product_idea'));
