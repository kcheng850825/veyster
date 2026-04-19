import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { DemographicsForm } from "@/components/DemographicsForm";

export default async function Onboarding() {
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  if (profile?.onboarded_at) redirect("/feed");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Tell us about you</h1>
      <p className="text-sm text-gray-500 mb-6">
        This info is used so researchers can match you to relevant surveys. You
        can change it anytime in your profile.
      </p>
      <Suspense fallback={null}>
        <DemographicsForm profile={profile!} mode="onboarding" />
      </Suspense>
    </div>
  );
}
