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

  // Show the question that would come next on a "yes" answer as the preview
  // card. resolveNext already honors branching + ends — if it returns null,
  // there's no next card to preview (last question or end-on-yes).
  const previewQ = resolveNext(currentQuestion, "yes");
  const answered = history.length;
  const total = questions.length;

  return (
    <div className="min-h-screen flex flex-col px-4 pt-5 pb-6 max-w-md mx-auto">
      <div className="flex items-center justify-between text-sm mb-3">
        <button
          onClick={undo}
          disabled={history.length === 0 || busy}
          className="text-ink-500 hover:text-ink-700 disabled:opacity-40 font-medium"
        >
          ← Undo
        </button>
        <div className="chip chip-muted font-mono">
          {answered} / {total}
        </div>
        <button
          onClick={stopHere}
          className="text-ink-500 hover:text-ink-700 font-medium"
          disabled={busy}
        >
          Stop
        </button>
      </div>

      <div className="h-1.5 w-full bg-ink-100 rounded-full overflow-hidden mb-8">
        <div
          className="h-full bg-brand-gradient transition-all"
          style={{ width: `${(answered / Math.max(total, 1)) * 100}%` }}
        />
      </div>

      <div className="relative flex-1 flex items-center justify-center min-h-[360px]">
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

      <div className="mt-8 flex gap-3">
        <button
          onClick={() => answer("no")}
          disabled={busy}
          className="flex-1 py-4 rounded-full bg-white border-2 border-no-200 text-no-700 font-bold text-lg hover:bg-no-50 active:scale-95 transition disabled:opacity-50 shadow-soft"
        >
          ✕ No
        </button>
        <button
          onClick={() => answer("yes")}
          disabled={busy}
          className="flex-1 py-4 rounded-full bg-yes-500 border-2 border-yes-600 text-white font-bold text-lg hover:bg-yes-600 active:scale-95 transition disabled:opacity-50 shadow-pop"
        >
          ✓ Yes
        </button>
      </div>
      <p className="text-center text-xs text-ink-400 mt-3">
        Swipe or tap — your pick.
      </p>
    </div>
  );
}

function PreviewCard({ question }: { question: Question }) {
  return (
    <div
      className="absolute inset-x-4 top-0 bottom-0 rounded-3xl bg-white shadow-soft border border-ink-100 flex items-center justify-center p-8 pointer-events-none"
      style={{
        transform: "scale(0.96) translateY(8px)",
        zIndex: 10,
        opacity: 0.65,
      }}
    >
      <p className="text-xl sm:text-2xl text-center text-ink-400 font-medium tracking-tight leading-snug">{question.text}</p>
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
      className="absolute inset-x-4 top-0 bottom-0 rounded-3xl bg-white shadow-pop border border-ink-100 flex items-center justify-center p-10 cursor-grab active:cursor-grabbing overflow-hidden"
      style={{ x, rotate, zIndex: 20, touchAction: "pan-y" }}
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      whileTap={{ cursor: "grabbing" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(122,102,251,0.06) 0%, rgba(255,159,109,0.04) 100%)",
        }}
      />
      <motion.div
        style={{ opacity: yesOpacity }}
        className="absolute top-8 left-8 rotate-[-12deg] border-4 border-yes-500 text-yes-600 font-extrabold text-2xl px-3 py-1 rounded-xl bg-yes-50"
      >
        YES
      </motion.div>
      <motion.div
        style={{ opacity: noOpacity }}
        className="absolute top-8 right-8 rotate-[12deg] border-4 border-no-500 text-no-600 font-extrabold text-2xl px-3 py-1 rounded-xl bg-no-50"
      >
        NO
      </motion.div>
      <p className="text-2xl sm:text-3xl leading-tight text-center text-ink-900 font-medium tracking-tight relative">
        {question.text}
      </p>
    </motion.div>
  );
}
