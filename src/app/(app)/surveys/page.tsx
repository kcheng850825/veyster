import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";

type VersionRow = {
  id: string;
  survey_id: string;
  version_number: number;
  status: "draft" | "open" | "retired";
};

export default async function SurveysListPage() {
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: surveys } = await supabase
    .from("surveys")
    .select("id, title, share_slug, updated_at")
    .eq("owner_id", userData.user.id)
    .order("updated_at", { ascending: false });

  const surveyIds = (surveys ?? []).map((s) => s.id);
  const { data: versions } = await supabase
    .from("survey_versions")
    .select("id, survey_id, version_number, status")
    .in("survey_id", surveyIds.length ? surveyIds : ["00000000-0000-0000-0000-000000000000"])
    .returns<VersionRow[]>();

  const byId = new Map<string, VersionRow[]>();
  (versions ?? []).forEach((v) => {
    const list = byId.get(v.survey_id) ?? [];
    list.push(v);
    byId.set(v.survey_id, list);
  });
  byId.forEach((list) => list.sort((a, b) => b.version_number - a.version_number));

  // Question counts for the latest version of each survey
  const latestVersionIds = surveyIds
    .map((id) => byId.get(id)?.[0]?.id)
    .filter((x): x is string => !!x);
  const { data: qCountRows } = await supabase
    .from("questions")
    .select("version_id")
    .in("version_id", latestVersionIds.length ? latestVersionIds : ["00000000-0000-0000-0000-000000000000"]);
  const qCount = new Map<string, number>();
  (qCountRows ?? []).forEach((r) => qCount.set(r.version_id, (qCount.get(r.version_id) ?? 0) + 1));

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
            const versionList = byId.get(s.id) ?? [];
            const latest = versionList[0];
            const openCount = versionList.filter((v) => v.status === "open").length;
            const latestStatus = latest?.status ?? "draft";
            const latestQ = latest ? (qCount.get(latest.id) ?? 0) : 0;
            return (
              <li key={s.id}>
                <Link
                  href={`/surveys/${s.id}`}
                  className="block rounded-2xl border border-gray-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{s.title}</div>
                    <div className="flex items-center gap-1.5 text-xs">
                      {latest && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          v{latest.version_number}
                        </span>
                      )}
                      <span
                        className={
                          "px-2 py-0.5 rounded-full " +
                          (latestStatus === "open"
                            ? "bg-emerald-50 text-emerald-700"
                            : latestStatus === "draft"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-amber-50 text-amber-700")
                        }
                      >
                        {latestStatus}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {latestQ} / 10 questions
                    {versionList.length > 1 && ` · ${versionList.length} versions`}
                    {openCount === 0 && latestStatus !== "draft" && " · no version accepting responses"}
                    {" · updated "}
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
