-- Audit round 8 — the third table left behind by the admin lockdown, and the one with a public face.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor. Deploying the app does not apply it.
--
-- 1) journal_posts writes are gated on self-ownership, not on being an admin:
--      "journal posts insert own"  for insert with check (auth.uid() = user_id)
--      "journal posts update own"  for update using  (auth.uid() = user_id)
--      "journal posts delete own"  for delete using  (auth.uid() = user_id)
--    (20260519145000_journal_posts_production_hardening.sql:13-23)
--    while the public read is author-blind:
--      "journal posts select published"  for select using (status = 'published')
--    (20260519150000_journal_posts_public_published_access.sql:23-25)
--
--    Customer Google login (and email signup) makes any shopper `authenticated`, so anyone with an account
--    can POST a row with their own user_id and status='published' using the anon key that ships in the JS
--    bundle. It then appears on /journal and gets its own /articles/<slug> page carrying the shop's
--    branding and Article JSON-LD — and the owner never sees it, because the studio list is scoped to
--    their own rows. This is exactly the gap 20260715120000 was created to close and 20260817120000
--    finished for product_stories; journal_posts was missed by both.
--
--    Ownership is KEPT alongside is_admin(): an admin still only edits their own posts, so nothing changes
--    for the owner. What goes away is a non-admin being able to write at all.
--
-- 2) product_stories is readable in full by anon regardless of the `enabled` switch
--    (20260709120000_product_stories.sql:39-42 — `for select using (true)`). The editor presents `enabled`
--    as the publish toggle ("Immersive page aktif"), but the only thing honouring it is JavaScript
--    (productStoryService.fetchStoryConfig), so unpublishing does not unpublish: draft hero copy and
--    unreleased product narratives stay one anon REST call away. 20260817120000 admin-locked the write
--    side of this table but left the read policy alone.
--
-- Rollback:
--   recreate the three "journal posts ... own" policies without the is_admin() conjunct, and
--   create policy "product stories public read" on public.product_stories for select using (true);

-- 1) journal_posts -------------------------------------------------------------------------------------

drop policy if exists "journal posts insert own" on public.journal_posts;
create policy "journal posts insert own" on public.journal_posts
    for insert with check (public.is_admin() and auth.uid() = user_id);

drop policy if exists "journal posts update own" on public.journal_posts;
create policy "journal posts update own" on public.journal_posts
    for update using (public.is_admin() and auth.uid() = user_id)
    with check (public.is_admin() and auth.uid() = user_id);

drop policy if exists "journal posts delete own" on public.journal_posts;
create policy "journal posts delete own" on public.journal_posts
    for delete using (public.is_admin() and auth.uid() = user_id);

-- 2) product_stories -----------------------------------------------------------------------------------
-- Public reads see enabled stories only; the studio still sees everything through is_admin().

drop policy if exists "product stories public read" on public.product_stories;
create policy "product stories public read" on public.product_stories
    for select using (enabled or public.is_admin());
