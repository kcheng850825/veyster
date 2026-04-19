import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";

export default async function SurveysListPage() {
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: surveys } = await supabase
    .from("surveys")
    .select("id, title, status, share_slug, updated_at, questions(count)")
    .eq("owner_id", userData.user.id)
    .order("updated_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your surveys</h1>
        <Link href="/surveys/new">
          <Button>New survey</Button>
        </Link>
      </div>

      {!surveys || surveys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
          No surveys yet. Create your first one.
        </div>
      ) : (
        <ul className="space-y-3">
          {surveys.map((s) => {
            const qCount =
              (Array.isArray(s.questions) ? s.questions[0]?.count : 0) ?? 0;
            return (
              <li key={s.id}>
                <Link
                  href={`/surveys/${s.id}`}
                  className="block rounded-2xl border border-gray-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{s.title}</div>
                    <span
                      className={
                        "text-xs px-2 py-0.5 rounded-full " +
                        (s.status === "open"
                          ? "bg-emerald-50 text-emerald-700"
                          : s.status === "draft"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-gray-100 text-gray-500")
                      }
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {qCount} / 10 questions · updated{" "}
                    {new Date(s.updated_at).toLocaleDateString()}
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
