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
      .select("id, title, owner_id, is_paid_tier, payout_mode, access_mode")
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
      .select("id, version_id, profile_snapshot, completed_at, started_at, respondent_name, respondent_phone, respondent_email")
      .in("version_id", idsForIn),
  ]);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: answers } = await supabase
    .from("answers")
    .select("session_id, question_id, answer")
    .in("session_id", sessionIds.length ? sessionIds : [SENTINEL_UUID])
    .returns<({ session_id: string; question_id: string; answer: Answer })[]>();

  const isOpen = survey.access_mode === "open";
  const contacts = isOpen
    ? (sessions ?? [])
        .map((s) => ({
          name: s.respondent_name as string | null,
          phone: s.respondent_phone as string | null,
          email: s.respondent_email as string | null,
          completed: !!s.completed_at,
          at: (s.completed_at ?? s.started_at) as string,
        }))
        .sort((a, b) => (a.at < b.at ? 1 : -1))
    : [];
  const hasContactData = contacts.some((c) => c.name || c.phone || c.email);

  return (
    <>
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

      {isOpen && hasContactData && (
        <section className="mt-6 space-y-3">
          <h2 className="font-semibold">Respondents</h2>
          <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs text-ink-500 text-left">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">When</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, i) => (
                  <tr key={i} className="border-t border-ink-100">
                    <td className="p-3">{c.name || "—"}</td>
                    <td className="p-3">{c.email || "—"}</td>
                    <td className="p-3">{c.phone || "—"}</td>
                    <td className="p-3">
                      {c.completed ? (
                        <span className="chip chip-yes">Completed</span>
                      ) : (
                        <span className="chip chip-muted">In progress</span>
                      )}
                    </td>
                    <td className="p-3 text-ink-500">
                      {new Date(c.at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-500">
            Contact info collected from open (friends &amp; family) respondents.
          </p>
        </section>
      )}
    </>
  );
}
