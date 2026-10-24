-- One atomic way to SET a product's stock to a known number.
--
-- MANUAL APPLY REQUIRED: run this in the Supabase SQL editor. Deploying the app does not apply it.
--
-- The Telegram bot can change stock from a phone. Stock has exactly two sanctioned movements today —
-- the order RPCs, and saveCustomProduct's full-row write under an optimistic lock on updated_at — and
-- a third way that simply assigns a number is how audit round 7's bug worked: a value decided before
-- an order deducted stock, written after it, silently resurrecting the sold units.
--
-- So the bot does not write the column. It calls this, which re-reads the row inside the statement and
-- refuses when the row moved since the caller looked. The caller passes the updated_at it saw; a
-- mismatch returns false and the bot says "stok berubah barusan, coba lagi" instead of clobbering.
--
-- Admin-only: the bot reaches Postgres with the service role, but anon and authenticated must not be
-- able to call this at all. Postgres grants EXECUTE to PUBLIC by default, which is why the revoke
-- below names PUBLIC and not just anon — revoking from anon alone leaves the PUBLIC grant standing.

create or replace function public.storefront_set_stock(
  p_product_id uuid,
  p_stock integer,
  p_expected_updated_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed integer;
begin
  if p_stock is null or p_stock < 0 then
    raise exception 'stock must be zero or more';
  end if;

  update public.storefront_products
     set stock = p_stock,
         updated_at = now()
   where id = p_product_id
     and (p_expected_updated_at is null or updated_at = p_expected_updated_at);

  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;

revoke execute on function public.storefront_set_stock(uuid, integer, timestamptz) from public;
revoke execute on function public.storefront_set_stock(uuid, integer, timestamptz) from anon;
revoke execute on function public.storefront_set_stock(uuid, integer, timestamptz) from authenticated;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- -- Nobody but the service role may call it:
-- select grantee, privilege_type from information_schema.routine_privileges
--  where routine_name = 'storefront_set_stock';
--     -> no rows for anon / authenticated / PUBLIC
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- drop function if exists public.storefront_set_stock(uuid, integer, timestamptz);
