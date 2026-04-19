import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="text-5xl font-bold tracking-tight text-brand-600">
          {BRAND.name}
        </h1>
        <p className="mt-4 text-lg text-gray-600">{BRAND.tagline}</p>
        <p className="mt-2 text-sm text-gray-500">
          Create yes/no surveys. Respondents swipe through.
        </p>
        <div className="mt-10 flex flex-col gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-brand-600 px-6 py-3 text-white font-medium hover:bg-brand-700"
          >
            Get started
          </Link>
          <Link
            href="/feed"
            className="rounded-xl border border-gray-300 px-6 py-3 font-medium hover:bg-white"
          >
            Browse surveys
          </Link>
        </div>
      </div>
    </main>
  );
}
