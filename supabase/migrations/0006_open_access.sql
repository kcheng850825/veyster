-- Open-access ("friends & family") survey mode.
--
-- Adds a per-survey access mode:
--   'authenticated' (default) — the existing flow: respondents sign in,
--       complete demographics, and can be matched/paid.
--   'open' — no login required. Respondents answer anonymously and the
--       researcher optionally collects name / phone / email. Always free.
--
-- Anonymous respondents use Supabase Anonymous Sign-Ins (enable it under
-- Authentication -> Sign In / Providers -> "Allow anonymous sign-ins").
-- Each gets a real (invisible) auth user, so existing RLS that scopes rows
-- by auth.uid() keeps working with no changes to the sessions/answers flow.

------------------------------------------------------------
-- New columns
------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'access_mode_t') then
    create type access_mode_t as enum ('authenticated', 'open');
  end if;
end
$$;

alter table surveys
  add column if not exists access_mode access_mode_t not null default 'authenticated';

-- Per-field config for open-access surveys. Shape:
--   { "name":  {"show": true, "required": false},
--     "phone": {"show": false,"required": false},
--     "email": {"show": true, "required": true} }
alter table surveys
  add column if not exists contact_fields jsonb not null default '{}'::jsonb;

-- Contact info collected from an open-access respondent (nullable; only set
-- when the survey asks for the corresponding field).
alter table survey_sessions add column if not exists respondent_name  text;
alter table survey_sessions add column if not exists respondent_phone text;
alter table survey_sessions add column if not exists respondent_email text;

------------------------------------------------------------
-- Version-aware public-read RLS (also fixes a latent bug)
--
-- Publishing a survey now flips survey_versions.status, not surveys.status,
-- so the old `surveys.status = 'open'` read policy could hide freshly
-- published surveys from non-owners (breaking the feed + respondent read
-- path). Base public readability on "has an open or retired version".
------------------------------------------------------------

drop policy if exists "surveys public read" on surveys;
create policy "surveys public read" on surveys
  for select using (
    exists (
      select 1 from survey_versions v
      where v.survey_id = surveys.id
        and v.status in ('open', 'retired')
    )
  );

drop policy if exists "questions read" on questions;
create policy "questions read" on questions
  for select using (
    exists (
      select 1 from surveys s
      where s.id = questions.survey_id and s.owner_id = auth.uid()
    )
    or exists (
      select 1 from survey_versions v
      where v.id = questions.version_id
        and v.status in ('open', 'retired')
    )
  );

-- survey_versions already has a "versions public read" policy for
-- status in ('open','retired'); anonymous (anon role) requests satisfy it,
-- so no change needed there.
