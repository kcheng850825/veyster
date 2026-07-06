-- Fix infinite RLS recursion introduced in 0006.
--
-- 0006 made "surveys public read" subquery survey_versions, while
-- survey_versions' "versions owner all" subqueries surveys — a policy cycle.
-- Postgres aborts with "infinite recursion detected in policy for relation
-- surveys", breaking every read/write on surveys (list, create, feed...).
--
-- Fix: route every cross-table policy check through SECURITY DEFINER SQL
-- functions. They execute as the table owner, which bypasses RLS on the
-- tables they read, so no policy ever re-enters the policy evaluator.
-- Function bodies are single-quoted (no dollar quoting, no semicolons
-- inside) so the Supabase SQL editor can never mis-split them.
--
-- After this migration the policy dependency graph is acyclic:
-- no policy body queries a table whose policies query back.

create or replace function public.survey_is_public(sid uuid)
returns boolean
language sql security definer stable
set search_path = public
as 'select exists (select 1 from public.survey_versions v where v.survey_id = sid and v.status in (''open'',''retired''))';

create or replace function public.version_is_public(vid uuid)
returns boolean
language sql security definer stable
set search_path = public
as 'select exists (select 1 from public.survey_versions v where v.id = vid and v.status in (''open'',''retired''))';

create or replace function public.is_survey_owner(sid uuid)
returns boolean
language sql security definer stable
set search_path = public
as 'select exists (select 1 from public.surveys s where s.id = sid and s.owner_id = auth.uid())';

create or replace function public.session_belongs_to_owned_survey(sess uuid)
returns boolean
language sql security definer stable
set search_path = public
as 'select exists (select 1 from public.survey_sessions ss join public.surveys s on s.id = ss.survey_id where ss.id = sess and s.owner_id = auth.uid())';

grant execute on function public.survey_is_public(uuid)                 to anon, authenticated, service_role;
grant execute on function public.version_is_public(uuid)                to anon, authenticated, service_role;
grant execute on function public.is_survey_owner(uuid)                  to anon, authenticated, service_role;
grant execute on function public.session_belongs_to_owned_survey(uuid)  to anon, authenticated, service_role;

-- surveys: public read no longer touches survey_versions under RLS.
drop policy if exists "surveys public read" on surveys;
create policy "surveys public read" on surveys
  for select using (public.survey_is_public(id));

-- survey_versions: owner check no longer touches surveys under RLS.
drop policy if exists "versions owner all" on survey_versions;
create policy "versions owner all" on survey_versions
  for all using (public.is_survey_owner(survey_id))
  with check (public.is_survey_owner(survey_id));

-- questions: both policies via definer helpers.
drop policy if exists "questions read" on questions;
create policy "questions read" on questions
  for select using (
    public.is_survey_owner(survey_id) or public.version_is_public(version_id)
  );

drop policy if exists "questions owner all" on questions;
create policy "questions owner all" on questions
  for all using (public.is_survey_owner(survey_id))
  with check (public.is_survey_owner(survey_id));

-- targeting / sessions / answers: owner checks via definer helpers.
drop policy if exists "targeting owner" on survey_targeting;
create policy "targeting owner" on survey_targeting
  for all using (public.is_survey_owner(survey_id))
  with check (public.is_survey_owner(survey_id));

drop policy if exists "sessions owner read" on survey_sessions;
create policy "sessions owner read" on survey_sessions
  for select using (public.is_survey_owner(survey_id));

drop policy if exists "answers owner read" on answers;
create policy "answers owner read" on answers
  for select using (public.session_belongs_to_owned_survey(session_id));
