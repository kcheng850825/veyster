"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { EDUCATION_LEVELS, GENDERS, MIN_RESPONDENT_AGE } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { Field, Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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

  // City typeahead
  useEffect(() => {
    if (!countryCode || cityQuery.length < 2) {
      setCityResults([]);
      return;
    }
    const h = setTimeout(async () => {
      let q = supabase
        .from("cities")
        .select("geonameid, name")
        .eq("country_code", countryCode)
        .ilike("name", `${cityQuery}%`)
        .order("population", { ascending: false })
        .limit(8);
      if (admin1Code) q = q.eq("admin1_code", admin1Code);
      const { data } = await q;
      setCityResults(data ?? []);
    }, 150);
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

  function toggle(list: string[], code: string) {
    return list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
  }

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
    router.replace(mode === "onboarding" ? (next || "/feed") : "/profile");
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
        <Field label="City" hint="Type at least 2 letters">
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
            {cityResults.length > 0 && !city && (
              <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
                {cityResults.map((c) => (
                  <li key={c.geonameid}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
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
            )}
          </div>
        </Field>
      )}

      {races.length > 0 && (
        <Field label="Race" hint="Select all that apply">
          <div className="flex flex-wrap gap-2">
            {races.map((r) => {
              const on = raceCodes.includes(r.code);
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setRaceCodes(toggle(raceCodes, r.code))}
                  className={
                    "px-3 py-1.5 rounded-full text-sm border " +
                    (on
                      ? "bg-brand-50 border-brand-500 text-brand-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")
                  }
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {ethnicities.length > 0 && (
        <Field label="Ethnicity">
          <div className="flex flex-wrap gap-2">
            {ethnicities.map((r) => {
              const on = ethnicityCodes.includes(r.code);
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setEthnicityCodes(toggle(ethnicityCodes, r.code))}
                  className={
                    "px-3 py-1.5 rounded-full text-sm border " +
                    (on
                      ? "bg-brand-50 border-brand-500 text-brand-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")
                  }
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button disabled={saving}>
        {saving ? "Saving…" : mode === "onboarding" ? "Finish setup" : "Save changes"}
      </Button>
    </form>
  );
}
