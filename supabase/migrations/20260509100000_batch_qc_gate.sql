alter table public.batches
    add column if not exists qc_status text not null default 'pending',
    add column if not exists qc_notes text,
    add column if not exists qc_checked_at timestamptz,
    add column if not exists qc_reviewer text;

alter table public.batches
    drop constraint if exists batches_qc_status_check;

alter table public.batches
    add constraint batches_qc_status_check check (
        qc_status in ('pending', 'passed', 'needs_adjustment', 'failed')
    );

create index if not exists batches_qc_status_idx
    on public.batches (qc_status);
