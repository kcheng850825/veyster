"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { EDUCATION_LEVELS, GENDERS, MIN_RESPONDENT_AGE } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";

type Props = {
  profile: Profile;
  mode: "onboarding" | "edit";
};

type Country = { code: string; name: string };
type Admin1 = { code: string; name: string };
type City = { geonameid: number; name: string };
type EthnicityRow = { kind: "race" | "ethnicity"; code: string; label: string };

export function DemographicsForm({ profile, mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getBrowserSupabase(), []);

  const [birthYear, setBirthYear] = useState(profile.birth_year?.toString() ?? "");
  const [gender, setGender] = useState<string>(profile.gender ?? "");
  const [education, setEducation] = useState<string>(profile.education ?? "");
  const [countryCode, setCountryCode] = useState<string>(profile.country_code ?? "");
  const [admin1Code, setAdmin1Code] = useState<string>(profile.admin1_code ?? "");
  const [city, setCity] = useState<City | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [raceCodes, setRaceCodes] = useState<string[]>(profile.race_codes);
  const [ethnicityCodes, setEthnicityCodes] = useState<string[]>(profile.ethnicity_codes);

  const [countries, setCountries] = useState<Country[]>([]);
  const [admin1s, setAdmin1s] = useState<Admin1[]>([]);
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [races, setRaces] = useState<EthnicityRow[]>([]);
  const [ethnicities, setEthnicities] = useState<EthnicityRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nowYear = new Date().getUTCFullYear();
  const years = Array.from({ length: 90 }, (_, i) => nowYear - MIN_RESPONDENT_AGE - i);

  // Load countries
  useEffect(() => {
    supabase
      .from("countries")
      .select("code, name")
      .order("name")
      .then(({ data }) => setCountries(data ?? []));
  }, [supabase]);

  // Load admin1 when country changes
  useEffect(() => {
    if (!countryCode) {
      setAdmin1s([]);
      return;
    }
    supabase
      .from("admin1")
      .select("code, name")
      .eq("country_code", countryCode)
      .order("name")
      .then(({ data }) => setAdmin1s(data ?? []));
  }, [countryCode, supabase]);

  // Load initial city label if profile has one
  useEffect(() => {
    if (!profile.city_geonameid || city) return;
    supabase
      .from("cities")
      .select("geonameid, name")
      .eq("geonameid", profile.city_geonameid)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCity(data);
          setCityQuery(data.name);
        }
      });
  }, [profile.city_geonameid, supabase, city]);

  // City typeahead. Two-stage: first try with admin1 filter if set, then
  // fall back to country-only so the user isn't blocked by an admin1 mismatch
  // (e.g. they picked "NY" as state but their city's geonames admin1 is spelled
  // differently). Uses substring match so "oston" finds "Boston" too.
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const [citySearchRan, setCitySearchRan] = useState(false);

  useEffect(() => {
    if (!countryCode || cityQuery.length < 2) {
      setCityResults([]);
      setCitySearchRan(false);
      return;
    }
    const h = setTimeout(async () => {
      setCitySearchLoading(true);
      setCitySearchRan(false);
      const escaped = cityQuery.replace(/[%_]/g, "\\$&");
      let q = supabase
        .from("cities")
        .select("geonameid, name, admin1_code")
        .eq("country_code", countryCode)
        .ilike("name", `%${escaped}%`)
        .order("population", { ascending: false })
        .limit(12);
      if (admin1Code) q = q.eq("admin1_code", admin1Code);
      let { data } = await q;
      if ((!data || data.length === 0) && admin1Code) {
        // Retry without the admin1 filter
        const { data: broader } = await supabase
          .from("cities")
          .select("geonameid, name, admin1_code")
          .eq("country_code", countryCode)
          .ilike("name", `%${escaped}%`)
          .order("population", { ascending: false })
          .limit(12);
        data = broader;
      }
      setCityResults(data ?? []);
      setCitySearchLoading(false);
      setCitySearchRan(true);
    }, 180);
    return () => clearTimeout(h);
  }, [cityQuery, countryCode, admin1Code, supabase]);

  // Load ethnicity catalog for current country (with international fallback if no country-specific entries)
  useEffect(() => {
    async function load() {
      if (!countryCode) {
        const { data } = await supabase
          .from("ethnicity_catalog")
          .select("kind, code, label, sort_order")
          .is("country_code", null)
          .order("sort_order");
        setRaces((data ?? []).filter((r) => r.kind === "race"));
        setEthnicities((data ?? []).filter((r) => r.kind === "ethnicity"));
        return;
      }
      const { data: local } = await supabase
        .from("ethnicity_catalog")
        .select("kind, code, label, sort_order")
        .eq("country_code", countryCode)
        .order("sort_order");
      if (local && local.length > 0) {
        setRaces(local.filter((r) => r.kind === "race"));
        setEthnicities(local.filter((r) => r.kind === "ethnicity"));
      } else {
        const { data: intl } = await supabase
          .from("ethnicity_catalog")
          .select("kind, code, label, sort_order")
          .is("country_code", null)
          .order("sort_order");
        setRaces((intl ?? []).filter((r) => r.kind === "race"));
        setEthnicities((intl ?? []).filter((r) => r.kind === "ethnicity"));
      }
    }
    load();
  }, [countryCode, supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!birthYear || !gender || !education || !countryCode) {
      setError("Please fill in birth year, gender, education, and country.");
      return;
    }
    setSaving(true);
    const payload: Partial<Profile> & { onboarded_at?: string; updated_at?: string } = {
      birth_year: parseInt(birthYear, 10),
      gender: gender as Profile["gender"],
      education: education as Profile["education"],
      updated_at: new Date().toISOString(),
      country_code: countryCode,
      admin1_code: admin1Code || null,
      city_geonameid: city?.geonameid ?? null,
      race_codes: raceCodes,
      ethnicity_codes: ethnicityCodes,
    };
    if (mode === "onboarding") payload.onboarded_at = new Date().toISOString();

    const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id);
    setSaving(false);
    if (error) return setError(error.message);

    const next = searchParams.get("next");
    const defaultLanding = mode === "onboarding" ? "/feed" : "/profile";
    router.replace(next || defaultLanding);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Field label="Birth year">
        <Select value={birthYear} onChange={(e) => setBirthYear(e.target.value)} required>
          <option value="">Select year…</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      </Field>

      <Field label="Gender">
        <Select value={gender} onChange={(e) => setGender(e.target.value)} required>
          <option value="">Select…</option>
          {GENDERS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </Select>
      </Field>

      <Field label="Highest education">
        <Select value={education} onChange={(e) => setEducation(e.target.value)} required>
          <option value="">Select…</option>
          {EDUCATION_LEVELS.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </Select>
      </Field>

      <Field label="Country of residence">
        <Select
          value={countryCode}
          onChange={(e) => {
            setCountryCode(e.target.value);
            setAdmin1Code("");
            setCity(null);
            setCityQuery("");
            setRaceCodes([]);
            setEthnicityCodes([]);
          }}
          required
        >
          <option value="">Select country…</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </Select>
      </Field>

      {admin1s.length > 0 && (
        <Field label="State / region">
          <Select value={admin1Code} onChange={(e) => setAdmin1Code(e.target.value)}>
            <option value="">Select…</option>
            {admin1s.map((a) => (
              <option key={a.code} value={a.code}>{a.name}</option>
            ))}
          </Select>
        </Field>
      )}

      {countryCode && (
        <Field
          label="City"
          hint={
            city
              ? "Tap the field and re-type to change your selection."
              : "Pick one from the dropdown — free-text entries aren't saved."
          }
        >
          <div className="relative">
            <Input
              value={cityQuery}
              onChange={(e) => {
                setCityQuery(e.target.value);
                setCity(null);
              }}
              placeholder="Search your city…"
              autoComplete="off"
            />
            {!city && cityQuery.length >= 2 && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-ink-200 bg-white shadow-lg max-h-60 overflow-auto">
                {citySearchLoading ? (
                  <div className="px-3 py-2 text-sm text-ink-400">Searching…</div>
                ) : cityResults.length > 0 ? (
                  <ul>
                    {cityResults.map((c) => (
                      <li key={c.geonameid}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-ink-50"
                          onClick={() => {
                            setCity(c);
                            setCityQuery(c.name);
                            setCityResults([]);
                          }}
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : citySearchRan ? (
                  <div className="px-3 py-2 text-xs text-ink-500 space-y-1">
                    <div>No matches for &quot;{cityQuery}&quot; in the selected country.</div>
                    <div>
                      Only the top ~80 US cities ship with the app by default. If yours
                      isn&apos;t here, pick a nearby larger city — or skip this field; it&apos;s
                      optional.
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </Field>
      )}

      {ethnicities.length > 0 && (
        <Field label="Ethnicity" hint="Pick one">
          <Select
            value={ethnicityCodes[0] ?? ""}
            onChange={(e) =>
              setEthnicityCodes(e.target.value ? [e.target.value] : [])
            }
          >
            <option value="">Select…</option>
            {ethnicities.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {races.length > 0 && (
        <Field
          label="Race"
          hint='Select all that apply. "Prefer not to say" clears other choices.'
        >
          <MultiSelectDropdown
            options={races.map((r) => ({ code: r.code, label: r.label }))}
            selected={raceCodes}
            onChange={setRaceCodes}
            placeholder="Select one or more…"
            exclusiveCode="prefer_not"
          />
        </Field>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button disabled={saving}>
        {saving ? "Saving…" : mode === "onboarding" ? "Finish setup" : "Save changes"}
      </Button>
    </form>
  );
}
