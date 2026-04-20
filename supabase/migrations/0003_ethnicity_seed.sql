-- Seed ethnicity/race catalog.
-- International fallback (country_code NULL) + US Census categories.
-- Add more country-specific sets (UK, CA, etc.) as follow-ups.

-- Ensure the referenced country rows exist, in case this seed runs before
-- 0004_minimal_geo_seed.sql. (0004 upserts these, so re-running is safe.)
insert into countries (code, name) values
  ('US','United States')
on conflict (code) do nothing;

insert into ethnicity_catalog (country_code, kind, code, label, sort_order) values
  -- INTERNATIONAL FALLBACK (shown when country not covered)
  (null, 'race', 'african',              'African / Black',           10),
  (null, 'race', 'east_asian',           'East Asian',                20),
  (null, 'race', 'south_asian',          'South Asian',               30),
  (null, 'race', 'southeast_asian',      'Southeast Asian',           40),
  (null, 'race', 'european',             'European / White',          50),
  (null, 'race', 'middle_eastern',       'Middle Eastern / N. African', 60),
  (null, 'race', 'latin_american',       'Latin American',            70),
  (null, 'race', 'indigenous',           'Indigenous / Native',       80),
  (null, 'race', 'pacific_islander',     'Pacific Islander',          90),
  (null, 'race', 'mixed',                'Mixed / Multiple',         100),
  (null, 'race', 'other',                'Other',                    110),
  (null, 'race', 'prefer_not',           'Prefer not to say',        999),

  -- US CENSUS (2020) — race, multi-select
  ('US', 'race', 'white',                'White',                     10),
  ('US', 'race', 'black',                'Black or African American', 20),
  ('US', 'race', 'asian',                'Asian',                     30),
  ('US', 'race', 'aian',                 'American Indian or Alaska Native', 40),
  ('US', 'race', 'nhpi',                 'Native Hawaiian or Pacific Islander', 50),
  ('US', 'race', 'mena',                 'Middle Eastern or North African', 60),
  ('US', 'race', 'other',                'Some other race',           70),
  ('US', 'race', 'prefer_not',           'Prefer not to say',        999),

  -- US CENSUS — Hispanic/Latino ethnicity (single-select-ish)
  ('US', 'ethnicity', 'hispanic',        'Hispanic or Latino',        10),
  ('US', 'ethnicity', 'not_hispanic',    'Not Hispanic or Latino',    20),
  ('US', 'ethnicity', 'prefer_not',      'Prefer not to say',        999)
on conflict do nothing;
