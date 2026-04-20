"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
  type MotionValue,
} from "framer-motion";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Answer, Question } from "@/lib/types";

type Props = {
  slug: string;
  sessionId: string;
  questions: Question[];
  initialAnswers: { question_id: string; answer: Answer }[];
};

type Step = { questionId: string; answer: Answer };

export function SwipeDeck({ slug, sessionId, questions, initialAnswers }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const byPosition = useMemo(() => {
    const m = new Map<number, Question>();
    questions.forEach((q) => m.set(q.position, q));
    return m;
  }, [questions]);
  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.position - b.position),
    [questions],
  );

  const [history, setHistory] = useState<Step[]>(
    initialAnswers
      .map((a) => ({ questionId: a.question_id, answer: a.answer }))
      .filter((s) => byId.has(s.questionId)),
  );
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-18, 0, 18]);

  function resolveNext(q: Question, answer: Answer): Question | null {
    if (answer === "yes") {
      if (q.end_on_yes) return null;
      if (q.next_on_yes) return byId.get(q.next_on_yes) ?? null;
    } else {
      if (q.end_on_no) return null;
      if (q.next_on_no) return byId.get(q.next_on_no) ?? null;
    }
    return byPosition.get(q.position + 1) ?? null;
  }

  const currentQuestion: Question | null = useMemo(() => {
    if (done) return null;
    if (history.length === 0) return sortedQuestions[0] ?? null;
    const last = history[history.length - 1];
    const lastQ = byId.get(last.questionId);
    if (!lastQ) return null;
    return resolveNext(lastQ, last.answer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, done, byId, byPosition, sortedQuestions]);

  useEffect(() => {
    if (!done && history.length > 0 && currentQuestion === null) {
      complete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, history, done]);

  async function complete() {
    setDone(true);
    setBusy(true);
    await supabase
      .from("survey_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", sessionId);
    setBusy(false);
    router.replace(`/s/${slug}/done`);
  }

  async function answer(a: Answer) {
    if (busy || !currentQuestion) return;
    setBusy(true);
    const q = currentQuestion;

    // Fling the card off in the direction of the answer, so the user sees
    // their answer register before the next card replaces it.
    const flyTo = a === "yes" ? 600 : -600;
    await animate(x, flyTo, {
      duration: 0.28,
      ease: [0.32, 0.72, 0, 1],
    });

    const { error } = await supabase.from("answers").upsert(
      { session_id: sessionId, question_id: q.id, answer: a },
      { onConflict: "session_id,question_id" },
    );
    if (error) {
      alert(error.message);
      x.set(0);
      setBusy(false);
      return;
    }

    setHistory((h) => [...h, { questionId: q.id, answer: a }]);
    // Reset position for the incoming card (which remounts via key below).
    x.set(0);
    setBusy(false);
  }

  async function undo() {
    if (history.length === 0 || busy) return;
    const last = history[history.length - 1];
    setBusy(true);
    const { error } = await supabase
      .from("answers")
      .delete()
      .eq("session_id", sessionId)
      .eq("question_id", last.questionId);
    if (error) {
      alert(error.message);
      setBusy(false);
      return;
    }
    x.set(0);
    setHistory((h) => h.slice(0, -1));
    setBusy(false);
  }

  async function stopHere() {
    if (!confirm("Stop here? You won't be able to continue this survey later.")) return;
    await complete();
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    const threshold = 110;
    if (info.offset.x > threshold) answer("yes");
    else if (info.offset.x < -threshold) answer("no");
    else animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
  }

  if (done || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Wrapping up…</div>
      </div>
    );
  }

  const previewQ = resolveNext(currentQuestion, "yes") ?? byPosition.get(currentQuestion.position + 1);
  const answered = history.length;
  const total = questions.length;

  return (
    <div className="min-h-screen flex flex-col px-4 pt-4 pb-6">
      <div className="flex items-center justify-between text-sm mb-2">
        <button
          onClick={undo}
          disabled={history.length === 0 || busy}
          className="text-gray-500 disabled:opacity-40"
        >
          ← Undo
        </button>
        <div className="text-gray-500">
          {answered} / {total}
        </div>
        <button onClick={stopHere} className="text-gray-500" disabled={busy}>
          Stop
        </button>
      </div>

      <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-brand-500 transition-all"
          style={{ width: `${(answered / Math.max(total, 1)) * 100}%` }}
        />
      </div>

      <div className="relative flex-1 flex items-center justify-center min-h-[280px]">
        {previewQ && (
          <PreviewCard key={previewQ.id + "-bg"} question={previewQ} />
        )}
        <SwipeCard
          key={currentQuestion.id}
          question={currentQuestion}
          x={x}
          rotate={rotate}
          onDragEnd={onDragEnd}
          disabled={busy}
        />
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => answer("no")}
          disabled={busy}
          className="flex-1 py-4 rounded-2xl bg-red-50 border-2 border-red-200 text-red-700 font-bold text-lg hover:bg-red-100 active:scale-95 transition disabled:opacity-50"
        >
          ✕ No
        </button>
        <button
          onClick={() => answer("yes")}
          disabled={busy}
          className="flex-1 py-4 rounded-2xl bg-emerald-600 border-2 border-emerald-700 text-white font-bold text-lg hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50"
        >
          ✓ Yes
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 mt-3">
        Swipe the card, or tap Yes / No.
      </p>
    </div>
  );
}

function PreviewCard({ question }: { question: Question }) {
  return (
    <div
      className="absolute inset-x-6 top-0 bottom-0 rounded-3xl bg-white shadow-md border border-gray-200 flex items-center justify-center p-6 pointer-events-none"
      style={{
        transform: "scale(0.96) translateY(8px)",
        zIndex: 10,
        opacity: 0.7,
      }}
    >
      <p className="text-xl text-center font-medium text-gray-400">{question.text}</p>
    </div>
  );
}

function SwipeCard({
  question,
  x,
  rotate,
  onDragEnd,
  disabled,
}: {
  question: Question;
  x: MotionValue<number>;
  rotate: MotionValue<number>;
  onDragEnd: (e: unknown, info: PanInfo) => void;
  disabled?: boolean;
}) {
  const yesOpacity = useTransform(x, [20, 120], [0, 1]);
  const noOpacity = useTransform(x, [-120, -20], [1, 0]);

  return (
    <motion.div
      className="absolute inset-x-6 top-0 bottom-0 rounded-3xl bg-white shadow-xl border border-gray-200 flex items-center justify-center p-8 cursor-grab active:cursor-grabbing"
      style={{ x, rotate, zIndex: 20, touchAction: "pan-y" }}
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      whileTap={{ cursor: "grabbing" }}
    >
      <motion.div
        style={{ opacity: yesOpacity }}
        className="absolute top-6 left-6 rotate-[-12deg] border-4 border-emerald-500 text-emerald-500 font-extrabold text-2xl px-3 py-1 rounded-lg"
      >
        YES
      </motion.div>
      <motion.div
        style={{ opacity: noOpacity }}
        className="absolute top-6 right-6 rotate-[12deg] border-4 border-red-500 text-red-500 font-extrabold text-2xl px-3 py-1 rounded-lg"
      >
        NO
      </motion.div>
      <p className="text-2xl text-center font-medium">{question.text}</p>
    </motion.div>
  );
}
