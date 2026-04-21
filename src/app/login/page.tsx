"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { BRAND } from "@/lib/brand";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/feed";

  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) return setError(error.message);
    setStage("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = getBrowserSupabase();
    const { data: verifyData, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error) {
      setLoading(false);
      return setError(error.message);
    }

    // Fall back to auth.getUser() if verifyOtp didn't surface the user object,
    // so subsequent RLS-gated queries always run with a known user id.
    let userId = verifyData.user?.id;
    if (!userId) {
      const { data: u } = await supabase.auth.getUser();
      userId = u.user?.id;
    }
    if (!userId) {
      setLoading(false);
      return setError(
        "Signed in, but couldn't read your session. Refresh and try again.",
      );
    }

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({ id: userId }, { onConflict: "id" });
    if (upsertError) {
      setLoading(false);
      return setError(
        `Couldn't create your profile: ${upsertError.message}. This usually means the profiles table or its RLS policies are missing — re-run the SQL migrations.`,
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", userId)
      .maybeSingle();

    setLoading(false);
    // Full-page navigation so the freshly-set Supabase session cookies are
    // read by the server on the very first request to the target page,
    // avoiding a stale router cache that can make the transition appear stuck.
    window.location.assign(profile?.onboarded_at ? next : "/onboarding");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-accent-300/30 blur-3xl" />

      <div className="w-full max-w-sm animate-fade-up relative">
        <div className="flex items-center gap-2 mb-8">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-brand-gradient shadow-soft">
            <span className="text-white font-bold">V</span>
          </span>
          <span className="font-semibold text-ink-900 text-lg">{BRAND.name}</span>
        </div>

        <h1 className="text-display-sm font-semibold text-ink-900 mb-2">
          {stage === "email" ? "Welcome" : "Check your inbox"}
        </h1>
        <p className="text-ink-600 mb-8 text-sm">
          {stage === "email"
            ? "Enter your email and we'll send a one-time code."
            : `We sent a 6-digit code to ${email}.`}
        </p>

        {stage === "email" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded-2xl border border-ink-200 bg-white/90 px-4 py-3.5 text-ink-900 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
              autoFocus
            />
            <button
              disabled={loading}
              className="rounded-full text-white bg-brand-gradient shadow-pop px-4 py-3.5 font-medium disabled:opacity-50 active:scale-[0.98] transition"
            >
              {loading ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              className="rounded-2xl border border-ink-200 bg-white/90 px-4 py-3.5 text-center text-3xl tracking-[0.5em] font-mono text-ink-900 placeholder:text-ink-300 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
              autoFocus
            />
            <button
              disabled={loading || code.length !== 6}
              className="rounded-full text-white bg-brand-gradient shadow-pop px-4 py-3.5 font-medium disabled:opacity-50 active:scale-[0.98] transition"
            >
              {loading ? "Verifying…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setCode("");
              }}
              className="text-sm text-ink-500 hover:text-ink-700 mt-1"
            >
              Use a different email
            </button>
          </form>
        )}

        {error && (
          <div className="mt-4 text-sm text-no-700 bg-no-50 border border-no-100 rounded-2xl px-4 py-3" role="alert">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
