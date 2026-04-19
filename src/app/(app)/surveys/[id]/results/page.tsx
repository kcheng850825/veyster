import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { EDUCATION_LEVELS, GENDERS } from "@/lib/constants";

type Snapshot = {
  birth_year: number | null;
  gender: string | null;
  education: string | null;
  country_code: string | null;
};

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: survey } = await supabase
    .from("surveys")
    .select("id, title, owner_id, is_paid_tier, payout_mode")
    .eq("id", id)
    .eq("owner_id", userData.user.id)
    .maybeSingle();
  if (!survey) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("id, position, text")
    .eq("survey_id", id)
    .order("position");

  const { data: sessions } = await supabase
    .from("survey_sessions")
    .select("id, profile_snapshot, completed_at")
    .eq("survey_id", id);

  const { data: answers } = await supabase
    .from("answers")
    .select("session_id, question_id, answer")
    .in("session_id", (sessions ?? []).map((s) => s.id).concat(["00000000-0000-0000-0000-000000000000"]));

  const sessionMap = new Map<string, Snapshot>(
    (sessions ?? []).map((s) => [s.id, s.profile_snapshot as Snapshot]),
  );

  // Per-question totals
  const perQuestion = (questions ?? []).map((q) => {
    const rows = (answers ?? []).filter((a) => a.question_id === q.id);
    const yes = rows.filter((a) => a.answer === "yes").length;
    const no = rows.filter((a) => a.answer === "no").length;
    return { ...q, yes, no, total: yes + no };
  });

  const nowYear = new Date().getUTCFullYear();
  const ageBucket = (by: number | null) => {
    if (!by) return "Unknown";
    const age = nowYear - by;
    if (age < 25) return "18–24";
    if (age < 35) return "25–34";
    if (age < 45) return "35–44";
    if (age < 55) return "45–54";
    if (age < 65) return "55–64";
    return "65+";
  };

  const totalSessions = sessions?.length ?? 0;
  const completed = (sessions ?? []).filter((s) => s.completed_at).length;

  // Breakdowns (% yes per question, broken down by dimension)
  function breakdown<T extends string>(
    group: (snap: Snapshot) => T | null,
    labels: Record<string, string>,
  ) {
    const keys = Array.from(
      new Set(
        (sessions ?? [])
          .map((s) => group(s.profile_snapshot as Snapshot))
          .filter((k): k is T => !!k),
      ),
    );
    return keys.map((key) => {
      const sessionIds = new Set(
        (sessions ?? [])
          .filter((s) => group(s.profile_snapshot as Snapshot) === key)
          .map((s) => s.id),
      );
      const perQ = (questions ?? []).map((q) => {
        const rows = (answers ?? []).filter(
          (a) => a.question_id === q.id && sessionIds.has(a.session_id),
        );
        const yes = rows.filter((a) => a.answer === "yes").length;
        const total = rows.length;
        return { qid: q.id, yesPct: total ? Math.round((100 * yes) / total) : null, total };
      });
      return { key, label: labels[key] ?? key, n: sessionIds.size, perQ };
    });
  }

  const byAge = breakdown(
    (s) => ageBucket(s.birth_year),
    { "18–24": "18–24", "25–34": "25–34", "35–44": "35–44", "45–54": "45–54", "55–64": "55–64", "65+": "65+", "Unknown": "Unknown" },
  );
  const byGender = breakdown(
    (s) => s.gender,
    Object.fromEntries(GENDERS.map((g) => [g.value, g.label])),
  );
  const byEducation = breakdown(
    (s) => s.education,
    Object.fromEntries(EDUCATION_LEVELS.map((e) => [e.value, e.label])),
  );
  const byCountry = breakdown((s) => s.country_code, {});

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Results</div>
          <h1 className="text-2xl font-bold">{survey.title}</h1>
        </div>
        <Link
          href={`/surveys/${survey.id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to survey
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Started" value={totalSessions} />
        <Stat label="Completed" value={completed} />
        <Stat
          label="Completion rate"
          value={totalSessions ? `${Math.round((100 * completed) / totalSessions)}%` : "—"}
        />
      </div>

      <section>
        <h2 className="font-semibold mb-3">Per question</h2>
        <ul className="space-y-3">
          {perQuestion.map((q) => (
            <li key={q.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500 mb-1">Q{q.position}</div>
              <div className="font-medium mb-3">{q.text}</div>
              {q.total === 0 ? (
                <div className="text-sm text-gray-500">No answers yet</div>
              ) : (
                <YesNoBar yes={q.yes} no={q.no} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <BreakdownSection title="By age" groups={byAge} questions={questions ?? []} />
      <BreakdownSection title="By gender" groups={byGender} questions={questions ?? []} />
      <BreakdownSection title="By education" groups={byEducation} questions={questions ?? []} />
      <BreakdownSection title="By country" groups={byCountry} questions={questions ?? []} />

      <section className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-600">
        <div className="font-medium text-gray-800">CSV export</div>
        <p>Row-level CSV export with demographics is available on the paid tier (coming soon).</p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function YesNoBar({ yes, no }: { yes: number; no: number }) {
  const total = yes + no;
  const yesPct = total ? (100 * yes) / total : 0;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
        <div className="bg-yes" style={{ width: `${yesPct}%` }} />
        <div className="bg-no" style={{ width: `${100 - yesPct}%` }} />
      </div>
      <div className="flex justify-between text-xs mt-1 text-gray-600">
        <span>Yes · {yes} ({Math.round(yesPct)}%)</span>
        <span>No · {no} ({Math.round(100 - yesPct)}%)</span>
      </div>
    </div>
  );
}

function BreakdownSection({
  title,
  groups,
  questions,
}: {
  title: string;
  groups: { key: string; label: string; n: number; perQ: { qid: string; yesPct: number | null }[] }[];
  questions: { id: string; position: number; text: string }[];
}) {
  if (groups.length === 0) return null;
  return (
    <section>
      <h2 className="font-semibold mb-3">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left p-3">Group</th>
              <th className="text-right p-3">N</th>
              {questions.map((q) => (
                <th key={q.id} className="text-right p-3">Q{q.position}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} className="border-t border-gray-100">
                <td className="p-3">{g.label}</td>
                <td className="p-3 text-right text-gray-500">{g.n}</td>
                {questions.map((q) => {
                  const cell = g.perQ.find((p) => p.qid === q.id);
                  return (
                    <td key={q.id} className="p-3 text-right">
                      {cell?.yesPct == null ? "—" : `${cell.yesPct}%`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-1">Cells show % Yes per group.</p>
    </section>
  );
}
