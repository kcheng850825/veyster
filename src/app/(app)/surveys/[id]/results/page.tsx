import { notFound, redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { ResultsView } from "@/components/ResultsView";
import type { Answer, Question, SurveyVersion } from "@/lib/types";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: survey } = await supabase
    .from("surveys")
    .select("id, title, owner_id, is_paid_tier, payout_mode")
    .eq("id", id)
    .eq("owner_id", userData.user.id)
    .maybeSingle();
  if (!survey) notFound();

  const { data: versions } = await supabase
    .from("survey_versions")
    .select("*")
    .eq("survey_id", id)
    .order("version_number", { ascending: true })
    .returns<SurveyVersion[]>();

  const versionIds = (versions ?? []).map((v) => v.id);

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .in("version_id", versionIds.length ? versionIds : ["00000000-0000-0000-0000-000000000000"])
    .order("position")
    .returns<Question[]>();

  const { data: sessions } = await supabase
    .from("survey_sessions")
    .select("id, version_id, profile_snapshot, completed_at")
    .in("version_id", versionIds.length ? versionIds : ["00000000-0000-0000-0000-000000000000"]);

  const sessionIds = (sessions ?? []).map((s) => s.id);

  const { data: answers } = await supabase
    .from("answers")
    .select("session_id, question_id, answer")
    .in("session_id", sessionIds.length ? sessionIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<({ session_id: string; question_id: string; answer: Answer })[]>();

  return (
    <ResultsView
      surveyId={survey.id}
      surveyTitle={survey.title}
      versions={versions ?? []}
      questions={questions ?? []}
      sessions={(sessions ?? []).map((s) => ({
        id: s.id,
        version_id: s.version_id as string,
        profile_snapshot: s.profile_snapshot as Record<string, unknown>,
        completed_at: s.completed_at as string | null,
      }))}
      answers={answers ?? []}
    />
  );
}
