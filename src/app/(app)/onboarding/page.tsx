import { Suspense } from "react";
import { redirect } from "next/navigation";
import { loadOrCreateProfile } from "@/lib/supabase/profile";
import { DemographicsForm } from "@/components/DemographicsForm";

export default async function Onboarding() {
  const { profile } = await loadOrCreateProfile();
  if (profile.onboarded_at) redirect("/feed");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Tell us about you</h1>
      <p className="text-sm text-gray-500 mb-6">
        This info is used so researchers can match you to relevant surveys. You
        can change it anytime in your profile.
      </p>
      <Suspense fallback={null}>
        <DemographicsForm profile={profile} mode="onboarding" />
      </Suspense>
    </div>
  );
}
