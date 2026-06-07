import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — Next.js disallows cookie writes there.
            // Middleware handles the actual refresh, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * Returns the authenticated user (or null), deduplicated across a single
 * render pass. The layout and each page both need the user; without this,
 * every authenticated route makes 2+ round-trips to the Supabase auth
 * server. React's cache() collapses them into one per request.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export async function requireUser() {
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return { user, supabase };
}
