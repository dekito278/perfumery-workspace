create table if not exists public.batch_usage_records (
    id uuid primary key default gen_random_uuid(),
    batch_id uuid not null references public.batches (id) on delete cascade,
    raw_material_id uuid not null references public.raw_materials (id) on delete restrict,
    quantity_deducted numeric(12,3) not null,
    type text not null,
    source text,
    cost numeric(12,2) not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint batch_usage_records_quantity_positive check (quantity_deducted > 0),
    constraint batch_usage_records_cost_non_negative check (cost >= 0)
);

alter table public.batch_usage_records
    add column if not exists unit text not null default 'ml',
    add column if not exists unit_cost numeric(12,2) not null default 0,
    add column if not exists stock_before numeric(12,3),
    add column if not exists stock_after numeric(12,3),
    add column if not exists movement text;

create index if not exists batch_usage_records_type_idx
    on public.batch_usage_records (type);
create index if not exists batch_usage_records_batch_id_idx
    on public.batch_usage_records (batch_id);
create index if not exists batch_usage_records_raw_material_id_idx
    on public.batch_usage_records (raw_material_id);

drop trigger if exists batch_usage_records_set_updated_at on public.batch_usage_records;
create trigger batch_usage_records_set_updated_at before update on public.batch_usage_records for each row execute function public.set_updated_at();

alter table public.batch_usage_records enable row level security;

drop policy if exists "batch usage records select own" on public.batch_usage_records;
create policy "batch usage records select own" on public.batch_usage_records for select using (exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid()));
drop policy if exists "batch usage records insert own" on public.batch_usage_records;
create policy "batch usage records insert own" on public.batch_usage_records for insert with check (exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid()));
drop policy if exists "batch usage records update own" on public.batch_usage_records;
create policy "batch usage records update own" on public.batch_usage_records for update using (exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid())) with check (exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid()));
drop policy if exists "batch usage records delete own" on public.batch_usage_records;
create policy "batch usage records delete own" on public.batch_usage_records for delete using (exists (select 1 from public.batches b where b.id = batch_id and b.user_id = auth.uid()));

create or replace function public.deduct_batch_material_stock(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    target_batch public.batches%rowtype;
    formula_total numeric(12,3) := 0;
    formula_percent_total numeric(12,3) := 0;
    usage_quantity numeric(12,3) := 0;
    stock_before_value numeric(12,3) := 0;
    stock_after_value numeric(12,3) := 0;
    usage_events jsonb := '[]'::jsonb;
    usage_payload jsonb;
    item_record record;
begin
    select *
    into target_batch
    from public.batches
    where id = p_batch_id
    for update;

    if not found then
        raise exception 'Batch % not found', p_batch_id;
    end if;

    if auth.uid() is null or target_batch.user_id <> auth.uid() then
        raise exception 'Batch % is not available for the current user', p_batch_id;
    end if;

    if target_batch.is_stock_deducted then
        return coalesce((
            select jsonb_agg(to_jsonb(record_row) order by record_row.created_at)
            from public.batch_usage_records record_row
            where record_row.batch_id = target_batch.id
        ), '[]'::jsonb);
    end if;

    select
        coalesce(sum(coalesce(grams, 0)), 0),
        coalesce(sum(coalesce(percentage, 0)), 0)
    into formula_total, formula_percent_total
    from public.formula_items
    where formula_id = target_batch.formula_id
      and item_type in ('raw_material', 'solvent');

    if formula_total <= 0 and formula_percent_total <= 0 then
        raise exception 'Formula % has no measurable formula items', target_batch.formula_id;
    end if;

    for item_record in
        select
            formula_item.item_id as raw_material_id,
            formula_item.item_type,
            coalesce(formula_item.grams, 0) as grams,
            coalesce(formula_item.percentage, 0) as percentage,
            raw_material.name,
            raw_material.unit,
            raw_material.stock_quantity,
            raw_material.cost_per_unit
        from public.formula_items formula_item
        join public.raw_materials raw_material on raw_material.id = formula_item.item_id
        where formula_item.formula_id = target_batch.formula_id
          and formula_item.item_type in ('raw_material', 'solvent')
          and raw_material.user_id = target_batch.user_id
        order by formula_item.created_at
    loop
        usage_quantity := case
            when formula_total > 0 then round((target_batch.formula_quantity_needed * item_record.grams / formula_total)::numeric, 3)
            else round((target_batch.formula_quantity_needed * item_record.percentage / formula_percent_total)::numeric, 3)
        end;

        if usage_quantity <= 0 then
            continue;
        end if;

        select stock_quantity
        into stock_before_value
        from public.raw_materials
        where id = item_record.raw_material_id
          and user_id = target_batch.user_id
        for update;

        if stock_before_value < usage_quantity then
            raise exception 'Raw material % stock is %, not enough for %', item_record.name, stock_before_value, usage_quantity;
        end if;

        stock_after_value := stock_before_value - usage_quantity;

        update public.raw_materials
        set stock_quantity = stock_after_value
        where id = item_record.raw_material_id
          and user_id = target_batch.user_id;

        insert into public.batch_usage_records (
            batch_id,
            raw_material_id,
            quantity_deducted,
            type,
            source,
            cost,
            unit,
            unit_cost,
            stock_before,
            stock_after,
            movement
        )
        values (
            target_batch.id,
            item_record.raw_material_id,
            usage_quantity,
            'formula_material',
            target_batch.batch_code,
            round(((usage_quantity / 10) * coalesce(item_record.cost_per_unit, 0))::numeric, 2),
            coalesce(nullif(item_record.unit, ''), target_batch.unit, 'ml'),
            coalesce(item_record.cost_per_unit, 0),
            stock_before_value,
            stock_after_value,
            'Batch concentrate production'
        )
        returning jsonb_build_object(
            'id', id,
            'batch_id', batch_id,
            'raw_material_id', raw_material_id,
            'raw_material_name', item_record.name,
            'quantity_deducted', quantity_deducted,
            'type', type,
            'source', source,
            'cost', cost,
            'unit', unit,
            'unit_cost', unit_cost,
            'stock_before', stock_before,
            'stock_after', stock_after,
            'movement', movement,
            'created_at', created_at,
            'updated_at', updated_at
        )
        into usage_payload;

        usage_events := usage_events || jsonb_build_array(usage_payload);
    end loop;

    if target_batch.solvent_id is not null and target_batch.solvent_quantity_needed > 0 then
        select
            raw_material.id as raw_material_id,
            raw_material.name,
            raw_material.unit,
            raw_material.stock_quantity,
            raw_material.cost_per_unit
        into item_record
        from public.raw_materials raw_material
        where raw_material.id = target_batch.solvent_id
          and raw_material.user_id = target_batch.user_id
        for update;

        if not found then
            raise exception 'Batch solvent is not available';
        end if;

        usage_quantity := round(target_batch.solvent_quantity_needed::numeric, 3);
        stock_before_value := item_record.stock_quantity;

        if stock_before_value < usage_quantity then
            raise exception 'Solvent % stock is %, not enough for %', item_record.name, stock_before_value, usage_quantity;
        end if;

        stock_after_value := stock_before_value - usage_quantity;

        update public.raw_materials
        set stock_quantity = stock_after_value
        where id = item_record.raw_material_id
          and user_id = target_batch.user_id;

        insert into public.batch_usage_records (
            batch_id,
            raw_material_id,
            quantity_deducted,
            type,
            source,
            cost,
            unit,
            unit_cost,
            stock_before,
            stock_after,
            movement
        )
        values (
            target_batch.id,
            item_record.raw_material_id,
            usage_quantity,
            'batch_solvent',
            target_batch.batch_code,
            round(((usage_quantity / 10) * coalesce(item_record.cost_per_unit, 0))::numeric, 2),
            coalesce(nullif(item_record.unit, ''), target_batch.unit, 'ml'),
            coalesce(item_record.cost_per_unit, 0),
            stock_before_value,
            stock_after_value,
            'Batch dilution solvent'
        )
        returning jsonb_build_object(
            'id', id,
            'batch_id', batch_id,
            'raw_material_id', raw_material_id,
            'raw_material_name', item_record.name,
            'quantity_deducted', quantity_deducted,
            'type', type,
            'source', source,
            'cost', cost,
            'unit', unit,
            'unit_cost', unit_cost,
            'stock_before', stock_before,
            'stock_after', stock_after,
            'movement', movement,
            'created_at', created_at,
            'updated_at', updated_at
        )
        into usage_payload;

        usage_events := usage_events || jsonb_build_array(usage_payload);
    end if;

    if jsonb_array_length(usage_events) = 0 then
        raise exception 'Batch % has no material usage to deduct', target_batch.batch_code;
    end if;

    update public.batches
    set is_stock_deducted = true
    where id = target_batch.id;

    return usage_events;
end;
$$;

grant execute on function public.deduct_batch_material_stock(uuid) to authenticated, service_role;
