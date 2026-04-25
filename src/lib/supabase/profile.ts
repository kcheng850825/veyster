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

  const initial = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  let profile = initial.data;

  if (!profile) {
    const ins = await supabase.from("profiles").insert({ id: userId });
    if (ins.error) {
      throw new Error(
        `Couldn't create profile (${ins.error.code ?? "unknown"}): ${ins.error.message}. ` +
          `Make sure 0001_init.sql + 0002_rls.sql have been applied to your Supabase project.`,
      );
    }
    const refreshed = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (refreshed.error) {
      throw new Error(
        `Created profile but couldn't read it back (${refreshed.error.code ?? "unknown"}): ${refreshed.error.message}.`,
      );
    }
    profile = refreshed.data;
  }

  if (!profile) {
    throw new Error(
      "Couldn't create or load profile. Check RLS policies on the profiles table.",
    );
  }

  // The DB defaults race_codes / ethnicity_codes to '{}', but be defensive
  // in case an older Supabase project has nullable columns.
  const safe: Profile = {
    ...(profile as Profile),
    race_codes: (profile as Profile).race_codes ?? [],
    ethnicity_codes: (profile as Profile).ethnicity_codes ?? [],
  };

  return {
    profile: safe,
    userId,
    email: userData.user.email ?? null,
  };
}
