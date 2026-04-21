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
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-brand-600 mb-2">{BRAND.name}</h1>
        <p className="text-gray-500 mb-8 text-sm">
          {stage === "email"
            ? "Enter your email to get a 6-digit sign-in code."
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
              className="rounded-xl border border-gray-300 px-4 py-3 focus:border-brand-500 focus:outline-none"
              autoFocus
            />
            <button
              disabled={loading}
              className="rounded-xl bg-brand-600 text-white px-4 py-3 font-medium disabled:opacity-50"
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
              placeholder="123456"
              className="rounded-xl border border-gray-300 px-4 py-3 text-center text-2xl tracking-[0.5em] focus:border-brand-500 focus:outline-none"
              autoFocus
            />
            <button
              disabled={loading || code.length !== 6}
              className="rounded-xl bg-brand-600 text-white px-4 py-3 font-medium disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("email");
                setCode("");
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Use a different email
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
