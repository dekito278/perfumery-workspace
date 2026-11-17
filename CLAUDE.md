# SOLIVAGANT — working memory for Claude

One-person artisan perfume shop by Dekito (Bogor), live at https://www.solivagantscent.com.
Owner talks Indonesian; reply to him in Indonesian, plain and short. Code, commits and PRs are in English.

## Shape of the app
- `apps/web`: React + Vite storefront AND the owner's "Studio" (behind a login). Supabase for data/auth,
  Vercel for hosting (`apps/web/vercel.json`). `apps/api`, `apps/pocketbase` are legacy.
- Two shops from one app: Indonesian at `/` (rupiah, domestic only: cart → checkout → payment page with
  bank transfer + proof upload or DOKU) and English at `/en` (buyers abroad, US$, DHL; they order **on
  WhatsApp only** — no checkout form, no payment page, no order number; `/pay/<token>` is retired).
- All buyer text lives in `apps/web/src/i18n/messages.js` (`MESSAGES.id` / `MESSAGES.en`, keys paired).
  Studio text is mostly hardcoded Indonesian in JSX.
- Product content (names, notes, descriptions, prices, stock, articles) lives in Supabase and is Dekito's.

## How every change ships
1. Branch `claude/confident-lovelace-d2ojyu`, reset onto `origin/main` before new work.
2. `cd apps/web && node tools/selfcheck.mjs` (320+ guard chains; a failing guard usually encodes an earlier
   decision — read it before changing it), `npx eslint src api --quiet`, and the build:
   `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=dummy node tools/build.mjs`.
3. Verify in the running app (Playwright; Chromium is preinstalled). Never place an order, sign in, upload,
   or send WhatsApp; stub `**/api/shipping/**`.
4. Commit (trailers from the session), push, open a PR, wait for the Vercel status to be green, squash-merge
   (Dekito allows merging), then check production and report briefly in Indonesian.

## Standing rules from Dekito
- Never change prices (IDR or USD), perfume notes/accords, or the WhatsApp order-confirmation flow.
- Never edit his database directly: write SQL in `supabase/manual/*.sql` and ask him to run it.
- Never invent product content (descriptions, notes, photos).
- Voice: "kami"/"kamu", warm, plain, a little cheeky — taken from his own product copy. Use the name
  "Dekito" rarely (brand line only); he found it "terlalu caper". Perfume is "diracik", not "dirakit".
- Home headline is "Buat yang jalan sendiri." / "For those who wander alone." (what *solivagant* means).
- "kode pelanggan" is the one name for the old SOLI code (no longer handed out; member pricing = member
  code + Google sign-in). "Bespoke ritual" stays as the menu name.

## Policies he agreed (16 Nov 2026) — on the Help page, guarded by returnsPolicyIsWritten
- Damaged/wrong/short parcel: report within 2×24 h with an unboxing video → resend or full refund incl.
  shipping (window can be set in Studio → Fakta toko).
- Change of mind: sealed bottle within 7 days, return shipping on the buyer; opened bottles no return.
- Cancel free before paying (24 h hold); paid-not-shipped = full refund. Bespoke refundable until the
  brief is agreed. Abroad: duties on recipient, no shipping refund if refused at customs.
- Refund within 3 working days of approval.
- Footer "Tetap terhubung" is WhatsApp-only (no email list).

## Open items (as of 17 Nov 2026)
- Dekito to run `supabase/manual/20261116090000_jason_voorhees_typos.sql`; then merge it so the next deploy
  refreshes the article's prerendered copy.
- Owner content: stock for Samhain / Ambar Segara; descriptions, notes and photos for Samhain, Bloody
  Luwak, Ambar Segara; bottle photos for Aquilaria tuberosa, HUG N°1, Jata Bhumi, Maskumambang, Pantura,
  Sudra (white label cards today).
- Larger follow-ups not done: bespoke checkout differs from the main checkout; Studio customer search;
  bespoke settings only on the phone Studio; restocking an existing product from a batch.
