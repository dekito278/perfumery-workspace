# Round 8 — the six open decisions, decided

The owner delegated all six. Four are closed here; two are genuinely not mine to close, and saying so is
part of the answer.

## 1. Drop the brief tables — NO, do not run it

`20260819125000_drop_brief_tables.sql` stays unapplied. The tables are empty and unreferenced, so they cost
nothing but a line in the table list; the drop is irreversible. There is no upside worth an irreversible
action. Keep the file for whenever the owner wants a tidy-up with their own eyes on the row counts.

## 2. QRIS — stays disabled, and this is not a decision

Blocked on DOKU sandbox credentials, which cannot be obtained from here. Writing the SNAP signature branch
without being able to test it is worse than leaving it absent: a wrong HMAC silently rejects real payments.
`VITE_QRIS_ENABLED` stays off and both `api/doku/qris.js` and the flag carry do-not-enable warnings.

## 3. Payment-proof ownership — leave as hardened

Round 7 already required the proof path to sit under the order's own folder, refused overwriting an
approved proof, and trimmed the response to the fields the buyer's own page renders. What remains is that a
valid order number is enough to attach a file. Closing that means putting the security question in front of
the upload — friction in a payment flow, for a residual risk where the worst case is an admin seeing a
wrong image and rejecting it. Not worth the conversion cost. Revisit if it is ever actually abused.

## 4. TOTP / `aal` — fixed in two steps, because one step would have locked the owner out

The server-side gap was real: `is_admin()` never checked the JWT's `aal`, so a password-only login was
enough. But adding the check on its own would have been a bad decision, and the reason only shows up in the
code: **"remember this device" skipped the TOTP challenge outright**, on the strength of a plain
localStorage object (`{userId, verifiedAt}`) anyone can hand-write. Those sessions sit at aal1 while the app
treats them as verified — so an `aal2` requirement would have locked the owner out of every row on every
browser where they had used remember-me, immediately.

So the bypass is the real hole, and it goes first:

- **Step 1 (this branch, code):** remember-me now only suppresses the *prompt* for a session Supabase itself
  reports as `aal2`. Anything less is challenged, and the stale remembered entry is cleared. This also
  closes the bypass on its own — a hand-written localStorage entry no longer skips anything.
- **Step 2 (owner, after deploying step 1):** apply
  `20260819127000_is_admin_requires_aal2.sql`. It carries the precondition, how to verify the session first,
  and the rollback — which works, because the SQL editor connects as the owner and bypasses RLS.

Step 1 is worth having even if step 2 is never applied.

## 5. Reservation sweep still daily — needs a paid plan, not a code change

Vercel Hobby allows one cron run per day. What softens it is already in place: orders now really carry
`payment_expires_at`, and both the studio order list and `/api/doku/status` sweep an order they touch, so
only a checkout that is abandoned *and* never looked at waits for the nightly run.

## 6. Product stories on mobile — NOT built, and my earlier description of it was wrong

I called this "a page that never loads". That was an overstatement: the mobile product page loads fine, it
simply renders the catalog `story` text instead of the immersive Supabase story. It is a missing feature,
not a break. Building an immersive mobile layout means real design decisions about a marketing surface —
inventing them here would be worse than leaving the working page alone.

## Also open, and it needs the owner's hand

`VITE_PUBLIC_SITE_URL` in Vercel is set to the apex `https://solivagantscent.com`, but the apex answers
**307 → www**. So every canonical, `og:url`, JSON-LD `@id`, sitemap entry and prerendered head points at a
URL that only redirects. The code default is already `www` (`utils/seo.js`); the env var overrides it.
One env change plus a rebuild fixes all of them at once. Not fixable from the repo.
