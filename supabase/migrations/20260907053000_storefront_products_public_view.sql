-- Audit round 9, P-1b (step 1 of 2, ADDITIVE — safe to run any time, before deploying the client).
--
-- storefront_products.tags carries the studio's internal bookkeeping next to the public tags:
-- "COGS per bottle: …", "Batch ID: …", "SKU: …", "Initial stock: …", "Restock threshold: …" and up to 20
-- "Stock correction: …" blobs. RLS filters rows, not columns, so on a PUBLISHED product all of it is readable
-- by anyone with the anon key. Admins and Google-login customers both hold the `authenticated` role, so no
-- column grant can separate them either. The only shape that works: the table becomes admin-only (step 2)
-- and the public reads this view, which drops draft rows and strips the internal tags.
--
-- Prefix list mirrors PRODUCT_INTERNAL_TAG_PREFIXES in apps/web/src/services/productCatalogService.js.
-- Adding a prefix there without adding it here re-opens the leak for that prefix — see the runbook check.
create or replace function public.storefront_product_tag_is_internal(p_tag text)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
    select lower(btrim(coalesce(p_tag, ''))) like any (array[
        'batch key:%', 'batch id:%', 'batch code:%', 'formula id:%', 'batch target ml:%', 'bottle ml:%',
        'dilution percent:%', 'loss percent:%', 'usable ml:%', 'cogs per bottle:%', 'initial stock:%',
        'sku:%', 'stock movement:%', 'batch published at:%', 'restock threshold:%', 'stock correction:%'
    ]);
$$;

-- Owner-rights view (default security_invoker = off), so it reads the table regardless of the caller's RLS.
-- Same columns as the table, in the same order, with `tags` replaced by the filtered list — so the client's
-- fromDatabaseRow needs no change. New table columns need this view recreated to show up.
create or replace view public.storefront_products_public as
    select (jsonb_populate_record(
        null::public.storefront_products,
        to_jsonb(p) || jsonb_build_object(
            'tags',
            coalesce(
                (select jsonb_agg(tag)
                 from jsonb_array_elements_text(coalesce(p.tags, '[]'::jsonb)) as tag
                 where not public.storefront_product_tag_is_internal(tag)),
                '[]'::jsonb
            )
        )
    )).*
    from public.storefront_products p
    where not public.storefront_product_is_draft(p.tags);

grant select on public.storefront_products_public to anon, authenticated;

-- Verify (anon key): no internal prefix survives, drafts are absent.
--   curl -s "$SUPABASE_URL/rest/v1/storefront_products_public?select=slug,tags" -H "apikey: $ANON" \
--     | grep -iE 'cogs per bottle|batch id|sku:|initial stock|restock threshold|stock correction|studio draft'
--   → must print nothing.
