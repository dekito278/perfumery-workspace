# Audit pass-2 — Server-side action items

Findings from the pass-2 module audit whose fix lives in Supabase (RPC/RLS/schema), not the frontend.
All verified against `supabase/migrations/*` and the app services. **SQL below is illustrative — adapt
column names / policies to your schema and test on staging before applying to production.**

Root theme: the 100 000-value customer code (`SOLI#####`) is the sole credential, and checkout +
order INSERT are public/anon. Everything below follows from that.

| # | Problem | Fix |
|---|---------|-----|
| 1 | Portal enumeration by code (security gate is opt-in) | Rate-limit the RPC + default-on security, or non-enumerable code |
| 2 | Order `subtotal` is client-authoritative (anon INSERT) | `storefront_create_order` RPC recomputes price/shipping/voucher; lock down direct INSERT |
| 3 | Sharing an invoice link leaks the whole account | Per-order invoice token + by-token RPC |
| 4a | `storefront_lookup_customer` leaks name+contact+**address** with no gate | Require security answer / drop address / admin-only |
| 4b | `storefront_submit_payment_proof` has no ownership binding | Bind to session/token + rate-limit |

---

## 1. Portal enumeration — `storefront_customer_portal`

**Evidence:** `20260508133000_storefront_customer_security_challenge.sql:62-75` — returns full customer +
orders when `security_question` is NULL; the gate only engages if the customer opted in.
`storefront_customer_portal` is `security definer` and (no REVOKE anywhere) executable by `anon`.

**Impact:** loop `SOLI00000..SOLI99999` → harvest name, contact, area, and order history for every
customer who never set a security question (the default).

**Fix (defense in depth):**
- **Pure SQL can't rate-limit.** Put the RPC behind a rate limiter: a Postgres counter table keyed by
  IP/code with a per-window cap, or (better) a Supabase Edge Function / API gateway in front that
  throttles and adds a CAPTCHA after N misses.
- **Raise the code entropy** so brute force isn't 100k: widen `generate_storefront_customer_code()` to
  e.g. 4 base32 chars + 4 digits, or append a random suffix. Enumeration cost jumps by orders of magnitude.
- Consider defaulting `security_question` on for new customers (product decision).

```sql
-- Sketch: per-code attempt throttle (adapt window/cap; needs a cleanup job)
create table if not exists public.portal_lookup_attempts (
  key text primary key,           -- e.g. hashed IP or code
  window_start timestamptz not null default now(),
  attempts int not null default 0
);
-- inside storefront_customer_portal, before the select: upsert + count, raise if attempts > N in window.
```

## 2. Client-authoritative order subtotal — `createOrder` anon INSERT

**Evidence:** `apps/web/src/services/orderService.js:1233` inserts `storefront_orders` client-side with a
client-computed `subtotal`. `20260715121000_admin_write_rls_lockdown.sql:9` confirms: *"Order creation:
kept as public INSERT (anon checkout)."* The DOKU endpoint (`apps/web/api/doku/checkout.js`) already
re-reads `subtotal` from the DB and rejects `amount<=0` / `paid` — but the DB value itself is
client-set, so DOKU can still be charged a tampered (down to Rp 1) amount; manual transfer has no floor.
Affects **catalog and bespoke** (bespoke option prices live in `storefront_bespoke_options`, so the
server *can* recompute them).

**Fix:** move creation into a `security definer` RPC that ignores any client total and recomputes:

```sql
create or replace function public.storefront_create_order(
  p_items jsonb,            -- [{product_slug, variant_id, quantity}] or {bespoke_option_ids:[...]}
  p_customer_code text,
  p_destination jsonb,      -- for server-side shipping calc
  p_voucher_code text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_subtotal numeric := 0; /* ... */ begin
  -- 1. sum catalog line prices from products/variants by id (NOT from p_items)
  -- 2. add bespoke option prices from storefront_bespoke_options by id
  -- 3. add server-computed shipping (see below), subtract validated voucher
  -- 4. insert storefront_orders with the server subtotal; return the row
end $$;
```

Then **remove the public INSERT policy** on `storefront_orders` and grant only this RPC:

```sql
drop policy if exists "anon insert orders" on public.storefront_orders;  -- name per your schema
revoke insert on public.storefront_orders from anon;
grant execute on function public.storefront_create_order(jsonb,text,jsonb,text) to anon, authenticated;
```

> This RPC is also the correct home for **server-side shipping** — which fixes the CRITICAL shipping-promo
> bug (promo currently read from client localStorage, never applied for real customers). Compute the rate
> + promotion from `storefront_shipping_promotion` here instead of trusting the client.

## 3. Invoice link leaks the account — per-invoice token

**Evidence:** `apps/web/src/pages/CustomerInvoicePage.jsx:277` loads the whole portal by `code`; the
invoice URL carries `?code=` (`:290`). A shared invoice hands over the account credential.

**Fix:** opaque per-order token, resolved by its own RPC that returns only that order.

```sql
alter table public.storefront_orders
  add column if not exists invoice_token text unique default encode(gen_random_bytes(16), 'hex');

create or replace function public.storefront_invoice_by_token(p_order_number text, p_token text)
returns jsonb language sql security definer set search_path = public as $$
  select to_jsonb(o) from public.storefront_orders o
  where o.order_number = p_order_number and o.invoice_token = p_token limit 1;
$$;
```
Frontend: build invoice links with `?token=` instead of `?code=`.

## 4a. `storefront_lookup_customer` — ungated PII incl. address

**Evidence:** `20260508110000_storefront_customers.sql:61-93` — `security definer`, returns
`customer_name, contact, delivery_address, delivery_area` `where customer_code = code`, no security gate,
anon-executable. **Bypasses the portal's security-question protection** and is reachable from the public
bespoke prefill (`MobileBespokePage` lookup).

**Fix — pick one:**
- Require the security answer (mirror `storefront_customer_portal_verify`), OR
- Drop `delivery_address`/`contact` from its output (prefill can fill area only), OR
- Restrict execution to authenticated admins: `revoke execute ... from anon;`

## 4b. `storefront_submit_payment_proof` — no ownership binding

**Evidence:** `20260511120000_storefront_submit_payment_proof.sql:1-26` + `:44` (`grant ... to anon`) —
updates any order's proof by `order_number`, no caller/ownership check.

**Impact:** a stranger with an order number can flip `payment_proof_status` to `submitted`. Note it now
interacts with the round-3 auto-cancel guard: a junk proof keeps an abandoned order from auto-expiring.

**Fix:** require the invoice token (from #3) or the customer code+security to prove ownership, and
rate-limit. Also confirm the storage bucket `orders/` write policy isn't open to anon beyond this path.

---

## Verification (staging)
- With the anon key, call `storefront_lookup_customer('SOLI00001')` directly → should NOT return
  address/contact once 4a lands.
- Insert `storefront_orders` with `subtotal:1` via anon → should be rejected once INSERT is locked (2).
- Open an invoice with `?code=` → should stop working once links move to `?token=` (3).
- Hammer `storefront_customer_portal` >N times → should throttle (1).
