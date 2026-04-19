import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function FeedPage() {
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  // Which surveys has this user already answered? Hide them.
  const { data: myCompletedSessions } = await supabase
    .from("survey_sessions")
    .select("survey_id")
    .eq("respondent_id", userData.user.id)
    .not("completed_at", "is", null);
  const answered = new Set((myCompletedSessions ?? []).map((s) => s.survey_id));

  const { data: surveys } = await supabase
    .from("surveys")
    .select("id, title, description, share_slug, owner_id, questions(count)")
    .eq("status", "open")
    .eq("visibility", "public")
    .neq("owner_id", userData.user.id)
    .order("opened_at", { ascending: false })
    .limit(50);

  const available = (surveys ?? []).filter((s) => !answered.has(s.id));

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
          {available.map((s) => {
            const qCount =
              (Array.isArray(s.questions) ? s.questions[0]?.count : 0) ?? 0;
            return (
              <li key={s.id}>
                <Link
                  href={`/s/${s.share_slug}`}
                  className="block h-full rounded-2xl border border-gray-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm"
                >
                  <div className="font-semibold">{s.title}</div>
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
