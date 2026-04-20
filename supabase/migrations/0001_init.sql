-- Veyster initial schema
-- Run this in Supabase SQL editor (or via `supabase db push`).

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_trgm;

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
create index if not exists cities_name_trgm_idx on cities using gin (name gin_trgm_ops);

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

create or replace function enforce_question_cap()
returns trigger language plpgsql as $$
declare
  n integer;
begin
  select count(*) into n from questions where survey_id = new.survey_id;
  if (tg_op = 'INSERT' and n >= 10) then
    raise exception 'A survey can have at most 10 questions';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_question_cap on questions;
create trigger trg_question_cap
before insert on questions
for each row execute function enforce_question_cap();

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

------------------------------------------------------------
-- updated_at triggers
------------------------------------------------------------

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on profiles;
create trigger trg_profiles_touch before update on profiles
for each row execute function touch_updated_at();

drop trigger if exists trg_surveys_touch on surveys;
create trigger trg_surveys_touch before update on surveys
for each row execute function touch_updated_at();

------------------------------------------------------------
-- Auto-create profile row on signup
------------------------------------------------------------

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
