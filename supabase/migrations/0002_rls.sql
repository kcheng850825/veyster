-- Row-level security policies.

-- Base PostgreSQL grants. Supabase normally applies these automatically
-- when tables are created through the dashboard, but if you've run
-- `drop schema public cascade` to reset, these need to be reapplied or
-- every request will return "permission denied for table <name>".
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

alter table profiles              enable row level security;
alter table surveys               enable row level security;
alter table questions             enable row level security;
alter table survey_targeting      enable row level security;
alter table survey_sessions       enable row level security;
alter table answers               enable row level security;
alter table countries             enable row level security;
alter table admin1                enable row level security;
alter table cities                enable row level security;
alter table ethnicity_catalog     enable row level security;

-- Geography + catalog: readable by everyone (no writes via API; seeded by service role).
drop policy if exists "geo read" on countries;
create policy "geo read" on countries for select using (true);
drop policy if exists "geo read" on admin1;
create policy "geo read" on admin1 for select using (true);
drop policy if exists "geo read" on cities;
create policy "geo read" on cities for select using (true);
drop policy if exists "cat read" on ethnicity_catalog;
create policy "cat read" on ethnicity_catalog for select using (true);

-- Profiles: users read/update their own. Other users' public fields exposed via
-- session snapshots only — never direct profile reads.
drop policy if exists "own profile read"   on profiles;
drop policy if exists "own profile update" on profiles;
drop policy if exists "own profile insert" on profiles;
create policy "own profile read"   on profiles for select using (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);
create policy "own profile insert" on profiles for insert with check (auth.uid() = id);

-- Surveys:
--   Owner: full CRUD on their own.
--   Anyone signed in: read surveys that are status='open' AND
--     (visibility='public' OR they know the share_slug — enforced by app layer).
drop policy if exists "surveys owner all"     on surveys;
drop policy if exists "surveys public read"   on surveys;
create policy "surveys owner all" on surveys
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "surveys public read" on surveys
  for select using (status = 'open');

-- Questions: readable when parent survey readable; writable only by owner.
drop policy if exists "questions owner all" on questions;
drop policy if exists "questions read"      on questions;
create policy "questions owner all" on questions
  for all using (exists (select 1 from surveys s where s.id = questions.survey_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from surveys s where s.id = questions.survey_id and s.owner_id = auth.uid()));
create policy "questions read" on questions
  for select using (exists (
    select 1 from surveys s
    where s.id = questions.survey_id
      and (s.owner_id = auth.uid() or s.status = 'open')
  ));

-- Targeting: owner only.
drop policy if exists "targeting owner" on survey_targeting;
create policy "targeting owner" on survey_targeting
  for all using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()));

-- Sessions: respondent creates & reads own; survey owner reads aggregate via SQL views (below).
drop policy if exists "sessions respondent rw" on survey_sessions;
drop policy if exists "sessions owner read"    on survey_sessions;
create policy "sessions respondent rw" on survey_sessions
  for all using (respondent_id = auth.uid())
  with check (respondent_id = auth.uid());
create policy "sessions owner read" on survey_sessions
  for select using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()));

-- Answers: respondent owns via their session; owner reads for their surveys.
drop policy if exists "answers respondent rw" on answers;
drop policy if exists "answers owner read"    on answers;
create policy "answers respondent rw" on answers
  for all using (exists (select 1 from survey_sessions ss where ss.id = session_id and ss.respondent_id = auth.uid()))
  with check (exists (select 1 from survey_sessions ss where ss.id = session_id and ss.respondent_id = auth.uid()));
create policy "answers owner read" on answers
  for select using (exists (
    select 1 from survey_sessions ss
    join surveys s on s.id = ss.survey_id
    where ss.id = session_id and s.owner_id = auth.uid()
  ));
