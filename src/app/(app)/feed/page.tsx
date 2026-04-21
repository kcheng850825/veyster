import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

type VersionRow = {
  id: string;
  version_number: number;
  survey_id: string;
  surveys: {
    id: string;
    title: string;
    description: string | null;
    share_slug: string;
    owner_id: string;
  } | null;
};

export default async function FeedPage() {
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  // Every currently-open version whose parent survey is publicly listed and
  // not owned by the current user.
  const { data: openVersions } = await supabase
    .from("survey_versions")
    .select(`
      id, version_number, survey_id,
      surveys!inner ( id, title, description, share_slug, owner_id, visibility )
    `)
    .eq("status", "open")
    .eq("surveys.visibility", "public")
    .neq("surveys.owner_id", userData.user.id)
    .order("opened_at", { ascending: false })
    .limit(50)
    .returns<VersionRow[]>();

  // Hide versions the current user has already completed.
  const { data: completedSessions } = await supabase
    .from("survey_sessions")
    .select("version_id")
    .eq("respondent_id", userData.user.id)
    .not("completed_at", "is", null);
  const completedVersionIds = new Set(
    (completedSessions ?? []).map((s) => s.version_id),
  );

  const available = (openVersions ?? []).filter(
    (v) => v.surveys && !completedVersionIds.has(v.id),
  );

  // Count questions per version in one roundtrip.
  const { data: qCounts } = await supabase
    .from("questions")
    .select("version_id")
    .in("version_id", available.map((v) => v.id));
  const countByVersion = new Map<string, number>();
  (qCounts ?? []).forEach((row) => {
    countByVersion.set(row.version_id, (countByVersion.get(row.version_id) ?? 0) + 1);
  });

  return (
    <div>
      <h1 className="text-display-sm font-semibold text-ink-900 mb-1">Feed</h1>
      <p className="text-sm text-ink-600 mb-6">
        Open surveys from the community. Tap to start swiping.
      </p>

      {available.length === 0 ? (
        <div className="card p-10 text-center text-ink-500 border-dashed">
          <div className="text-4xl mb-2">📭</div>
          Nothing waiting right now. Come back later.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {available.map((v) => {
            const s = v.surveys!;
            const qCount = countByVersion.get(v.id) ?? 0;
            return (
              <li key={v.id}>
                <Link
                  href={`/s/${s.share_slug}`}
                  className="block h-full card hover:shadow-pop hover:-translate-y-0.5 transition p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-lg font-semibold text-ink-900 leading-snug tracking-tight">
                      {s.title}
                    </div>
                    {v.version_number > 1 && (
                      <span className="chip chip-brand font-mono">
                        v{v.version_number}
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <p className="text-sm text-ink-600 mt-2 line-clamp-3">
                      {s.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-2 text-xs text-ink-500">
                    <span className="chip chip-muted">
                      {qCount} question{qCount === 1 ? "" : "s"}
                    </span>
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
