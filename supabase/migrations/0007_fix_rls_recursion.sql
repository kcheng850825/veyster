-- Fix infinite RLS recursion introduced in 0006.
--
-- 0006 changed the "surveys public read" policy to check survey_versions.
-- But survey_versions' own "versions owner all" policy checks back against
-- surveys — so evaluating one policy triggers the other, forever. Postgres
-- aborts with "infinite recursion detected in policy for relation surveys",
-- which breaks EVERY read/write to surveys (list, create, feed, share...).
--
-- Standard fix: move the version-lookup into SECURITY DEFINER functions.
-- These run as the function owner and bypass RLS on the tables they read,
-- so the policy no longer re-enters the RLS evaluator. No data is changed.

create or replace function public.survey_is_public(sid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from survey_versions v
    where v.survey_id = sid
      and v.status in ('open', 'retired')
  );
$$;

create or replace function public.version_is_public(vid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from survey_versions v
    where v.id = vid
      and v.status in ('open', 'retired')
  );
$$;

grant execute on function public.survey_is_public(uuid)  to anon, authenticated, service_role;
grant execute on function public.version_is_public(uuid) to anon, authenticated, service_role;

-- Recreate the two policies to call the helpers instead of inlining a
-- survey_versions subquery.
drop policy if exists "surveys public read" on surveys;
create policy "surveys public read" on surveys
  for select using (public.survey_is_public(id));

drop policy if exists "questions read" on questions;
create policy "questions read" on questions
  for select using (
    exists (
      select 1 from surveys s
      where s.id = questions.survey_id and s.owner_id = auth.uid()
    )
    or public.version_is_public(questions.version_id)
  );
