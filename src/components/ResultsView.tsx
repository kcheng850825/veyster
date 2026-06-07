"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Answer, Question, SurveyVersion } from "@/lib/types";
import { EDUCATION_LEVELS, GENDERS } from "@/lib/constants";

type Snapshot = {
  birth_year?: number | null;
  gender?: string | null;
  education?: string | null;
  country_code?: string | null;
};

type SessionRow = {
  id: string;
  version_id: string;
  profile_snapshot: Record<string, unknown>;
  completed_at: string | null;
};

type AnswerRow = { session_id: string; question_id: string; answer: Answer };

type Props = {
  surveyId: string;
  surveyTitle: string;
  versions: SurveyVersion[];
  questions: Question[];
  sessions: SessionRow[];
  answers: AnswerRow[];
};

export function ResultsView({
  surveyId,
  surveyTitle,
  versions,
  questions: initialQuestions,
  sessions,
  answers,
}: Props) {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [questions, setQuestions] = useState(initialQuestions);
  const [linkingForQid, setLinkingForQid] = useState<string | null>(null);

  // Default tab: "Combined" when there are 2+ versions, otherwise the one version.
  const hasMultiple = versions.length > 1;
  const [activeTab, setActiveTab] = useState<string>(
    hasMultiple ? "combined" : versions[0]?.id ?? "combined",
  );

  // Index structures
  const questionsByVersion = useMemo(() => {
    const m = new Map<string, Question[]>();
    for (const v of versions) m.set(v.id, []);
    for (const q of questions) {
      const list = m.get(q.version_id) ?? [];
      list.push(q);
      m.set(q.version_id, list);
    }
    m.forEach((list) => list.sort((a, b) => a.position - b.position));
    return m;
  }, [versions, questions]);

  const sessionsByVersion = useMemo(() => {
    const m = new Map<string, SessionRow[]>();
    for (const v of versions) m.set(v.id, []);
    for (const s of sessions) {
      const list = m.get(s.version_id) ?? [];
      list.push(s);
      m.set(s.version_id, list);
    }
    return m;
  }, [versions, sessions]);

  const answersByQuestion = useMemo(() => {
    const m = new Map<string, AnswerRow[]>();
    for (const a of answers) {
      const list = m.get(a.question_id) ?? [];
      list.push(a);
      m.set(a.question_id, list);
    }
    return m;
  }, [answers]);

  const versionCount = (vid: string) => sessionsByVersion.get(vid)?.length ?? 0;

  async function linkQuestions(sourceQid: string, targetQid: string) {
    const target = questions.find((q) => q.id === targetQid);
    if (!target) return;
    // Merge: set the source's group_id to the target's.
    const newGroup = target.question_group_id;
    const affected = questions.find((q) => q.id === sourceQid);
    if (!affected) return;
    const { error } = await supabase
      .from("questions")
      .update({ question_group_id: newGroup })
      .eq("question_group_id", affected.question_group_id);
    if (error) {
      alert(error.message);
      return;
    }
    setQuestions((qs) =>
      qs.map((q) =>
        q.question_group_id === affected.question_group_id
          ? { ...q, question_group_id: newGroup }
          : q,
      ),
    );
    setLinkingForQid(null);
  }

  async function unlinkQuestion(qid: string) {
    const fresh = crypto.randomUUID();
    const { error } = await supabase
      .from("questions")
      .update({ question_group_id: fresh })
      .eq("id", qid);
    if (error) return alert(error.message);
    setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, question_group_id: fresh } : q)));
  }

  // Build the tabs
  const tabs: { key: string; label: string; count: number }[] = [];
  if (hasMultiple) {
    tabs.push({ key: "combined", label: "Combined", count: sessions.length });
  }
  for (const v of versions) {
    tabs.push({
      key: v.id,
      label: `v${v.version_number}`,
      count: versionCount(v.id),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-ink-500">Results</div>
          <h1 className="text-2xl font-bold">{surveyTitle}</h1>
        </div>
        <Link
          href={`/surveys/${surveyId}`}
          className="text-sm text-ink-500 hover:text-ink-700"
        >
          ← Back to survey
        </Link>
      </div>

      {versions.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-300 p-6 text-center text-ink-500">
          No versions yet.
        </div>
      )}

      {versions.length > 0 && (
        <div className="flex gap-1 border-b border-ink-200 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={
                "px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap " +
                (activeTab === t.key
                  ? "border-brand-500 text-brand-700"
                  : "border-transparent text-ink-500 hover:text-ink-700")
              }
            >
              {t.label}
              <span className="ml-2 text-xs text-ink-400">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {activeTab === "combined" ? (
        <CombinedView
          questions={questions}
          versions={versions}
          sessions={sessions}
          answers={answers}
        />
      ) : (
        <VersionView
          version={versions.find((v) => v.id === activeTab)!}
          questions={questionsByVersion.get(activeTab) ?? []}
          sessions={sessionsByVersion.get(activeTab) ?? []}
          answersByQuestion={answersByQuestion}
          otherVersions={versions.filter((v) => v.id !== activeTab)}
          questionsByVersion={questionsByVersion}
          linkingForQid={linkingForQid}
          setLinkingForQid={setLinkingForQid}
          linkQuestions={linkQuestions}
          unlinkQuestion={unlinkQuestion}
          allQuestions={questions}
        />
      )}

      <section className="rounded-2xl border border-dashed border-ink-300 p-4 text-sm text-ink-600">
        <div className="font-medium text-ink-800">CSV export</div>
        <p>Row-level CSV export with demographics is available on the paid tier (coming soon).</p>
      </section>
    </div>
  );
}

// ---------- Per-version view ----------

function VersionView({
  version,
  questions,
  sessions,
  answersByQuestion,
  otherVersions,
  questionsByVersion,
  linkingForQid,
  setLinkingForQid,
  linkQuestions,
  unlinkQuestion,
  allQuestions,
}: {
  version: SurveyVersion;
  questions: Question[];
  sessions: SessionRow[];
  answersByQuestion: Map<string, AnswerRow[]>;
  otherVersions: SurveyVersion[];
  questionsByVersion: Map<string, Question[]>;
  linkingForQid: string | null;
  setLinkingForQid: (qid: string | null) => void;
  linkQuestions: (a: string, b: string) => void | Promise<void>;
  unlinkQuestion: (qid: string) => void | Promise<void>;
  allQuestions: Question[];
}) {
  const completed = sessions.filter((s) => s.completed_at).length;

  function linkedElsewhere(q: Question): { version: SurveyVersion; q: Question }[] {
    const out: { version: SurveyVersion; q: Question }[] = [];
    for (const v of otherVersions) {
      const peer = (questionsByVersion.get(v.id) ?? []).find(
        (x) => x.question_group_id === q.question_group_id,
      );
      if (peer) out.push({ version: v, q: peer });
    }
    return out;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Started" value={sessions.length} />
        <Stat label="Completed" value={completed} />
        <Stat
          label="Completion rate"
          value={sessions.length ? `${Math.round((100 * completed) / sessions.length)}%` : "—"}
        />
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">v{version.version_number} per question</h2>
          <span className="text-xs text-ink-500">{version.status}</span>
        </div>
        {questions.length === 0 ? (
          <p className="text-sm text-ink-500">No questions in this version.</p>
        ) : (
          <ul className="space-y-3">
            {questions.map((q) => {
              const rows = answersByQuestion.get(q.id) ?? [];
              const yes = rows.filter((r) => r.answer === "yes").length;
              const no = rows.filter((r) => r.answer === "no").length;
              const linked = linkedElsewhere(q);
              return (
                <li key={q.id} className="rounded-xl border border-ink-200 bg-white p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="text-xs text-ink-500 mb-1">Q{q.position}</div>
                      <div className="font-medium">{q.text}</div>
                      {linked.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1 text-xs">
                          <span className="text-ink-500">Linked:</span>
                          {linked.map((l) => (
                            <span
                              key={l.q.id}
                              className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700"
                            >
                              v{l.version.version_number} · Q{l.q.position}
                            </span>
                          ))}
                          <button
                            onClick={() => unlinkQuestion(q.id)}
                            className="text-ink-400 hover:text-ink-600 ml-1"
                            title="Unlink this question from the group"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                    {otherVersions.length > 0 && (
                      <button
                        onClick={() =>
                          setLinkingForQid(linkingForQid === q.id ? null : q.id)
                        }
                        className="text-xs text-brand-600 hover:text-brand-700 whitespace-nowrap"
                      >
                        {linkingForQid === q.id ? "Cancel" : "Link ↔"}
                      </button>
                    )}
                  </div>
                  {linkingForQid === q.id && (
                    <LinkPicker
                      otherVersions={otherVersions}
                      questionsByVersion={questionsByVersion}
                      sourceQ={q}
                      onPick={(targetQid) => linkQuestions(q.id, targetQid)}
                    />
                  )}
                  <div className="mt-3">
                    {yes + no === 0 ? (
                      <div className="text-sm text-ink-500">No answers yet</div>
                    ) : (
                      <YesNoBar yes={yes} no={no} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <BreakdownsSection
        questions={questions}
        sessions={sessions}
        answersByQuestion={answersByQuestion}
      />
    </div>
  );
}

function LinkPicker({
  otherVersions,
  questionsByVersion,
  sourceQ,
  onPick,
}: {
  otherVersions: SurveyVersion[];
  questionsByVersion: Map<string, Question[]>;
  sourceQ: Question;
  onPick: (qid: string) => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50 p-3 space-y-2">
      <div className="text-xs text-ink-500">
        Mark one of these as equivalent to &quot;{sourceQ.text.slice(0, 60)}&quot;:
      </div>
      {otherVersions.map((v) => {
        const qs = (questionsByVersion.get(v.id) ?? []).filter(
          (q) => q.question_group_id !== sourceQ.question_group_id,
        );
        if (qs.length === 0) return null;
        return (
          <div key={v.id}>
            <div className="text-xs font-medium text-ink-600 mb-1">
              v{v.version_number}
            </div>
            <ul className="space-y-1">
              {qs.map((q) => (
                <li key={q.id}>
                  <button
                    onClick={() => onPick(q.id)}
                    className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-white border border-transparent hover:border-ink-200"
                  >
                    <span className="text-ink-400 mr-2">Q{q.position}</span>
                    {q.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Combined view ----------

function CombinedView({
  questions,
  versions,
  sessions,
  answers,
}: {
  questions: Question[];
  versions: SurveyVersion[];
  sessions: SessionRow[];
  answers: AnswerRow[];
}) {
  const completed = sessions.filter((s) => s.completed_at).length;

  // Group questions by question_group_id
  const groups = useMemo(() => {
    const byGroup = new Map<string, Question[]>();
    for (const q of questions) {
      const list = byGroup.get(q.question_group_id) ?? [];
      list.push(q);
      byGroup.set(q.question_group_id, list);
    }
    // For each group, find answers across all its question_ids
    return Array.from(byGroup.values()).map((qs) => {
      const qids = new Set(qs.map((q) => q.id));
      const rows = answers.filter((a) => qids.has(a.question_id));
      const yes = rows.filter((a) => a.answer === "yes").length;
      const no = rows.filter((a) => a.answer === "no").length;
      // Representative text = earliest version's question text
      const byVer = new Map(versions.map((v) => [v.id, v.version_number]));
      const sorted = [...qs].sort(
        (a, b) => (byVer.get(a.version_id) ?? 0) - (byVer.get(b.version_id) ?? 0),
      );
      return {
        groupId: qs[0].question_group_id,
        representativeText: sorted[0].text,
        versions: sorted.map((q) => ({
          version_number: byVer.get(q.version_id) ?? 0,
          position: q.position,
          text: q.text,
        })),
        yes,
        no,
      };
    });
  }, [questions, answers, versions]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total started" value={sessions.length} />
        <Stat label="Total completed" value={completed} />
        <Stat
          label="Completion rate"
          value={sessions.length ? `${Math.round((100 * completed) / sessions.length)}%` : "—"}
        />
      </div>

      <section>
        <h2 className="font-semibold mb-3">Combined across versions</h2>
        <p className="text-xs text-ink-500 mb-3">
          Questions are merged by the &quot;link&quot; groups you set up on each version tab.
          Unlinked questions stay in their own row.
        </p>
        {groups.length === 0 ? (
          <p className="text-sm text-ink-500">No questions yet.</p>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.groupId} className="rounded-xl border border-ink-200 bg-white p-4">
                <div className="font-medium">{g.representativeText}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs text-ink-500">
                  {g.versions.map((v, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-ink-100">
                      v{v.version_number} · Q{v.position}
                    </span>
                  ))}
                </div>
                <div className="mt-3">
                  {g.yes + g.no === 0 ? (
                    <div className="text-sm text-ink-500">No answers yet</div>
                  ) : (
                    <YesNoBar yes={g.yes} no={g.no} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- Breakdowns (used in VersionView) ----------

function BreakdownsSection({
  questions,
  sessions,
  answersByQuestion,
}: {
  questions: Question[];
  sessions: SessionRow[];
  answersByQuestion: Map<string, AnswerRow[]>;
}) {
  if (sessions.length === 0 || questions.length === 0) return null;

  const nowYear = new Date().getUTCFullYear();
  const ageBucket = (by: number | null | undefined) => {
    if (!by) return "Unknown";
    const age = nowYear - by;
    if (age < 25) return "18–24";
    if (age < 35) return "25–34";
    if (age < 45) return "35–44";
    if (age < 55) return "45–54";
    if (age < 65) return "55–64";
    return "65+";
  };

  function breakdown(
    group: (snap: Snapshot) => string | null | undefined,
    labels: Record<string, string>,
  ) {
    const keys = Array.from(
      new Set(
        sessions
          .map((s) => group(s.profile_snapshot as Snapshot))
          .filter((k): k is string => !!k),
      ),
    );
    return keys.map((key) => {
      const sids = new Set(
        sessions
          .filter((s) => group(s.profile_snapshot as Snapshot) === key)
          .map((s) => s.id),
      );
      const perQ = questions.map((q) => {
        const rows = (answersByQuestion.get(q.id) ?? []).filter((a) =>
          sids.has(a.session_id),
        );
        const yes = rows.filter((a) => a.answer === "yes").length;
        const total = rows.length;
        return {
          qid: q.id,
          yesPct: total ? Math.round((100 * yes) / total) : null,
        };
      });
      return { key, label: labels[key] ?? key, n: sids.size, perQ };
    });
  }

  const byAge = breakdown((s) => ageBucket(s.birth_year), {
    "18–24": "18–24", "25–34": "25–34", "35–44": "35–44",
    "45–54": "45–54", "55–64": "55–64", "65+": "65+", Unknown: "Unknown",
  });
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
    <div className="space-y-6">
      <BreakdownTable title="By age" groups={byAge} questions={questions} />
      <BreakdownTable title="By gender" groups={byGender} questions={questions} />
      <BreakdownTable title="By education" groups={byEducation} questions={questions} />
      <BreakdownTable title="By country" groups={byCountry} questions={questions} />
    </div>
  );
}

function BreakdownTable({
  title,
  groups,
  questions,
}: {
  title: string;
  groups: { key: string; label: string; n: number; perQ: { qid: string; yesPct: number | null }[] }[];
  questions: Question[];
}) {
  if (groups.length === 0) return null;
  return (
    <section>
      <h2 className="font-semibold mb-3">{title}</h2>
      <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-xs text-ink-500">
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
              <tr key={g.key} className="border-t border-ink-100">
                <td className="p-3">{g.label}</td>
                <td className="p-3 text-right text-ink-500">{g.n}</td>
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
      <p className="text-xs text-ink-500 mt-1">Cells show % Yes per group.</p>
    </section>
  );
}

// ---------- small helpers ----------

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function YesNoBar({ yes, no }: { yes: number; no: number }) {
  const total = yes + no;
  const yesPct = total ? (100 * yes) / total : 0;
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-ink-100">
        <div className="bg-yes" style={{ width: `${yesPct}%` }} />
        <div className="bg-no" style={{ width: `${100 - yesPct}%` }} />
      </div>
      <div className="flex justify-between text-xs mt-1 text-ink-600">
        <span>Yes · {yes} ({Math.round(yesPct)}%)</span>
        <span>No · {no} ({Math.round(100 - yesPct)}%)</span>
      </div>
    </div>
  );
}

