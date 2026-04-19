import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { DemographicsForm } from "@/components/DemographicsForm";

export default async function ProfilePage() {
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Your profile</h1>
      <p className="text-sm text-gray-500 mb-6">
        Signed in as <span className="font-mono">{userData.user.email}</span>
      </p>
      <Suspense fallback={null}>
        <DemographicsForm profile={profile!} mode="edit" />
      </Suspense>
    </div>
  );
}
