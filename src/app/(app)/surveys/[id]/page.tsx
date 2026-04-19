import { notFound, redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { SurveyEditor } from "@/components/SurveyEditor";

export default async function SurveyEditorPage({
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
    .select("*")
    .eq("id", id)
    .eq("owner_id", userData.user.id)
    .maybeSingle();

  if (!survey) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("survey_id", id)
    .order("position");

  return <SurveyEditor initialSurvey={survey} initialQuestions={questions ?? []} />;
}
