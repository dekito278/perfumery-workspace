-- Audit rounds 6-8 — the TOTP factor protects nothing server-side.
--
-- MANUAL APPLY, AND ONLY AFTER THE PRECONDITION BELOW HOLDS.
--
-- is_admin() (20260715120000) checks only membership in storefront_admins by auth.uid(). No policy anywhere
-- checks the JWT's `aal` claim, so a password-only login yields an aal1 token that every policy accepts.
-- The MFA prompt was pure React.
--
-- PRECONDITION — deploy the code change that ships with this migration FIRST, and confirm you can log in.
-- "Remember this device" used to skip the TOTP challenge entirely on the strength of a hand-writable
-- localStorage object, leaving the session at aal1 while the app treated it as verified. Applying this
-- migration against such a session locks you out of every row until you re-verify. The code fix makes
-- remember-me only suppress the prompt for a session Supabase already reports as aal2, so after deploying
-- it every real login reaches aal2.
--
-- Check your own session first, in the browser console of the studio while logged in:
--     (await window.supabase?.auth?.mfa?.getAuthenticatorAssuranceLevel())?.data
-- or simply: log out, log back in, and enter a TOTP code. Then apply this.
--
-- IF IT LOCKS YOU OUT: you are not stuck. This SQL editor connects as the table owner and bypasses RLS, so
-- run the rollback at the bottom and you are back where you started.
--
-- NOTE: this only closes the gap for users who HAVE a TOTP factor enrolled. An admin with no factor still
-- gets aal1 and would be locked out — which is the intended effect, but enrol first.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.storefront_admins a where a.user_id = auth.uid()
    )
    and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- Rollback — restores the original definition exactly:
-- create or replace function public.is_admin()
-- returns boolean language sql stable security definer set search_path = public as $$
--     select exists (select 1 from public.storefront_admins a where a.user_id = auth.uid());
-- $$;
