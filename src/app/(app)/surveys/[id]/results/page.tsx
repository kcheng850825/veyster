import { notFound, redirect } from "next/navigation";
import { getServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import { SENTINEL_UUID } from "@/lib/constants";
import { ResultsView } from "@/components/ResultsView";
import type { Answer, Question, SurveyVersion } from "@/lib/types";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Survey + versions can be fetched in parallel; nothing else depends on
  // questions/sessions/answers before we know the version ids.
  const [{ data: survey }, { data: versions }] = await Promise.all([
    supabase
      .from("surveys")
      .select("id, title, owner_id, is_paid_tier, payout_mode")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle(),
    supabase
      .from("survey_versions")
      .select("*")
      .eq("survey_id", id)
      .order("version_number", { ascending: true })
      .returns<SurveyVersion[]>(),
  ]);
  if (!survey) notFound();

  const versionIds = (versions ?? []).map((v) => v.id);
  const idsForIn = versionIds.length ? versionIds : [SENTINEL_UUID];

  // Questions + sessions both keyed on version_id and don't depend on each
  // other — fire in parallel.
  const [{ data: questions }, { data: sessions }] = await Promise.all([
    supabase
      .from("questions")
      .select("*")
      .in("version_id", idsForIn)
      .order("position")
      .returns<Question[]>(),
    supabase
      .from("survey_sessions")
      .select("id, version_id, profile_snapshot, completed_at")
      .in("version_id", idsForIn),
  ]);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: answers } = await supabase
    .from("answers")
    .select("session_id, question_id, answer")
    .in("session_id", sessionIds.length ? sessionIds : [SENTINEL_UUID])
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
