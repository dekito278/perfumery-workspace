-- Orders record nothing about where they came from, so "how many sales are desktop?" has no answer.
-- That mattered on 2026-09-08, when the desktop product page turned out to have had an invisible
-- add-to-cart button and there was no way to measure what it cost.
--
-- One jsonb column, written by api/orders/create.js from a whitelisted client hint. Deliberately narrow:
-- which UI the buyer checked out from, and how wide their viewport was. No user agent, no fingerprint —
-- enough to answer the question, not enough to identify anybody.
--
-- Safe to run any time: additive, defaults to an empty object, existing rows keep working.
alter table public.storefront_orders
    add column if not exists client_context jsonb not null default '{}'::jsonb;

comment on column public.storefront_orders.client_context is
    'Whitelisted checkout context: {surface: mobile|desktop, viewport_width: int}. Set server-side in api/orders/create.js.';

-- Verify:
--   select client_context, count(*) from storefront_orders group by 1;
--   -- older rows: {}   new rows: {"surface": "mobile", "viewport_width": 393}
--
-- Rollback:
--   alter table public.storefront_orders drop column if exists client_context;
