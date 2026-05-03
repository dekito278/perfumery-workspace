create table if not exists public.brief_ai_interpretations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    brief_id uuid not null references public.briefs (id) on delete cascade,
    input_text text not null default '',
    intent_payload jsonb not null default '{}'::jsonb,
    model text,
    confidence numeric(5, 4),
    source text not null default 'ai' check (source in ('ai', 'fallback', 'manual')),
    fallback_reason text,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists brief_ai_interpretations_user_id_idx
    on public.brief_ai_interpretations (user_id);

create index if not exists brief_ai_interpretations_brief_created_idx
    on public.brief_ai_interpretations (brief_id, created_at desc);

alter table public.brief_ai_interpretations enable row level security;

drop policy if exists "brief ai interpretations select own" on public.brief_ai_interpretations;
create policy "brief ai interpretations select own"
on public.brief_ai_interpretations
for select
using (auth.uid() = user_id);

drop policy if exists "brief ai interpretations insert own" on public.brief_ai_interpretations;
create policy "brief ai interpretations insert own"
on public.brief_ai_interpretations
for insert
with check (auth.uid() = user_id);

drop policy if exists "brief ai interpretations update own" on public.brief_ai_interpretations;
create policy "brief ai interpretations update own"
on public.brief_ai_interpretations
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "brief ai interpretations delete own" on public.brief_ai_interpretations;
create policy "brief ai interpretations delete own"
on public.brief_ai_interpretations
for delete
using (auth.uid() = user_id);
