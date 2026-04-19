# Veyster

Yes-or-no swipe surveys. Researchers publish short yes/no surveys with
per-question branching; respondents swipe through them Tinder-style. Built as a
PWA so it installs to home-screen on mobile.

Stack: Next.js 15 (App Router) + TypeScript + Tailwind + Supabase (Postgres +
auth + storage), deployed on Vercel.

## Status

**Walking skeleton — payments / paid-tier targeting not yet implemented.**
The schema reserves columns for them so we can layer them on without a
migration when you're ready.

Working now:
- Passwordless email OTP auth
- Demographics onboarding (birth year, gender, education, country, state,
  city, race, ethnicity) with location-aware race/ethnicity options
- Researcher: create/edit surveys up to 10 yes/no questions with per-question
  branching (like Google Forms: "If Yes → Q5", "If No → End")
- Researcher: pick payout mode (`per_question` or `on_complete` with premium)
  and required pre-survey verification fields (schema only, not billed)
- Researcher: publish, share via URL + QR code, close
- Respondent: in-app feed of public surveys, pre-survey notice with
  verification gate, swipe UI with undo and stop-here
- Results: aggregate Yes/No per question + breakdowns by age, gender,
  education, country. Row-level CSV export stubbed for paid tier.

## Local setup

### 1. Install deps

```bash
npm install
```

### 2. Create a Supabase project

1. Go to https://supabase.com → New project. Free tier is fine.
2. Under **SQL Editor**, run the three migrations in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_ethnicity_seed.sql`
3. Under **Settings → API**, copy the URL, the `anon` public key, and the
   `service_role` key.
4. Under **Authentication → Providers**, make sure **Email** is enabled.
5. Under **Authentication → URL configuration**, add your local + production
   origins to the allow-list (e.g. `http://localhost:3000`, your Vercel URL).

### 3. Configure environment

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL
```

### 4. Seed GeoNames (one-time, ~2 minutes)

Needed for country/state/city dropdowns in the demographics form.

```bash
npm i -D adm-zip                     # one-time, used by the import script
npm run seed:geo
```

This downloads ~10 MB from GeoNames, caches it under `scripts/geonames-cache/`
(gitignored), and upserts ~200 countries, ~4,000 admin1 regions, and ~26,000
cities (population > 15,000) into your Supabase Postgres.

### 5. Generate PWA icons (optional, one-time)

```bash
npm i -D sharp
npx tsx scripts/generate-icons.ts
```

### 6. Run

```bash
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this branch to GitHub.
2. Import the repo on Vercel.
3. In **Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (not exposed to browser; the import script
     uses it from CLI, Vercel doesn't need it at runtime)
   - `NEXT_PUBLIC_SITE_URL` = `https://your-domain.vercel.app`
4. Add the Vercel URL to Supabase → Authentication → URL configuration.
5. Deploy.

## Project layout

```
src/
  app/
    page.tsx                      landing
    login/                        email OTP sign-in
    logout/                       POST route
    (app)/                        authenticated shell (nav + auth guard)
      feed/                       respondent feed
      onboarding/                 first-run demographics
      profile/                    edit demographics
      surveys/                    researcher list
        new/                      create survey
        [id]/                     edit + branching + payout + verification
          share/                  QR + link
          results/                aggregates + breakdowns
    s/[slug]/                     shared survey entry
      page.tsx                    pre-survey notice + verification gate
      respond/page.tsx            swipe deck
      done/page.tsx               thanks
  components/
    AppNav.tsx
    DemographicsForm.tsx          location-aware ethnicity + GeoNames city search
    SurveyEditor.tsx              questions, branching, payout, verification
    SwipeDeck.tsx                 framer-motion drag cards + undo + branching
    StartSurveyForm.tsx           verification checklist + begin button
    CopyButton.tsx
    ui/{Button,Input}.tsx
  lib/
    supabase/{client,server}.ts   browser + server Supabase clients
    brand.ts constants.ts types.ts
  middleware.ts                   session refresh + protected route redirect
supabase/migrations/
  0001_init.sql                   tables + triggers + auto-profile on signup
  0002_rls.sql                    row-level security policies
  0003_ethnicity_seed.sql         US Census + international fallback
scripts/
  import-geonames.ts              countries, admin1, cities (>15k pop)
  generate-icons.ts               PNG icons from SVG
```

## What's not in this round (by design)

- **Payments.** Stripe subscription ($10/mo researcher) + metered per-answer
  billing ($0.10/Q/respondent, +20% premium for full completion). The DB has
  `is_paid_tier`, `payout_mode`, `complete_premium_pct`, and
  `target_recruits` columns ready.
- **Paid-tier targeting.** `survey_targeting` table exists (age, gender,
  country, state, city, education, race, ethnicity filters) but no UI yet.
- **Row-level CSV export.** Gated behind paid tier.
- **Email/push notifications.** In-app feed only for now.
- **Non-US ethnicity catalogs.** International fallback + US Census are
  seeded; UK, Canada, etc. can be added to `ethnicity_catalog` as rows.

## Design decisions

- **One account, both roles.** Any signed-in user can create surveys *and*
  answer others'.
- **Minimum age 18.** Enforced at the `profiles.birth_year` check constraint.
- **Undo last swipe; one take per respondent.** `survey_sessions` has
  `unique(survey_id, respondent_id)`.
- **Profile snapshot on session start.** Each session stores a JSONB copy of
  the respondent's demographics at the moment they began, so results stay
  accurate even if the respondent later updates their profile.
- **RLS everywhere.** Users only see their own profile + own surveys + their
  own sessions/answers. Researchers can read (not write) answers on their own
  surveys. Geography/catalog tables are world-readable.
