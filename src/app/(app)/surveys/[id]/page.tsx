import { notFound, redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { SurveyEditor } from "@/components/SurveyEditor";
import type { Question, Survey, SurveyVersion } from "@/lib/types";

export default async function SurveyEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { id } = await params;
  const { v } = await searchParams;

  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: survey } = await supabase
    .from("surveys")
    .select("*")
    .eq("id", id)
    .eq("owner_id", userData.user.id)
    .maybeSingle<Survey>();
  if (!survey) notFound();

  const { data: versions } = await supabase
    .from("survey_versions")
    .select("*")
    .eq("survey_id", id)
    .order("version_number", { ascending: false })
    .returns<SurveyVersion[]>();
  const allVersions = versions ?? [];

  // Auto-heal: surveys that existed before versioning always get a v1 via
  // the migration backfill, but defensive code is cheap.
  if (allVersions.length === 0) {
    await supabase
      .from("survey_versions")
      .insert({ survey_id: id, version_number: 1, status: "draft" });
    redirect(`/surveys/${id}`);
  }

  // If ?v= is provided and matches, use that; otherwise default to latest.
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
