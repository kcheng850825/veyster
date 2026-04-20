-- Survey versioning
--
-- Each survey has one or more ordered versions. Only one version is "open"
-- at a time; publishing a new version retires the previous one. In-progress
-- sessions stay on whatever version they started on.
--
-- Questions belong to a version. Across versions, questions that the
-- researcher considers "the same" share a question_group_id, which the
-- results page uses for a merged cross-version view.

create type version_status_t as enum ('draft', 'open', 'retired');

create table if not exists survey_versions (
  id              uuid primary key default uuid_generate_v4(),
  survey_id       uuid not null references surveys(id) on delete cascade,
  version_number  integer not null,
  status          version_status_t not null default 'draft',
  created_at      timestamptz not null default now(),
  opened_at       timestamptz,
  retired_at      timestamptz,
  unique (survey_id, version_number)
);

create index if not exists survey_versions_survey_idx
  on survey_versions(survey_id, version_number);

------------------------------------------------------------
-- Backfill: wrap every existing survey in a version 1
------------------------------------------------------------
insert into survey_versions (survey_id, version_number, status, opened_at, retired_at)
select s.id,
       1,
       case s.status
         when 'draft'  then 'draft'::version_status_t
         when 'open'   then 'open'::version_status_t
         when 'closed' then 'retired'::version_status_t
       end,
       s.opened_at,
       s.closed_at
  from surveys s
 where not exists (
   select 1 from survey_versions v
    where v.survey_id = s.id and v.version_number = 1
 );

------------------------------------------------------------
-- Add version_id to questions, backfill, then require it
------------------------------------------------------------
alter table questions
  add column if not exists version_id uuid references survey_versions(id) on delete cascade;

update questions q
   set version_id = (select id from survey_versions v
                     where v.survey_id = q.survey_id and v.version_number = 1)
 where q.version_id is null;

alter table questions alter column version_id set not null;

-- Position is unique per version, not per survey
alter table questions drop constraint if exists questions_survey_id_position_key;
alter table questions add constraint questions_version_id_position_key
  unique (version_id, position);

create index if not exists questions_version_idx on questions(version_id);

-- Question group (for cross-version linking). Same group_id across versions
-- means "these questions are the same concept".
alter table questions
  add column if not exists question_group_id uuid not null default uuid_generate_v4();

create index if not exists questions_group_idx on questions(question_group_id);

------------------------------------------------------------
-- Add version_id to survey_sessions, backfill
------------------------------------------------------------
alter table survey_sessions
  add column if not exists version_id uuid references survey_versions(id) on delete cascade;

update survey_sessions ss
   set version_id = (select id from survey_versions v
                     where v.survey_id = ss.survey_id and v.version_number = 1)
 where ss.version_id is null;

alter table survey_sessions alter column version_id set not null;

-- A user can answer each VERSION of a survey at most once.
alter table survey_sessions drop constraint if exists survey_sessions_survey_id_respondent_id_key;
alter table survey_sessions add constraint survey_sessions_version_respondent_key
  unique (version_id, respondent_id);

create index if not exists sessions_version_idx on survey_sessions(version_id);

------------------------------------------------------------
-- RLS on survey_versions
------------------------------------------------------------
alter table survey_versions enable row level security;

drop policy if exists "versions owner all" on survey_versions;
create policy "versions owner all" on survey_versions
  for all using (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from surveys s where s.id = survey_id and s.owner_id = auth.uid()));

drop policy if exists "versions public read" on survey_versions;
create policy "versions public read" on survey_versions
  for select using (status in ('open', 'retired'));

-- Reapply grants so anon/authenticated can read the new table
grant all on survey_versions to anon, authenticated, service_role;
