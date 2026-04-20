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
      <h1 className="text-2xl font-bold mb-1">Feed</h1>
      <p className="text-sm text-gray-500 mb-6">
        Surveys open to anyone. Swipe yes or no.
      </p>

      {available.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
          No surveys available right now. Check back soon.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {available.map((v) => {
            const s = v.surveys!;
            const qCount = countByVersion.get(v.id) ?? 0;
            return (
              <li key={v.id}>
                <Link
                  href={`/s/${s.share_slug}`}
                  className="block h-full rounded-2xl border border-gray-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold">{s.title}</div>
                    {v.version_number > 1 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                        v{v.version_number}
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-3">
                      {s.description}
                    </p>
                  )}
                  <div className="mt-3 text-xs text-gray-500">
                    {qCount} yes/no question{qCount === 1 ? "" : "s"}
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
