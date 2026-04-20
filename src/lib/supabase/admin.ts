import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client that uses the service_role key. Bypasses RLS
 * and has full admin API access. Never import this from a client component
 * — the service_role key must not ship to the browser.
 */
export function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it as a server-only env var " +
        "in Vercel (Project → Settings → Environment Variables; do NOT prefix " +
        "with NEXT_PUBLIC_). Required for admin operations like deleting users.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
