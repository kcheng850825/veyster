import { Suspense } from "react";
import { loadOrCreateProfile } from "@/lib/supabase/profile";
import { DemographicsForm } from "@/components/DemographicsForm";

export default async function ProfilePage() {
  const { profile, email } = await loadOrCreateProfile();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900 mb-1">
            Your profile
          </h1>
          <p className="text-sm text-ink-500 font-mono break-all">{email}</p>
        </div>
        <form action="/logout" method="post">
          <button
            type="submit"
            className="px-4 py-2 rounded-full text-sm text-ink-600 border border-ink-200 bg-white hover:bg-ink-50 transition"
          >
            Sign out
          </button>
        </form>
      </div>

      <Suspense fallback={null}>
        <DemographicsForm profile={profile} mode="edit" />
      </Suspense>
    </div>
  );
}
