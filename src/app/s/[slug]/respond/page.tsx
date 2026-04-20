import { notFound, redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { SwipeDeck } from "@/components/SwipeDeck";
import type { Answer } from "@/lib/types";

export default async function RespondPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(`/login?next=/s/${slug}/respond`);

  const { data: survey } = await supabase
    .from("surveys")
    .select("id, share_slug")
    .eq("share_slug", slug)
    .maybeSingle();
  if (!survey) notFound();

  // Sessions are keyed on version, not survey. Find the most recent
  // incomplete session for this user on any version of the survey.
  const { data: session } = await supabase
    .from("survey_sessions")
    .select("id, completed_at, version_id")
    .eq("survey_id", survey.id)
    .eq("respondent_id", userData.user.id)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) redirect(`/s/${slug}`);
  if (session.completed_at) redirect(`/s/${slug}/done`);

  // Questions are tied to the version the session started on — not the
  // currently-open version. This preserves the survey as it was when the
  // respondent began.
  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("version_id", session.version_id)
    .order("position");

  const { data: answers } = await supabase
    .from("answers")
    .select("question_id, answer")
    .eq("session_id", session.id);

  return (
    <SwipeDeck
      slug={slug}
      sessionId={session.id}
      questions={questions ?? []}
      initialAnswers={(answers ?? []) as { question_id: string; answer: Answer }[]}
    />
  );
}
