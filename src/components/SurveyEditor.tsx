"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type {
  ContactFieldConfig,
  ContactFieldKey,
  Question,
  Survey,
  SurveyVersion,
  VerificationField,
} from "@/lib/types";
import {
  VERIFICATION_FIELDS,
  CONTACT_FIELDS,
  MAX_QUESTIONS_PER_SURVEY,
} from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";

type Props = {
  initialSurvey: Survey;
  currentVersion: SurveyVersion;
  allVersions: SurveyVersion[];
  initialQuestions: Question[];
};

export function SurveyEditor({
  initialSurvey,
  currentVersion,
  allVersions,
  initialQuestions,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [survey, setSurvey] = useState(initialSurvey);
  const [version, setVersion] = useState(currentVersion);
  const [versions, setVersions] = useState(allVersions);
  const [questions, setQuestions] = useState<Question[]>(
    [...initialQuestions].sort((a, b) => a.position - b.position),
  );
  const [saving, setSaving] = useState(false);

  const editable = version.status === "draft";
  const latestVersion = versions[0];
  const canCreateNewVersion =
    !!latestVersion &&
    latestVersion.status !== "draft" &&
    version.id === latestVersion.id;

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
    if (!editable) return;
    if (questions.length >= MAX_QUESTIONS_PER_SURVEY) return;
    const position = questions.length + 1;
    const { data, error } = await supabase
      .from("questions")
      .insert({
        survey_id: survey.id,
        version_id: version.id,
        position,
        text: "New question",
      })
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
    // Use a position far above any user-facing limit so the temp value never
    // collides with a real question's unique (version_id, position) constraint.
    const TEMP_POS = 10_000;
    await supabase.from("questions").update({ position: TEMP_POS }).eq("id", a.id);
    await supabase.from("questions").update({ position: a.position }).eq("id", b.id);
    await supabase.from("questions").update({ position: b.position }).eq("id", a.id);
  }

  async function publishVersion() {
    if (questions.length === 0) {
      alert("Add at least one question before publishing.");
      return;
    }
    setSaving(true);
    const retiredAt = new Date().toISOString();
    // Retire any currently-open versions of this survey.
    const { error: retErr } = await supabase
      .from("survey_versions")
      .update({ status: "retired", retired_at: retiredAt })
      .eq("survey_id", survey.id)
      .eq("status", "open");
    if (retErr) {
      setSaving(false);
      return alert(retErr.message);
    }
    // Open this version.
    const openedAt = new Date().toISOString();
    const { data: opened, error } = await supabase
      .from("survey_versions")
      .update({ status: "open", opened_at: openedAt })
      .eq("id", version.id)
      .select("*")
      .maybeSingle();
    setSaving(false);
    if (error) return alert(error.message);
    if (!opened) return alert("Version not found — refresh and try again.");
    setVersion(opened as SurveyVersion);
    setVersions((vs) =>
      vs.map((v) => {
        if (v.id === opened.id) return opened as SurveyVersion;
        if (v.status === "open") return { ...v, status: "retired", retired_at: retiredAt };
        return v;
      }),
    );
    router.refresh();
  }

  async function retireVersion() {
    if (!confirm("Retire this version? New respondents won't be able to take it.")) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("survey_versions")
      .update({ status: "retired", retired_at: new Date().toISOString() })
      .eq("id", version.id)
      .select("*")
      .maybeSingle();
    setSaving(false);
    if (error) return alert(error.message);
    if (!data) return alert("Version not found — refresh and try again.");
    setVersion(data as SurveyVersion);
    setVersions((vs) => vs.map((v) => (v.id === data.id ? (data as SurveyVersion) : v)));
    router.refresh();
  }

  async function createNewVersion() {
    setSaving(true);
    const nextNumber = Math.max(...versions.map((x) => x.version_number)) + 1;
    const { data: newVersion, error } = await supabase
      .from("survey_versions")
      .insert({
        survey_id: survey.id,
        version_number: nextNumber,
        status: "draft",
      })
      .select("*")
      .single();
    if (error) {
      setSaving(false);
      return alert(error.message);
    }

    // Copy questions from the current latest version. Map old->new ids so we
    // can rewrite next_on_yes / next_on_no references.
    const sourceVersionId = latestVersion.id;
    const { data: sourceQs } = await supabase
      .from("questions")
      .select("*")
      .eq("version_id", sourceVersionId)
      .order("position")
      .returns<Question[]>();

    const idMap = new Map<string, string>();
    if (sourceQs && sourceQs.length > 0) {
      // First pass: insert without branching refs. Preserve question_group_id
      // so the new version's questions are linked to the originals for the
      // "Combined" results view.
      const firstPass = sourceQs.map((q) => ({
        survey_id: survey.id,
        version_id: newVersion!.id,
        position: q.position,
        text: q.text,
        end_on_yes: q.end_on_yes,
        end_on_no: q.end_on_no,
        question_group_id: q.question_group_id,
      }));
      const { data: inserted, error: insErr } = await supabase
        .from("questions")
        .insert(firstPass)
        .select("*")
        .returns<Question[]>();
      if (insErr) {
        setSaving(false);
        return alert(insErr.message);
      }
      // Match by position to build id map.
      const newByPos = new Map<number, string>();
      (inserted ?? []).forEach((q) => newByPos.set(q.position, q.id));
      sourceQs.forEach((q) => {
        const newId = newByPos.get(q.position);
        if (newId) idMap.set(q.id, newId);
      });

      // Second pass: rewrite branch targets, tracking any that couldn't be
      // mapped (target question doesn't exist in source). We fall back to
      // "next position" behaviour by leaving the field null, but warn the
      // user so they can fix it before publishing.
      const broken: string[] = [];
      for (const q of sourceQs) {
        const newId = idMap.get(q.id);
        if (!newId) continue;
        const patch: { next_on_yes?: string | null; next_on_no?: string | null } = {};
        if (q.next_on_yes) {
          const remapped = idMap.get(q.next_on_yes);
          if (remapped) patch.next_on_yes = remapped;
          else broken.push(`Q${q.position} → Yes target was missing`);
        }
        if (q.next_on_no) {
          const remapped = idMap.get(q.next_on_no);
          if (remapped) patch.next_on_no = remapped;
          else broken.push(`Q${q.position} → No target was missing`);
        }
        if (patch.next_on_yes || patch.next_on_no) {
          await supabase.from("questions").update(patch).eq("id", newId);
        }
      }
      if (broken.length > 0) {
        alert(
          "Some branch targets could not be carried over and were reset to default ('next question'):\n\n" +
            broken.join("\n") +
            "\n\nReview them before publishing v" + nextNumber + ".",
        );
      }
    }

    // Append the new version locally so the picker / latest-version logic
    // updates immediately, before router.refresh() resolves.
    setVersions((vs) => [newVersion as SurveyVersion, ...vs]);

    setSaving(false);
    router.replace(`/surveys/${survey.id}?v=${newVersion!.id}`);
    router.refresh();
  }

  function toggleVerification(key: VerificationField) {
    const on = survey.verification_fields.includes(key);
    const next = on
      ? survey.verification_fields.filter((k) => k !== key)
      : [...survey.verification_fields, key];
    patchSurvey({ verification_fields: next });
  }

  function setAccessMode(mode: Survey["access_mode"]) {
    // Friends & family surveys are link-only by nature.
    patchSurvey(
      mode === "open"
        ? { access_mode: mode, visibility: "link_only" }
        : { access_mode: mode },
    );
  }

  function updateContactField(
    key: ContactFieldKey,
    patch: Partial<ContactFieldConfig>,
  ) {
    const current = survey.contact_fields?.[key] ?? { show: false, required: false };
    const nextField = { ...current, ...patch };
    // A hidden field can't be required.
    if (nextField.show === false) nextField.required = false;
    patchSurvey({
      contact_fields: { ...survey.contact_fields, [key]: nextField },
    });
  }

  function switchVersion(id: string) {
    router.replace(`/surveys/${survey.id}?v=${id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-ink-500 truncate">
              {survey.title}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink-900">
                v{version.version_number}
              </h1>
              <StatusBadge status={version.status} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {versions.length > 1 && (
              <Select
                value={version.id}
                onChange={(e) => switchVersion(e.target.value)}
                className="!py-1.5 !w-auto"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_number} · {v.status}
                  </option>
                ))}
              </Select>
            )}
            {version.status === "draft" && (
              <Button onClick={publishVersion} disabled={saving} size="sm">
                Publish
              </Button>
            )}
            {version.status === "open" && (
              <>
                <Link href={`/surveys/${survey.id}/share`}>
                  <Button variant="secondary" size="sm">Share</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={retireVersion}>
                  Retire
                </Button>
              </>
            )}
            {canCreateNewVersion && (
              <Button variant="secondary" size="sm" onClick={createNewVersion} disabled={saving}>
                New version →
              </Button>
            )}
            <Link href={`/surveys/${survey.id}/results`}>
              <Button variant="secondary" size="sm">Results</Button>
            </Link>
          </div>
        </div>

        <fieldset className="space-y-3">
          <Field label="Title" hint="Applies to all versions of this survey.">
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
          {survey.access_mode !== "open" && (
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
          )}
        </fieldset>
      </section>

      <section className="rounded-2xl border border-ink-200 bg-white p-4 space-y-4">
        <h2 className="font-semibold">Who can respond</h2>
        <fieldset className="space-y-2">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-ink-200 cursor-pointer hover:bg-ink-50">
            <input
              type="radio"
              name="access_mode"
              checked={survey.access_mode !== "open"}
              onChange={() => setAccessMode("authenticated")}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Network (account required)</div>
              <div className="text-xs text-ink-500">
                Respondents sign in, so you get verified demographics and can
                pay them. Can be listed in the public feed.
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-ink-200 cursor-pointer hover:bg-ink-50">
            <input
              type="radio"
              name="access_mode"
              checked={survey.access_mode === "open"}
              onChange={() => setAccessMode("open")}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Open · friends &amp; family (no login)</div>
              <div className="text-xs text-ink-500">
                Anyone with the link can answer without an account. Always free.
                Choose what contact info to collect below.
              </div>
            </div>
          </label>
        </fieldset>

        {survey.access_mode === "open" && (
          <div className="pt-2 space-y-2">
            <div className="text-sm font-medium text-ink-700">Collect contact info</div>
            <div className="rounded-xl border border-ink-100 divide-y divide-ink-100">
              {CONTACT_FIELDS.map((f) => {
                const cfg: ContactFieldConfig =
                  survey.contact_fields?.[f.key as ContactFieldKey] ?? {
                    show: false,
                    required: false,
                  };
                return (
                  <div
                    key={f.key}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cfg.show}
                        onChange={(e) =>
                          updateContactField(f.key as ContactFieldKey, {
                            show: e.target.checked,
                          })
                        }
                      />
                      <span className="text-sm font-medium">{f.label}</span>
                    </label>
                    <label
                      className={
                        "flex items-center gap-2 text-xs " +
                        (cfg.show ? "text-ink-600 cursor-pointer" : "text-ink-300")
                      }
                    >
                      <input
                        type="checkbox"
                        disabled={!cfg.show}
                        checked={cfg.required}
                        onChange={(e) =>
                          updateContactField(f.key as ContactFieldKey, {
                            required: e.target.checked,
                          })
                        }
                      />
                      Required
                    </label>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-ink-500">
              Leave everything unchecked to collect nothing — fully anonymous.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-ink-200 bg-white p-4 space-y-4">
        <h2 className="font-semibold">
          Questions in v{version.version_number} ({questions.length} / {MAX_QUESTIONS_PER_SURVEY})
        </h2>

        <ol className="space-y-3">
          {questions.map((q, i) => {
            const laterPositions = questions
              .filter((o) => o.position > q.position)
              .map((o) => ({ id: o.id, position: o.position, text: o.text }));
            return (
              <li key={q.id} className="rounded-xl border border-ink-200 p-3 bg-ink-50">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => move(q.id, -1)}
                      disabled={!editable || i === 0}
                      className="text-ink-400 hover:text-ink-600 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <span className="text-xs font-mono text-ink-500 text-center">
                      Q{q.position}
                    </span>
                    <button
                      type="button"
                      onClick={() => move(q.id, 1)}
                      disabled={!editable || i === questions.length - 1}
                      className="text-ink-400 hover:text-ink-600 disabled:opacity-30"
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
                      disabled={!editable}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <BranchControl
                        label="If Yes →"
                        value={q.end_on_yes ? "__end" : q.next_on_yes ?? "__next"}
                        laterPositions={laterPositions}
                        disabled={!editable}
                        onChange={(val) => {
                          if (val === "__end") {
                            updateQuestion(q.id, { end_on_yes: true, next_on_yes: null });
                          } else if (val === "__next") {
                            updateQuestion(q.id, { end_on_yes: false, next_on_yes: null });
                          } else {
                            updateQuestion(q.id, { end_on_yes: false, next_on_yes: val });
                          }
                        }}
                      />
                      <BranchControl
                        label="If No →"
                        value={q.end_on_no ? "__end" : q.next_on_no ?? "__next"}
                        laterPositions={laterPositions}
                        disabled={!editable}
                        onChange={(val) => {
                          if (val === "__end") {
                            updateQuestion(q.id, { end_on_no: true, next_on_no: null });
                          } else if (val === "__next") {
                            updateQuestion(q.id, { end_on_no: false, next_on_no: null });
                          } else {
                            updateQuestion(q.id, { end_on_no: false, next_on_no: val });
                          }
                        }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteQuestion(q.id)}
                    disabled={!editable}
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

        {editable && questions.length < MAX_QUESTIONS_PER_SURVEY && (
          <Button variant="secondary" onClick={addQuestion}>
            + Add question
          </Button>
        )}
      </section>

      {survey.access_mode !== "open" && (
      <>
      <section className="rounded-2xl border border-ink-200 bg-white p-4 space-y-4">
        <h2 className="font-semibold">Payout mode</h2>
        <p className="text-xs text-ink-500">Applies to all versions.</p>
        <fieldset className="space-y-2">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-ink-200 cursor-pointer hover:bg-ink-50">
            <input
              type="radio"
              name="payout"
              checked={survey.payout_mode === "per_question"}
              onChange={() => patchSurvey({ payout_mode: "per_question" })}
              className="mt-1"
            />
            <div>
              <div className="font-medium">Pay per question answered</div>
              <div className="text-xs text-ink-500">
                Respondents are paid for each question they swipe. Partial completion allowed.
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-ink-200 cursor-pointer hover:bg-ink-50">
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
                  onBlur={(e) => patchSurvey({ complete_premium_pct: +e.target.value })}
                  className="w-14 mx-1 px-2 py-0.5 border rounded text-center"
                />
                % premium per question)
              </div>
              <div className="text-xs text-ink-500">
                Respondents must answer all required questions to be paid. Premium makes it more lucrative.
              </div>
            </div>
          </label>
        </fieldset>
      </section>

      <section className="rounded-2xl border border-ink-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold">Pre-survey verification</h2>
        <p className="text-xs text-ink-500">
          Respondents will be asked to confirm these profile fields are still accurate before starting. Applies to all versions.
        </p>
        <fieldset className="flex flex-wrap gap-2">
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
                    : "border-ink-300 bg-white text-ink-700 hover:bg-ink-50")
                }
              >
                {f.label}
              </button>
            );
          })}
        </fieldset>
      </section>
      </>
      )}

      {!editable && (
        <p className="text-xs text-ink-500">
          v{version.version_number} is {version.status}; its questions are frozen.
          {canCreateNewVersion && " To change questions, create a new version."}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SurveyVersion["status"] }) {
  const styles = {
    draft:   "bg-ink-100 text-ink-600",
    open:    "bg-emerald-50 text-emerald-700",
    retired: "bg-amber-50 text-amber-700",
  } as const;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status]}`}>
      {status}
    </span>
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
      <span className="block mb-1 text-ink-600">{label}</span>
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
