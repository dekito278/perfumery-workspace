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
- The visitor's COUNTRY picks the shop (18 Nov 2026, `apps/web/middleware.js` + `src/utils/shopByCountry.js`):
  abroad → `/en` (US$, no member, no rupiah anywhere), Indonesia → `/`. No ID/EN switch on the pages. Robots,
  order pages (payment, pay, track, invoices), Studio and login are never moved. Dekito previews the other
  shop with `?toko=en` / `?toko=id` (cookie, 30 days); `?toko=auto` turns it back on.
- "Cara jadi member" opens WhatsApp ("saya mau jadi member"); Dekito replies with a code (Indonesian shop only).
- Free vial: one per bottle, at most 3 per order, each a different scent (18 Nov 2026); server enforces it.
- Discovery sets (category "Discovery Set", `src/utils/discoverySet.js`): Set I–III Rp199.000 / US$35, Set IV
  Rp269.000 / US$45, Set Lengkap Rp699.000 / US$115 (Dekito's numbers). Not a bottle → no free vial; no
  automatic member/export price. Abroad a set rides with a bottle (one set per bottle adds no DHL weight).
  English shop shows English set names from `SET_NAMES_EN` (he asked, 19 Nov 2026); perfume names never change.

## Policies he agreed (16 Nov 2026) — on the Help page, guarded by returnsPolicyIsWritten
- Damaged/wrong/short parcel: report within 2×24 h with an unboxing video → resend or full refund incl.
  shipping (window can be set in Studio → Fakta toko).
- Change of mind: sealed bottle within 7 days, return shipping on the buyer; opened bottles no return.
- Cancel free before paying (24 h hold); paid-not-shipped = full refund. Bespoke refundable until the
  brief is agreed. Abroad: duties on recipient, no shipping refund if refused at customs.
- Refund within 3 working days of approval.
- Footer "Tetap terhubung" is WhatsApp-only (no email list).

## Open items (as of 19 Nov 2026)
- Owner content: stock for Samhain / Ambar Segara (Studio batch → Stok → "Tambah stok" adds to an existing
  product); descriptions, notes and photos for Samhain, Bloody Luwak, Ambar Segara; bottle photos for
  Aquilaria tuberosa, HUG N°1, Jata Bhumi, Maskumambang, Pantura, Sudra (white label cards today).
- Discovery sets are live (SQL 20261118120000, 20261119090000, 20261119100000 run) but stock is 0 until
  Dekito fills it in Studio. A set ships as 250 g (his scale, 19 Nov 2026; Set Lengkap's own weight not
  given yet). Still waiting: the code printed on the Rp50.000/Rp100.000 card (make it a voucher).
- Studio product screens read the full table since 19 Nov 2026 (#694): drafts show, internal tags survive.

## Verifying Studio screens
- Studio needs an admin session, which we never have. Run the dev server with
  `VITE_SUPABASE_URL=https://example.supabase.co VITE_ADMIN_EMAILS=studio@example.test`, put a fake session
  in localStorage key `solivagant.supabase.auth.v1`, and answer every `*.supabase.co` request from Playwright
  routes (stub rows; writes fulfilled locally). Nothing reaches the real backend.
