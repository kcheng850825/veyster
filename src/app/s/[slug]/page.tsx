import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { StartSurveyForm } from "@/components/StartSurveyForm";
import type { Profile, Survey, SurveyVersion, VerificationField } from "@/lib/types";

export default async function SurveyIntroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(`/login?next=/s/${slug}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle<Profile>();

  if (!profile?.onboarded_at) redirect(`/onboarding?next=/s/${slug}`);

  const { data: survey } = await supabase
    .from("surveys")
    .select("*")
    .eq("share_slug", slug)
    .maybeSingle<Survey>();
  if (!survey) notFound();

  // Find the currently-open version, if any.
  const { data: activeVersion } = await supabase
    .from("survey_versions")
    .select("*")
    .eq("survey_id", survey.id)
    .eq("status", "open")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle<SurveyVersion>();

  if (!activeVersion) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-xl font-bold">{survey.title}</h1>
          <p className="text-gray-500 mt-2">This survey is not accepting responses right now.</p>
          <Link href="/feed" className="mt-6 inline-block text-brand-600 hover:underline">
            Browse other surveys
          </Link>
        </div>
      </main>
    );
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("id")
    .eq("version_id", activeVersion.id);
  const questionCount = questions?.length ?? 0;

  // Has this respondent answered this specific version already?
  const { data: existingSession } = await supabase
    .from("survey_sessions")
    .select("id, completed_at, version_id")
    .eq("version_id", activeVersion.id)
    .eq("respondent_id", userData.user.id)
    .maybeSingle();

  if (existingSession?.completed_at) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-xl font-bold">Already answered</h1>
          <p className="text-gray-500 mt-2">
            You've completed v{activeVersion.version_number} of this survey. Thanks.
          </p>
          <Link href="/feed" className="mt-6 inline-block text-brand-600 hover:underline">
            Back to feed
          </Link>
        </div>
      </main>
    );
  }

  if (existingSession) {
    redirect(`/s/${slug}/respond`);
  }

  return (
    <main className="min-h-screen px-6 py-8 max-w-lg mx-auto">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        Survey · v{activeVersion.version_number}
      </div>
      <h1 className="text-2xl font-bold">{survey.title}</h1>
      {survey.description && (
        <p className="mt-2 text-gray-600 whitespace-pre-line">{survey.description}</p>
      )}

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 space-y-3 text-sm">
        <Row
          label="Questions"
          value={`${questionCount} yes/no question${questionCount === 1 ? "" : "s"}`}
        />
        <Row
          label="Payment"
          value={
            survey.payout_mode === "on_complete"
              ? `Paid only if you answer all questions (+${survey.complete_premium_pct}% per question)`
              : "Paid per question answered"
          }
        />
        <Row
          label="Your data"
          value="Only aggregate answers are shown to the researcher. You can stop at any time."
        />
      </div>

      <StartSurveyForm
        slug={slug}
        surveyId={survey.id}
        versionId={activeVersion.id}
        profile={profile}
        verificationFields={survey.verification_fields as VerificationField[]}
      />
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
