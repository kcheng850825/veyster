import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function SetupRequired() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-bold text-brand-600">{BRAND.name} isn't configured yet</h1>
        <p className="mt-3 text-gray-600">
          This deployment is missing Supabase environment variables. Add them in
          your Vercel project settings and redeploy.
        </p>
        <ul className="mt-6 text-left text-sm bg-white border border-gray-200 rounded-xl p-4 font-mono">
          <li>NEXT_PUBLIC_SUPABASE_URL</li>
          <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
          <li>NEXT_PUBLIC_SITE_URL</li>
        </ul>
        <p className="mt-4 text-xs text-gray-500">
          See the README in the repo for a step-by-step setup guide.
        </p>
        <Link href="/" className="mt-6 inline-block text-brand-600 hover:underline">
          ← Back home
        </Link>
      </div>
    </main>
  );
}
