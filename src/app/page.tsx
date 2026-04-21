import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <main className="min-h-screen">
      <TopNav />
      <Hero />
      <HowItWorks />
      <BothSides />
      <BottomCTA />
      <Footer />
    </main>
  );
}

// ---------- Nav ----------

function TopNav() {
  return (
    <nav className="absolute top-0 inset-x-0 flex items-center justify-between px-4 sm:px-6 py-4 z-20">
      <div className="flex items-center gap-2 font-semibold text-ink-900">
        <LogoMark />
        <span>{BRAND.name}</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/feed"
          className="hidden sm:inline-flex text-sm text-ink-600 hover:text-ink-900 px-3 py-2"
        >
          Browse surveys
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-white bg-ink-900 hover:bg-ink-800 px-4 py-2 rounded-full"
        >
          Sign in
        </Link>
      </div>
    </nav>
  );
}

// ---------- Hero ----------

function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pt-28 sm:pt-32 pb-20 sm:pb-24">
      <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 w-96 h-96 rounded-full bg-accent-300/30 blur-3xl" />

      <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div className="animate-fade-up text-center md:text-left">
          <div className="chip chip-accent mb-6 inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
            Survey versioning + swipe UX
          </div>
          <h1 className="text-display font-semibold text-ink-900">
            Research in a{" "}
            <span className="text-brand-600">swipe</span>.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-ink-600 max-w-xl mx-auto md:mx-0">
            {BRAND.pitch}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 md:justify-start justify-center">
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
        </div>

        <DemoCard />
      </div>
    </section>
  );
}

// ---------- How it works ----------

function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Write 10 yes/no questions",
      body: "Branch based on answers, like Google Forms — but built for attention spans of 15 seconds.",
    },
    {
      num: "02",
      title: "Share a link or QR",
      body: "Respondents see one card at a time and swipe. No walls of text, no drop-off.",
    },
    {
      num: "03",
      title: "See results by version",
      body: "Iterate your survey without losing history. Compare v1 vs v2 side by side.",
    },
  ];
  return (
    <section className="px-5 py-20 sm:py-24 bg-white/60 border-y border-ink-100">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-brand-600 mb-3">
            How it works
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink-900">
            Build, share, iterate. In that order.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <div
              key={s.num}
              className="card p-6 sm:p-7 hover:shadow-pop transition"
            >
              <div className="font-mono text-sm text-brand-600 mb-4">{s.num}</div>
              <h3 className="text-lg font-semibold text-ink-900 mb-2 tracking-tight">
                {s.title}
              </h3>
              <p className="text-sm text-ink-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Two sides ----------

function BothSides() {
  return (
    <section className="px-5 py-20 sm:py-24">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
        <SideCard
          tone="brand"
          kicker="For researchers"
          title="Publish. Update. Never restart."
          bullets={[
            "Create versions without losing old responses",
            "Link equivalent questions across versions for merged results",
            "Target by age, gender, education, country (paid tier)",
            "Aggregate charts and demographic breakdowns",
          ]}
          cta={{ href: "/login", label: "Start building →" }}
        />
        <SideCard
          tone="accent"
          kicker="For respondents"
          title="Swipe through. Get paid."
          bullets={[
            "One card at a time — no forms, no paragraphs",
            "Undo the last swipe, stop anytime",
            "Your demographics stay on your device profile",
            "Paid surveys appear in your feed automatically",
          ]}
          cta={{ href: "/login", label: "Start answering →" }}
        />
      </div>
    </section>
  );
}

function SideCard({
  tone,
  kicker,
  title,
  bullets,
  cta,
}: {
  tone: "brand" | "accent";
  kicker: string;
  title: string;
  bullets: string[];
  cta: { href: string; label: string };
}) {
  const kickerClass =
    tone === "brand" ? "text-brand-600" : "text-accent-600";
  const borderClass = tone === "brand" ? "border-brand-100" : "border-accent-100";
  const bgClass = tone === "brand" ? "bg-brand-50/40" : "bg-accent-50/40";
  return (
    <div
      className={`rounded-3xl border ${borderClass} ${bgClass} p-6 sm:p-8`}
    >
      <div className={`text-xs font-mono uppercase tracking-[0.2em] ${kickerClass} mb-3`}>
        {kicker}
      </div>
      <h3 className="text-2xl font-semibold text-ink-900 tracking-tight mb-4">
        {title}
      </h3>
      <ul className="space-y-2.5 mb-6">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-ink-700">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${tone === "brand" ? "bg-brand-500" : "bg-accent-500"}`} />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link
        href={cta.href}
        className={`inline-flex text-sm font-medium ${tone === "brand" ? "text-brand-700 hover:text-brand-800" : "text-accent-600 hover:text-accent-500"}`}
      >
        {cta.label}
      </Link>
    </div>
  );
}

// ---------- Bottom CTA ----------

function BottomCTA() {
  return (
    <section className="px-5 py-20 sm:py-28">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-ink-900">
          Ready to stop wrestling forms?
        </h2>
        <p className="mt-4 text-base sm:text-lg text-ink-600">
          Free forever for link-shared surveys. No credit card.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-ink-900 text-white px-7 py-4 font-medium hover:bg-ink-800 shadow-pop"
          >
            Get started
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------- Footer ----------

function Footer() {
  return (
    <footer className="px-5 py-10 border-t border-ink-100">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-500">
        <div className="flex items-center gap-2">
          <LogoMark small />
          <span className="font-medium text-ink-700">{BRAND.name}</span>
          <span className="text-ink-400">· {BRAND.tagline}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/feed" className="hover:text-ink-800">Browse</Link>
          <Link href="/login" className="hover:text-ink-800">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}

// ---------- Bits ----------

function LogoMark({ small = false }: { small?: boolean }) {
  const size = small ? "w-6 h-6" : "w-8 h-8";
  const text = small ? "text-[10px]" : "text-sm";
  return (
    <span className={`relative inline-flex items-center justify-center ${size} rounded-xl bg-brand-gradient shadow-soft`}>
      <span className={`text-white font-bold ${text}`}>V</span>
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
