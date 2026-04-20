"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Question, Survey, VerificationField } from "@/lib/types";
import { VERIFICATION_FIELDS, MAX_QUESTIONS_PER_SURVEY } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";

type Props = { initialSurvey: Survey; initialQuestions: Question[] };

export function SurveyEditor({ initialSurvey, initialQuestions }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [survey, setSurvey] = useState(initialSurvey);
  const [questions, setQuestions] = useState<Question[]>(
    [...initialQuestions].sort((a, b) => a.position - b.position),
  );
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const locked = survey.status !== "draft";

  async function patchSurvey(patch: Partial<Survey>) {
    setSaving(true);
    const { data, error } = await supabase
      .from("surveys")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", survey.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) return alert(error.message);
    if (data) setSurvey(data as Survey);
  }

  async function addQuestion() {
    if (questions.length >= MAX_QUESTIONS_PER_SURVEY) return;
    const position = questions.length + 1;
    const { data, error } = await supabase
      .from("questions")
      .insert({ survey_id: survey.id, position, text: "New question" })
      .select("*")
      .single();
    if (error) return alert(error.message);
    setQuestions((qs) => [...qs, data as Question]);
  }

  async function updateQuestion(id: string, patch: Partial<Question>) {
    const { error } = await supabase.from("questions").update(patch).eq("id", id);
    if (error) return alert(error.message);
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) return alert(error.message);
    const remaining = questions.filter((q) => q.id !== id);
    const renumbered = remaining.map((q, i) => ({ ...q, position: i + 1 }));
    setQuestions(renumbered);
    for (const q of renumbered) {
      await supabase.from("questions").update({ position: q.position }).eq("id", q.id);
    }
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = questions.findIndex((q) => q.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= questions.length) return;
    const a = questions[idx];
    const b = questions[swap];
    const next = [...questions];
    next[idx] = { ...b, position: a.position };
    next[swap] = { ...a, position: b.position };
    setQuestions(next);
    // Use temp positions to avoid unique constraint collision
    await supabase.from("questions").update({ position: 99 }).eq("id", a.id);
    await supabase.from("questions").update({ position: a.position }).eq("id", b.id);
    await supabase.from("questions").update({ position: b.position }).eq("id", a.id);
  }

  async function publish() {
    if (questions.length === 0) {
      alert("Add at least one question before publishing.");
      return;
    }
    await patchSurvey({ status: "open", opened_at: new Date().toISOString() });
  }
  async function close() {
    await patchSurvey({ status: "closed", closed_at: new Date().toISOString() });
  }

  function toggleVerification(key: VerificationField) {
    const on = survey.verification_fields.includes(key);
    const next = on
      ? survey.verification_fields.filter((k) => k !== key)
      : [...survey.verification_fields, key];
    patchSurvey({ verification_fields: next });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">
              {survey.status}
            </div>
            <h1 className="text-2xl font-bold">{survey.title}</h1>
          </div>
          <div className="flex gap-2">
            {survey.status === "draft" && (
              <Button onClick={publish} disabled={saving}>
                Publish
              </Button>
            )}
            {survey.status === "open" && (
              <>
                <Link href={`/surveys/${survey.id}/share`}>
                  <Button variant="secondary">Share</Button>
                </Link>
                <Button variant="ghost" onClick={close}>Close</Button>
              </>
            )}
            <Link href={`/surveys/${survey.id}/results`}>
              <Button variant="secondary">Results</Button>
            </Link>
          </div>
        </div>

        <fieldset disabled={locked} className="space-y-3 disabled:opacity-70">
          <Field label="Title">
            <Input
              defaultValue={survey.title}
              onBlur={(e) => patchSurvey({ title: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="Description">
            <Textarea
              defaultValue={survey.description ?? ""}
              onBlur={(e) => patchSurvey({ description: e.target.value || null })}
              rows={3}
              maxLength={600}
            />
          </Field>
          <Field label="Visibility">
            <Select
              value={survey.visibility}
              onChange={(e) =>
                patchSurvey({ visibility: e.target.value as Survey["visibility"] })
              }
            >
              <option value="link_only">Link-only (share a URL or QR)</option>
              <option value="public">Public (listed in the feed)</option>
            </Select>
          </Field>
        </fieldset>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
        <h2 className="font-semibold">Questions ({questions.length} / {MAX_QUESTIONS_PER_SURVEY})</h2>

        <ol className="space-y-3">
          {questions.map((q, i) => {
            const laterPositions = questions
              .filter((o) => o.position > q.position)
              .map((o) => ({ id: o.id, position: o.position, text: o.text }));
            return (
              <li
                key={q.id}
                className="rounded-xl border border-gray-200 p-3 bg-gray-50"
              >
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => move(q.id, -1)}
                      disabled={locked || i === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <span className="text-xs font-mono text-gray-500 text-center">
                      Q{q.position}
                    </span>
                    <button
                      type="button"
                      onClick={() => move(q.id, 1)}
                      disabled={locked || i === questions.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1 space-y-3">
                    <Textarea
                      defaultValue={q.text}
                      onBlur={(e) => updateQuestion(q.id, { text: e.target.value })}
                      rows={2}
                      maxLength={280}
                      disabled={locked}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <BranchControl
                        label="If Yes →"
                        value={
                          q.end_on_yes
                            ? "__end"
                            : q.next_on_yes ?? "__next"
                        }
                        laterPositions={laterPositions}
                        disabled={locked}
                        onChange={(val) => {
                          if (val === "__end") {
                            updateQuestion(q.id, {
                              end_on_yes: true,
                              next_on_yes: null,
                            });
                          } else if (val === "__next") {
                            updateQuestion(q.id, {
                              end_on_yes: false,
                              next_on_yes: null,
                            });
                          } else {
                            updateQuestion(q.id, {
                              end_on_yes: false,
                              next_on_yes: val,
                            });
                          }
                        }}
                      />
                      <BranchControl
                        label="If No →"
                        value={
                          q.end_on_no
                            ? "__end"
                            : q.next_on_no ?? "__next"
                        }
                        laterPositions={laterPositions}
                        disabled={locked}
                        onChange={(val) => {
                          if (val === "__end") {
                            updateQuestion(q.id, {
                              end_on_no: true,
                              next_on_no: null,
                            });
                          } else if (val === "__next") {
                            updateQuestion(q.id, {
                              end_on_no: false,
                              next_on_no: null,
                            });
                          } else {
                            updateQuestion(q.id, {
                              end_on_no: false,
                              next_on_no: val,
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteQuestion(q.id)}
                    disabled={locked}
                    className="text-red-500 hover:text-red-700 text-sm disabled:opacity-30"
                    aria-label="Delete question"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        {!locked && questions.length < MAX_QUESTIONS_PER_SURVEY && (
          <Button variant="secondary" onClick={addQuestion}>
            + Add question
          </Button>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
        <h2 className="font-semibold">Payout mode</h2>
        <fieldset disabled={locked} className="space-y-2 disabled:opacity-70">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="payout"
              checked={survey.payout_mode === "per_question"}
              onChange={() => patchSurvey({ payout_mode: "per_question" })}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Pay per question answered</div>
              <div className="text-xs text-gray-500">
                Respondents are paid for each question they swipe. Partial completion allowed.
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="payout"
              checked={survey.payout_mode === "on_complete"}
              onChange={() => patchSurvey({ payout_mode: "on_complete" })}
              className="mt-1"
            />
            <div>
              <div className="font-medium">
                Pay only on full completion (+
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={survey.complete_premium_pct}
                  onChange={(e) =>
                    setSurvey({ ...survey, complete_premium_pct: +e.target.value })
                  }
                  onBlur={(e) =>
                    patchSurvey({ complete_premium_pct: +e.target.value })
                  }
                  className="w-14 mx-1 px-2 py-0.5 border rounded text-center"
                />
                % premium per question)
              </div>
              <div className="text-xs text-gray-500">
                Respondents must answer all required questions to be paid. Premium makes it more lucrative.
              </div>
            </div>
          </label>
        </fieldset>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold">Pre-survey verification</h2>
        <p className="text-xs text-gray-500">
          Respondents will be asked to confirm these profile fields are still accurate before starting. No extra fee.
        </p>
        <fieldset disabled={locked} className="flex flex-wrap gap-2 disabled:opacity-70">
          {VERIFICATION_FIELDS.map((f) => {
            const on = survey.verification_fields.includes(f.key as VerificationField);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleVerification(f.key as VerificationField)}
                className={
                  "px-3 py-1.5 rounded-full text-sm border " +
                  (on
                    ? "bg-brand-50 border-brand-500 text-brand-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")
                }
              >
                {f.label}
              </button>
            );
          })}
        </fieldset>
      </section>

      {locked && (
        <p className="text-xs text-gray-500">
          This survey is {survey.status}; editing is disabled to protect response integrity.
        </p>
      )}
    </div>
  );
}

function BranchControl({
  label,
  value,
  laterPositions,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  laterPositions: { id: string; position: number; text: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="text-sm">
      <span className="block mb-1 text-gray-600">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="__next">Next question</option>
        <option value="__end">End survey</option>
        {laterPositions.map((p) => (
          <option key={p.id} value={p.id}>
            Skip to Q{p.position}: {p.text.slice(0, 40)}
          </option>
        ))}
      </Select>
    </label>
  );
}
