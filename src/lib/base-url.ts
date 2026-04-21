import { headers } from "next/headers";

/**
 * Best-effort absolute base URL for the current request.
 *
 * Priority (most-accurate-first):
 *   1. The actual host the request came in on (x-forwarded-host + proto).
 *      This is what the user is looking at, so it's what share links should
 *      use.
 *   2. NEXT_PUBLIC_SITE_URL — explicit override (e.g. for jobs / server
 *      actions that run outside a request scope).
 *   3. VERCEL_URL, automatically provided on every Vercel deploy.
 *   4. localhost:3000 fallback for dev.
 */
export async function getBaseUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() only works in a request scope — fall through.
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
