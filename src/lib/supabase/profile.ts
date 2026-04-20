import { redirect } from "next/navigation";
import { getServerSupabase } from "./server";
import type { Profile } from "@/lib/types";

/**
 * Load the current user's profile, creating a blank row if one doesn't
 * exist yet. Redirects to /login if the user isn't authenticated.
 *
 * Without this helper, first-time users can land on /onboarding with a
 * null profile row (if the client-side upsert after OTP verify silently
 * failed or hasn't propagated), which crashes the demographics form.
 */
export async function loadOrCreateProfile(): Promise<{
  profile: Profile;
  userId: string;
  email: string | null;
}> {
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const userId = userData.user.id;

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").insert({ id: userId });
    const refreshed = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    profile = refreshed.data;
  }

  if (!profile) {
    throw new Error(
      "Couldn't create or load profile. Check RLS policies on the profiles table.",
    );
  }

  return {
    profile: profile as Profile,
    userId,
    email: userData.user.email ?? null,
  };
}
