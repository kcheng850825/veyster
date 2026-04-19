import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

async function createSurvey(formData: FormData) {
  "use server";
  const supabase = (await import("@/lib/supabase/server")).getServerSupabase;
  const sb = await supabase();
  const { data: userData } = await sb.auth.getUser();
  if (!userData.user) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!title) return;

  const { data, error } = await sb
    .from("surveys")
    .insert({ title, description, owner_id: userData.user.id })
    .select("id")
    .single();
  if (error) throw error;
  redirect(`/surveys/${data!.id}`);
}

export default function NewSurveyPage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">New survey</h1>
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
