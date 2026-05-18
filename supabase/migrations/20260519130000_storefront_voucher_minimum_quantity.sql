alter table public.storefront_vouchers
    add column if not exists minimum_quantity integer not null default 0;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'storefront_vouchers_minimum_quantity_non_negative'
    ) then
        alter table public.storefront_vouchers
            add constraint storefront_vouchers_minimum_quantity_non_negative
            check (minimum_quantity >= 0);
    end if;
end $$;
