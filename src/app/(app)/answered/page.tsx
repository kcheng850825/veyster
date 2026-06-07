import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase, getCurrentUser } from "@/lib/supabase/server";

type Row = {
  id: string;
  version_id: string;
  completed_at: string | null;
  started_at: string;
  survey_versions: {
    version_number: number;
    surveys: {
      id: string;
      title: string;
      share_slug: string;
    } | null;
  } | null;
};

export default async function AnsweredPage() {
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("survey_sessions")
    .select(`
      id, version_id, completed_at, started_at,
      survey_versions!inner (
        version_number,
        surveys!inner ( id, title, share_slug )
      )
    `)
    .eq("respondent_id", user.id)
    .order("started_at", { ascending: false })
    .returns<Row[]>();

  const sessions = rows ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Answered</h1>
      <p className="text-sm text-ink-500 mb-6">
        Surveys you&apos;ve started or completed.
      </p>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300 p-10 text-center text-ink-500">
          You haven&apos;t answered any surveys yet.
          <div className="mt-3">
            <Link href="/feed" className="text-brand-600 hover:underline">
              Browse the feed →
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((row) => {
            const sv = row.survey_versions;
            const survey = sv?.surveys;
            if (!sv || !survey) return null;
            const completed = !!row.completed_at;
            return (
              <li key={row.id}>
                <Link
                  href={`/s/${survey.share_slug}`}
                  className="block rounded-2xl border border-ink-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{survey.title}</div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-ink-100 text-ink-600">
                        v{sv.version_number}
                      </span>
                      <span
                        className={
                          "px-2 py-0.5 rounded-full " +
                          (completed
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700")
                        }
                      >
                        {completed ? "Completed" : "In progress"}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-ink-500 mt-1">
                    {completed
                      ? `Completed ${new Date(row.completed_at!).toLocaleDateString()}`
                      : `Started ${new Date(row.started_at).toLocaleDateString()} — tap to continue`}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
