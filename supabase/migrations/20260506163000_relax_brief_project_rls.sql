drop policy if exists "brief projects insert own" on public.brief_projects;
create policy "brief projects insert own"
on public.brief_projects
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.briefs
    where briefs.id = brief_projects.brief_id
      and briefs.user_id = auth.uid()
  )
);

drop policy if exists "brief projects select own" on public.brief_projects;
create policy "brief projects select own"
on public.brief_projects
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.briefs
    where briefs.id = brief_projects.brief_id
      and briefs.user_id = auth.uid()
  )
);

drop policy if exists "brief projects update own" on public.brief_projects;
create policy "brief projects update own"
on public.brief_projects
for update
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.briefs
    where briefs.id = brief_projects.brief_id
      and briefs.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.briefs
    where briefs.id = brief_projects.brief_id
      and briefs.user_id = auth.uid()
  )
);
