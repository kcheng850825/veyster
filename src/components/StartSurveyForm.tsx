"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { VERIFICATION_FIELDS, EDUCATION_LEVELS, GENDERS } from "@/lib/constants";
import type { Profile, VerificationField } from "@/lib/types";
import { Button } from "@/components/ui/Button";

type Props = {
  slug: string;
  surveyId: string;
  versionId: string;
  profile: Profile;
  verificationFields: VerificationField[];
};

type Lookups = {
  country?: string;
  admin1?: string;
  city?: string;
  races?: string[];
  ethnicities?: string[];
};

export function StartSurveyForm({ slug, surveyId, versionId, profile, verificationFields }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookups, setLookups] = useState<Lookups>({});

  const needsAll = verificationFields.length > 0;
  const allConfirmed = verificationFields.every((f) => confirmed[f]);

  // Resolve readable labels for country, admin1, city, and ethnicity/race codes.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const next: Lookups = {};

      if (profile.country_code) {
        const { data } = await supabase
          .from("countries")
          .select("name")
          .eq("code", profile.country_code)
          .maybeSingle();
        if (data?.name) next.country = data.name;
      }

      if (profile.country_code && profile.admin1_code) {
        const { data } = await supabase
          .from("admin1")
          .select("name")
          .eq("country_code", profile.country_code)
          .eq("code", profile.admin1_code)
          .maybeSingle();
        if (data?.name) next.admin1 = data.name;
      }

      if (profile.city_geonameid) {
        const { data } = await supabase
          .from("cities")
          .select("name")
          .eq("geonameid", profile.city_geonameid)
          .maybeSingle();
        if (data?.name) next.city = data.name;
      }

      const allCodes = [...profile.race_codes, ...profile.ethnicity_codes];
      if (allCodes.length > 0) {
        // Fetch labels; prefer country-specific rows over international fallback
        // when both exist for the same code.
        const { data: catalog } = await supabase
          .from("ethnicity_catalog")
          .select("kind, code, label, country_code")
          .in("code", allCodes)
          .or(
            profile.country_code
              ? `country_code.eq.${profile.country_code},country_code.is.null`
              : "country_code.is.null",
          );

        const byCode = new Map<string, { label: string; country_code: string | null }>();
        for (const row of catalog ?? []) {
          const existing = byCode.get(row.code);
          // Keep the first one unless we find a country-specific match
          if (!existing || (existing.country_code === null && row.country_code !== null)) {
            byCode.set(row.code, { label: row.label, country_code: row.country_code });
          }
        }

        next.races = profile.race_codes.map((c) => byCode.get(c)?.label ?? c);
        next.ethnicities = profile.ethnicity_codes.map((c) => byCode.get(c)?.label ?? c);
      }

      if (!cancelled) setLookups(next);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, profile.country_code, profile.admin1_code, profile.city_geonameid, profile.race_codes, profile.ethnicity_codes]);

  async function start() {
    setError(null);
    setLoading(true);
    const snapshot = {
      birth_year: profile.birth_year,
      gender: profile.gender,
      education: profile.education,
      country_code: profile.country_code,
      admin1_code: profile.admin1_code,
      city_geonameid: profile.city_geonameid,
      race_codes: profile.race_codes,
      ethnicity_codes: profile.ethnicity_codes,
    };
    const { error } = await supabase.from("survey_sessions").insert({
      survey_id: surveyId,
      version_id: versionId,
      respondent_id: profile.id,
      profile_snapshot: snapshot,
      verified_fields: verificationFields,
    });
    setLoading(false);
    if (error) return setError(error.message);
    router.replace(`/s/${slug}/respond`);
  }

  return (
    <div className="mt-6 space-y-4">
      {needsAll && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="font-medium">Confirm your info</div>
          <p className="text-xs text-gray-500 mt-1">
            The researcher needs these fields to be current. Confirm each, or update your
            profile first.
          </p>
          <ul className="mt-3 space-y-2">
            {verificationFields.map((f) => {
              const label = VERIFICATION_FIELDS.find((v) => v.key === f)?.label ?? f;
              const display = displayValue(f, profile, lookups);
              return (
                <li key={f} className="flex items-start gap-2">
                  <input
                    id={`v-${f}`}
                    type="checkbox"
                    checked={!!confirmed[f]}
                    onChange={(e) =>
                      setConfirmed((c) => ({ ...c, [f]: e.target.checked }))
                    }
                    className="mt-1"
                    disabled={!display}
                  />
                  <label htmlFor={`v-${f}`} className="text-sm flex-1">
                    <div className="font-medium">{label}</div>
                    <div className="text-gray-500">
                      {display || (
                        <span className="text-amber-600">
                          Not set — update your profile.
                        </span>
                      )}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
          <Link
            href={`/profile?next=${encodeURIComponent(`/s/${slug}`)}`}
            className="mt-3 inline-block text-xs text-brand-600 hover:underline"
          >
            Update profile →
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button
        onClick={start}
        disabled={loading || (needsAll && !allConfirmed)}
        className="w-full"
      >
        {loading ? "Starting…" : "Start survey"}
      </Button>
    </div>
  );
}

function displayValue(
  field: VerificationField,
  p: Profile,
  l: Lookups,
): string | null {
  switch (field) {
    case "birth_year":
      return p.birth_year?.toString() ?? null;
    case "gender":
      return GENDERS.find((g) => g.value === p.gender)?.label ?? null;
    case "education":
      return EDUCATION_LEVELS.find((e) => e.value === p.education)?.label ?? null;
    case "country":
      return l.country ?? p.country_code ?? null;
    case "admin1":
      return l.admin1 ?? p.admin1_code ?? null;
    case "city":
      return l.city ?? (p.city_geonameid ? "Loading…" : null);
    case "race":
      return l.races && l.races.length > 0
        ? l.races.join(", ")
        : p.race_codes.length > 0
          ? "Loading…"
          : null;
    case "ethnicity":
      return l.ethnicities && l.ethnicities.length > 0
        ? l.ethnicities.join(", ")
        : p.ethnicity_codes.length > 0
          ? "Loading…"
          : null;
  }
}
