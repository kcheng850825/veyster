import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function DonePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-bold">Thanks for answering.</h1>
        <p className="mt-2 text-gray-500">
          Your responses are in. The researcher only sees anonymized aggregates.
        </p>
        <Link
          href="/feed"
          className="mt-8 inline-block rounded-xl bg-brand-600 px-6 py-3 text-white font-medium hover:bg-brand-700"
        >
          Find more surveys on {BRAND.name}
        </Link>
      </div>
    </main>
  );
}
