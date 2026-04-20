-- Veyster initial schema
-- Run this in Supabase SQL editor (or via `supabase db push`).

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

------------------------------------------------------------
-- Geography (seeded from GeoNames)
------------------------------------------------------------

create table if not exists countries (
  code        char(2) primary key,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists admin1 (
  country_code char(2) not null references countries(code) on delete cascade,
  code         text not null,
  name         text not null,
  primary key (country_code, code)
);

create table if not exists cities (
  geonameid     bigint primary key,
  name          text not null,
  country_code  char(2) not null references countries(code) on delete cascade,
  admin1_code   text,
  population    integer not null default 0,
  lat           numeric(9,6),
  lon           numeric(9,6)
);
create index if not exists cities_country_admin_idx on cities(country_code, admin1_code);

------------------------------------------------------------
-- Ethnicity catalog (location-aware)
-- country_code null = international fallback
------------------------------------------------------------

create table if not exists ethnicity_catalog (
  id            serial primary key,
  country_code  char(2) references countries(code) on delete cascade,
  kind          text not null check (kind in ('race', 'ethnicity')),
  code          text not null,
  label         text not null,
  sort_order    integer not null default 0,
  unique (country_code, kind, code)
);

------------------------------------------------------------
-- User profiles (1:1 with auth.users)
------------------------------------------------------------

create type gender_t as enum ('female', 'male', 'nonbinary', 'other', 'prefer_not_to_say');
create type education_t as enum (
  'less_than_hs',
  'high_school',
  'some_college',
  'bachelors',
  'masters',
  'doctorate'
);

create table if not exists profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  birth_year        integer check (birth_year between 1900 and extract(year from now())::int - 18),
  gender            gender_t,
  education         education_t,
  country_code      char(2) references countries(code),
  admin1_code       text,
  city_geonameid    bigint references cities(geonameid),
  -- ethnicity/race stored as arrays of catalog codes, resolved via ethnicity_catalog rows
  race_codes        text[] not null default '{}',
  ethnicity_codes   text[] not null default '{}',
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists profiles_country_idx on profiles(country_code);

------------------------------------------------------------
-- Surveys
------------------------------------------------------------

create type survey_status_t as enum ('draft', 'open', 'closed');
create type payout_mode_t as enum ('per_question', 'on_complete');
create type visibility_t as enum ('public', 'link_only');

create table if not exists surveys (
  id                      uuid primary key default uuid_generate_v4(),
  owner_id                uuid not null references profiles(id) on delete cascade,
  title                   text not null check (char_length(title) between 1 and 140),
  description             text,
  status                  survey_status_t not null default 'draft',
  visibility              visibility_t not null default 'link_only',
  share_slug              text not null unique default encode(gen_random_bytes(6), 'hex'),
  payout_mode             payout_mode_t not null default 'per_question',
  complete_premium_pct    integer not null default 20 check (complete_premium_pct >= 0),
  -- If non-empty, respondent must confirm these profile fields before starting.
  -- Each entry is one of: 'birth_year','gender','education','country','admin1','city','race','ethnicity'.
  verification_fields     text[] not null default '{}',
  -- Paid tier flag (schema only; payments not yet implemented)
  is_paid_tier            boolean not null default false,
  target_recruits         integer,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  opened_at               timestamptz,
  closed_at               timestamptz,
  check (
    cardinality(verification_fields) <= 9
  )
);

create index if not exists surveys_owner_idx on surveys(owner_id);
create index if not exists surveys_status_vis_idx on surveys(status, visibility);

------------------------------------------------------------
-- Questions + branching
-- Max 10 questions per survey enforced via trigger below.
------------------------------------------------------------

create table if not exists questions (
  id            uuid primary key default uuid_generate_v4(),
  survey_id     uuid not null references surveys(id) on delete cascade,
  position      integer not null check (position > 0),
  text          text not null check (char_length(text) between 1 and 280),
  -- Branching targets. NULL means "fall through to next question by position".
  -- A target of this question's own id, or position beyond last, ends the survey.
  next_on_yes   uuid references questions(id) on delete set null,
  next_on_no    uuid references questions(id) on delete set null,
  end_on_yes    boolean not null default false,
  end_on_no     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (survey_id, position)
);

create index if not exists questions_survey_idx on questions(survey_id);

-- 10-question cap is enforced at the app layer (see MAX_QUESTIONS_PER_SURVEY
-- in src/lib/constants.ts and the SurveyEditor component). A DB trigger was
-- previously here but Supabase's SQL Editor parser mangles SELECT INTO inside
-- plpgsql bodies; a direct-API bypass of the cap is acceptable for this MVP.

------------------------------------------------------------
-- Survey targeting (paid-tier filters; schema-only for now)
------------------------------------------------------------

create table if not exists survey_targeting (
  survey_id        uuid primary key references surveys(id) on delete cascade,
  age_min          integer,
  age_max          integer,
  genders          gender_t[] not null default '{}',
  education_levels education_t[] not null default '{}',
  country_codes    char(2)[] not null default '{}',
  admin1_keys      text[] not null default '{}',   -- "US:CA" style
  city_geonameids  bigint[] not null default '{}',
  race_codes       text[] not null default '{}',
  ethnicity_codes  text[] not null default '{}'
);

------------------------------------------------------------
-- Responses
------------------------------------------------------------

create type answer_t as enum ('yes', 'no');

create table if not exists survey_sessions (
  id                    uuid primary key default uuid_generate_v4(),
  survey_id             uuid not null references surveys(id) on delete cascade,
  respondent_id         uuid not null references profiles(id) on delete cascade,
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  -- Snapshot of respondent profile fields at time of starting — preserves
  -- accuracy even if respondent later edits their profile.
  profile_snapshot      jsonb not null,
  -- Which verification fields the respondent confirmed (subset of survey.verification_fields).
  verified_fields       text[] not null default '{}',
  unique (survey_id, respondent_id)
);

create index if not exists sessions_survey_idx on survey_sessions(survey_id);
create index if not exists sessions_respondent_idx on survey_sessions(respondent_id);

create table if not exists answers (
  session_id     uuid not null references survey_sessions(id) on delete cascade,
  question_id    uuid not null references questions(id) on delete cascade,
  answer         answer_t not null,
  swiped_at      timestamptz not null default now(),
  primary key (session_id, question_id)
);

-- NOTE: `updated_at` is maintained by the application when writes happen.
-- NOTE: `profiles` rows are created by the application immediately after a
--       successful OTP verification (see src/app/login/page.tsx).
-- DB-side trigger functions were removed because Supabase's SQL Editor
-- parser chokes on plpgsql function bodies; any logic that needs server-side
-- enforcement should go in an Edge Function later.
