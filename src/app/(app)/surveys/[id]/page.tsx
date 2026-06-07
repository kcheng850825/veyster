import { notFound, redirect } from "next/navigation";
import { getServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import { SurveyEditor } from "@/components/SurveyEditor";
import type { Question, Survey, SurveyVersion } from "@/lib/types";

export default async function SurveyEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const [{ id }, { v }] = await Promise.all([params, searchParams]);

  const supabase = await getServerSupabase();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ data: survey }, { data: versions }] = await Promise.all([
    supabase
      .from("surveys")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle<Survey>(),
    supabase
      .from("survey_versions")
      .select("*")
      .eq("survey_id", id)
      .order("version_number", { ascending: false })
      .returns<SurveyVersion[]>(),
  ]);
  if (!survey) notFound();
  const allVersions = versions ?? [];

  // Auto-heal: surveys that existed before versioning always get a v1 via
  // the migration backfill, but defensive code is cheap.
  if (allVersions.length === 0) {
    await supabase
      .from("survey_versions")
      .insert({ survey_id: id, version_number: 1, status: "draft" });
    redirect(`/surveys/${id}`);
  }

  const currentVersion =
    (v && allVersions.find((x) => x.id === v)) || allVersions[0];

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("version_id", currentVersion.id)
    .order("position")
    .returns<Question[]>();

  return (
    <SurveyEditor
      key={currentVersion.id}
      initialSurvey={survey}
      currentVersion={currentVersion}
      allVersions={allVersions}
      initialQuestions={questions ?? []}
    />
  );
}
