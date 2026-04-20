import { headers } from "next/headers";

/**
 * Best-effort absolute base URL for the current request.
 * Priority:
 *   1. NEXT_PUBLIC_SITE_URL (explicit override — set this on Vercel for
 *      canonical share URLs).
 *   2. Forwarded host/proto headers (works on Vercel preview URLs and any
 *      other proxied environment).
 *   3. VERCEL_URL env var.
 *   4. localhost:3000 fallback for dev.
 */
export async function getBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() only works in a request scope — fall through.
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
