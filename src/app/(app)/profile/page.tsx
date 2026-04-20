import { Suspense } from "react";
import { loadOrCreateProfile } from "@/lib/supabase/profile";
import { DemographicsForm } from "@/components/DemographicsForm";

export default async function ProfilePage() {
  const { profile, email } = await loadOrCreateProfile();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Your profile</h1>
      <p className="text-sm text-gray-500 mb-6">
        Signed in as <span className="font-mono">{email}</span>
      </p>
      <Suspense fallback={null}>
        <DemographicsForm profile={profile} mode="edit" />
      </Suspense>
    </div>
  );
}
