import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      <nav className="absolute top-0 inset-x-0 flex items-center justify-between px-4 sm:px-6 py-4 z-20">
        <div className="flex items-center gap-2 font-semibold text-ink-900">
          <LogoMark />
          <span>{BRAND.name}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/feed"
            className="text-sm text-ink-600 hover:text-ink-900 px-3 py-2"
          >
            Browse
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-white bg-ink-900 hover:bg-ink-800 px-4 py-2 rounded-full"
          >
            Sign in
          </Link>
        </div>
      </nav>

      <section className="px-5 pt-28 sm:pt-32 pb-16 max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-12 items-center relative">
        <div className="animate-fade-up text-center md:text-left">
          <div className="chip chip-accent mb-5 inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
            New · survey versioning + swipe UX
          </div>
          <h1 className="text-display font-semibold text-ink-900">
            Research in a{" "}
            <span className="text-brand-600">swipe</span>.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-ink-600 max-w-lg mx-auto md:mx-0">
            {BRAND.pitch} Yes/no questions, conditional branching,
            demographic targeting — wrapped in a single swipe.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3 sm:justify-start justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ink-900 text-white px-6 py-3.5 font-medium hover:bg-ink-800 shadow-soft"
            >
              Get started — free
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/feed"
              className="inline-flex items-center justify-center rounded-full border border-ink-200 bg-white/80 backdrop-blur px-6 py-3.5 font-medium text-ink-700 hover:border-ink-300"
            >
              Swipe a live survey
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-ink-500 max-w-md mx-auto md:mx-0">
            <Feat>▲ 10× faster than forms</Feat>
            <Feat>◆ Tinder-style for respondents</Feat>
            <Feat>● Per-version results</Feat>
          </div>
        </div>

        <DemoCard />
      </section>

      <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-accent-300/30 blur-3xl" />
    </main>
  );
}

function Feat({ children }: { children: React.ReactNode }) {
  return <span className="uppercase tracking-[0.2em] whitespace-nowrap">{children}</span>;
}

function LogoMark() {
  return (
    <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-xl bg-brand-gradient shadow-soft">
      <span className="text-white font-bold text-sm">V</span>
      <span className="absolute inset-0 rounded-xl bg-shine pointer-events-none" />
    </span>
  );
}

function DemoCard() {
  return (
    <div className="relative h-[380px] sm:h-[440px] w-full max-w-sm mx-auto">
      <div
        className="absolute inset-x-4 top-10 bottom-0 rounded-3xl card"
        style={{ transform: "rotate(-4deg) translateY(8px) scale(0.94)" }}
      />
      <div
        className="absolute inset-x-2 top-4 bottom-0 rounded-3xl card"
        style={{ transform: "rotate(2deg)" }}
      />
      <div className="absolute inset-0 rounded-3xl card-pop p-6 sm:p-8 flex flex-col justify-between animate-fade-up">
        <div className="flex items-center justify-between">
          <span className="chip chip-brand">Q3 / 10</span>
          <span className="text-ink-400 text-xs">swipe to answer</span>
        </div>
        <p className="text-2xl sm:text-3xl leading-tight font-medium text-ink-900 tracking-tight">
          Will AI change how you work in the next year?
        </p>
        <div className="flex gap-3">
          <button className="flex-1 py-3 rounded-2xl bg-no-50 text-no-700 border-2 border-no-100 font-semibold">
            ✕ No
          </button>
          <button className="flex-1 py-3 rounded-2xl bg-yes-500 text-white border-2 border-yes-600 font-semibold shadow-soft">
            ✓ Yes
          </button>
        </div>
      </div>
    </div>
  );
}
