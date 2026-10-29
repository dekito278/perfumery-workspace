-- storefront_upsert_customer let a code-guesser OVERWRITE a stranger's saved profile.
--
-- The function matches an existing customer by auth, then code, then phone, then contact, and on a match
-- it UPDATES customer_name, contact, delivery_address, delivery_area and notes to whatever the caller
-- supplied. The match-by-CODE branch needs only the code — which is printed on every invoice — so an
-- anonymous caller who guessed a code could rewrite that person's name, phone and saved delivery address.
-- It has no grant statement, so it is callable by anon (PUBLIC default), the same root as #544.
--
-- This does NOT corrupt order fulfilment: every order carries its own name/contact/address inside
-- checkout_draft (cartService.buildCheckoutDraft), which is what the Studio order screen reads. The saved
-- customer RECORD is a convenience for next-time pre-fill and the portal — and that is what was exposed.
--
-- Fix: the identity fields are overwritten only when the caller OWNS the record — a linked login, or the
-- matching contact (which a stranger supplying someone else's code does not have). A match by code alone
-- still links the order and increments the count (placing a real, paid order under your own code is fine),
-- but leaves the saved name/contact/address untouched. INSERT of a brand-new customer is unchanged.
--
-- Grants are deliberately left as they are: the fence is now in the body (where this project keeps its
-- RPC fences), anon still needs INSERT for first-time guests and the owns-gated UPDATE for returning ones,
-- and the order path calls this as service_role. Touching grants here would risk that path for no gain.
--
-- Body identical to 20260730130000 apart from the `owns` gate on the UPDATE.
create or replace function public.storefront_upsert_customer(
    p_customer_code text,
    p_customer_name text,
    p_contact text,
    p_delivery_address text default null,
    p_delivery_area text default null,
    p_notes text default null,
    p_increment_order boolean default false
)
returns table (
    id uuid, customer_code text, customer_name text, contact text,
    delivery_address text, delivery_area text, notes text,
    order_count integer, last_order_at timestamptz,
    created_at timestamptz, updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    normalized_code text := nullif(upper(trim(coalesce(p_customer_code, ''))), '');
    normalized_contact text := lower(trim(coalesce(p_contact, '')));
    normalized_phone text := public.normalize_phone(p_contact);
    caller uuid := auth.uid();
    target_id uuid;
    existing_contact text;
    existing_auth uuid;
    owns boolean;
begin
    if char_length(trim(coalesce(p_customer_name, ''))) = 0 then
        raise exception 'Customer name is required';
    end if;
    if char_length(normalized_contact) = 0 then
        raise exception 'Customer contact is required';
    end if;

    if caller is not null then
        select c.id into target_id from public.storefront_customers c
        where c.auth_user_id = caller limit 1;
    end if;
    if target_id is null and normalized_code is not null then
        select c.id into target_id from public.storefront_customers c
        where c.customer_code = normalized_code limit 1;
    end if;
    if target_id is null and normalized_phone is not null then
        select c.id into target_id from public.storefront_customers c
        where public.normalize_phone(c.contact) = normalized_phone
        order by c.updated_at desc limit 1;
    end if;
    if target_id is null then
        select c.id into target_id from public.storefront_customers c
        where lower(c.contact) = normalized_contact
        order by c.updated_at desc limit 1;
    end if;

    if target_id is null then
        insert into public.storefront_customers (
            customer_code, customer_name, contact, delivery_address,
            delivery_area, notes, order_count, last_order_at, auth_user_id
        )
        values (
            coalesce(normalized_code, public.generate_storefront_customer_code()),
            trim(p_customer_name), trim(p_contact),
            nullif(trim(coalesce(p_delivery_address, '')), ''),
            nullif(trim(coalesce(p_delivery_area, '')), ''),
            nullif(trim(coalesce(p_notes, '')), ''),
            case when p_increment_order then 1 else 0 end,
            case when p_increment_order then timezone('utc', now()) else null end,
            caller
        )
        returning storefront_customers.id into target_id;
    else
        -- Does the caller own this record, or did they merely know the code?
        select c.contact, c.auth_user_id into existing_contact, existing_auth
        from public.storefront_customers c where c.id = target_id;
        owns := (
            (caller is not null and existing_auth is not null and existing_auth = caller)
            or (normalized_phone is not null and normalized_phone = public.normalize_phone(existing_contact))
            or (normalized_contact <> '' and normalized_contact = lower(trim(coalesce(existing_contact, ''))))
        );

        update public.storefront_customers
        set
            customer_name = case when owns then trim(p_customer_name) else customer_name end,
            contact = case when owns then trim(p_contact) else contact end,
            delivery_address = case when owns
                then coalesce(nullif(trim(coalesce(p_delivery_address, '')), ''), delivery_address)
                else delivery_address end,
            delivery_area = case when owns
                then coalesce(nullif(trim(coalesce(p_delivery_area, '')), ''), delivery_area)
                else delivery_area end,
            notes = case when owns
                then coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes)
                else notes end,
            order_count = order_count + case when p_increment_order then 1 else 0 end,
            last_order_at = case when p_increment_order then timezone('utc', now()) else last_order_at end,
            auth_user_id = case
                when caller is not null and auth_user_id is null then caller
                else auth_user_id
            end
        where storefront_customers.id = target_id;
    end if;

    return query
    select c.id, c.customer_code, c.customer_name, c.contact, c.delivery_address,
           c.delivery_area, c.notes, c.order_count, c.last_order_at, c.created_at, c.updated_at
    from public.storefront_customers c where c.id = target_id;
end;
$$;

-- Verify (anon), after running this, WITHOUT mutating anyone:
--   A real code + a contact that does NOT match it, as anon:
--     select customer_name, contact from storefront_upsert_customer('SOLInnnnn','Penyerang','0800-salah','Alamat palsu');
--   -> returns the row, but customer_name/contact/delivery_address are the STORED values, not the ones
--      passed in (the overwrite was refused). A matching contact, or a linked login, still updates.
