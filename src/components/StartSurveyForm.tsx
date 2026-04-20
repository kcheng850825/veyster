"use client";

import { useMemo, useState } from "react";
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

export function StartSurveyForm({ slug, surveyId, versionId, profile, verificationFields }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsAll = verificationFields.length > 0;
  const allConfirmed = verificationFields.every((f) => confirmed[f]);

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
              const display = displayValue(f, profile);
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
            href={`/profile`}
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

function displayValue(field: VerificationField, p: Profile): string | null {
  switch (field) {
    case "birth_year":
      return p.birth_year?.toString() ?? null;
    case "gender":
      return GENDERS.find((g) => g.value === p.gender)?.label ?? null;
    case "education":
      return EDUCATION_LEVELS.find((e) => e.value === p.education)?.label ?? null;
    case "country":
      return p.country_code ?? null;
    case "admin1":
      return p.admin1_code ?? null;
    case "city":
      return p.city_geonameid ? `#${p.city_geonameid}` : null;
    case "race":
      return p.race_codes.length ? p.race_codes.join(", ") : null;
    case "ethnicity":
      return p.ethnicity_codes.length ? p.ethnicity_codes.join(", ") : null;
  }
}
