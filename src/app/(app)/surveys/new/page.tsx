import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

async function createSurvey(formData: FormData) {
  "use server";
  const sb = await getServerSupabase();
  const { data: userData } = await sb.auth.getUser();
  if (!userData.user) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!title) return;

  const { data: survey, error } = await sb
    .from("surveys")
    .insert({ title, description, owner_id: userData.user.id })
    .select("id")
    .single();
  if (error || !survey) {
    redirect(
      `/surveys/new?error=${encodeURIComponent(error?.message ?? "Could not create survey")}`,
    );
  }

  // Seed version 1 so the editor always has a version to work with.
  const { error: vErr } = await sb
    .from("survey_versions")
    .insert({ survey_id: survey.id, version_number: 1, status: "draft" });
  if (vErr) {
    redirect(`/surveys/new?error=${encodeURIComponent(vErr.message)}`);
  }

  redirect(`/surveys/${survey.id}`);
}

export default async function NewSurveyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900 mb-6">New survey</h1>
      {error && (
        <div className="mb-4 text-sm text-no-700 bg-no-50 border border-no-100 rounded-2xl px-4 py-3">
          {error}
        </div>
      )}
      <form action={createSurvey} className="space-y-4">
        <Field label="Title">
          <Input name="title" required maxLength={140} placeholder="e.g. Remote work preferences" />
        </Field>
        <Field label="Description (optional)" hint="Shown to respondents before they start.">
          <Textarea name="description" rows={3} maxLength={600} />
        </Field>
        <Button>Create survey</Button>
      </form>
    </div>
  );
}
