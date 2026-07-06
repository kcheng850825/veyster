"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { CONTACT_FIELDS } from "@/lib/constants";
import type { ContactFieldKey, ContactFields } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

type Props = {
  slug: string;
  surveyId: string;
  versionId: string;
  contactFields: ContactFields;
};

export function OpenAccessStart({ slug, surveyId, versionId, contactFields }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = CONTACT_FIELDS.filter(
    (f) => contactFields?.[f.key as ContactFieldKey]?.show,
  );

  function isMissingRequired() {
    return shown.some((f) => {
      const cfg = contactFields[f.key as ContactFieldKey];
      return cfg?.required && !values[f.key]?.trim();
    });
  }

  async function start() {
    setError(null);

    // Basic email sanity check if email is shown + filled.
    const email = values.email?.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    // Sign in anonymously so the respondent gets a uid (invisible — no
    // account UI). RLS scopes their session + answers by this uid.
    const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
    if (authErr || !authData.user) {
      setLoading(false);
      setError(
        authErr?.message?.includes("disabled") || authErr?.message?.includes("Anonymous")
          ? "Anonymous responses aren't enabled for this survey yet. Ask the survey owner to turn on anonymous sign-ins in Supabase."
          : authErr?.message ?? "Couldn't start the survey. Please try again.",
      );
      return;
    }
    const uid = authData.user.id;

    // survey_sessions.respondent_id references profiles(id) — create the row.
    const { error: profErr } = await supabase
      .from("profiles")
      .upsert({ id: uid }, { onConflict: "id" });
    if (profErr) {
      setLoading(false);
      setError(profErr.message);
      return;
    }

    const { error: sessErr } = await supabase.from("survey_sessions").insert({
      survey_id: surveyId,
      version_id: versionId,
      respondent_id: uid,
      profile_snapshot: {},
      verified_fields: [],
      respondent_name: values.name?.trim() || null,
      respondent_phone: values.phone?.trim() || null,
      respondent_email: values.email?.trim() || null,
    });
    setLoading(false);
    if (sessErr) return setError(sessErr.message);

    router.replace(`/s/${slug}/respond`);
  }

  return (
    <div className="mt-6 space-y-4">
      {shown.length > 0 && (
        <div className="rounded-2xl border border-ink-200 bg-white p-4 space-y-3">
          <div className="font-medium">A little about you</div>
          {shown.map((f) => {
            const cfg = contactFields[f.key as ContactFieldKey];
            return (
              <Field
                key={f.key}
                label={cfg?.required ? `${f.label} *` : f.label}
              >
                <Input
                  type={f.inputType}
                  inputMode={f.key === "phone" ? "tel" : undefined}
                  autoComplete={f.autoComplete}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              </Field>
            );
          })}
        </div>
      )}

      {error && (
        <div className="text-sm text-no-700 bg-no-50 border border-no-100 rounded-2xl px-4 py-3">
          {error}
        </div>
      )}

      <Button
        onClick={start}
        disabled={loading || isMissingRequired()}
        className="w-full"
      >
        {loading ? "Starting…" : "Start survey"}
      </Button>
      <p className="text-center text-xs text-ink-400">
        No account needed. Your answers are shared with the survey creator.
      </p>
    </div>
  );
}
