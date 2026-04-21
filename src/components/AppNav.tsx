"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { BRAND } from "@/lib/brand";

type Mode = "respondent" | "researcher";

const TABS_BY_MODE: Record<Mode, { href: string; label: string }[]> = {
  respondent: [
    { href: "/feed", label: "Feed" },
    { href: "/answered", label: "Answered" },
  ],
  researcher: [
    { href: "/surveys", label: "My surveys" },
  ],
};

const RESPONDENT_PATHS = ["/feed", "/answered", "/s/"];
const RESEARCHER_PATHS = ["/surveys"];

function inferModeFromPath(pathname: string): Mode | null {
  if (RESPONDENT_PATHS.some((p) => pathname.startsWith(p))) return "respondent";
  if (RESEARCHER_PATHS.some((p) => pathname.startsWith(p))) return "researcher";
  return null;
}

export function AppNav({ superadmin = false }: { superadmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("respondent");

  // Hydrate from localStorage on mount; let the route override if it implies one.
  useEffect(() => {
    const stored = (typeof window !== "undefined" &&
      (localStorage.getItem("veyster.mode") as Mode | null)) || null;
    const inferred = inferModeFromPath(pathname);
    setMode(inferred ?? stored ?? "respondent");
  }, [pathname]);

  function switchMode(next: Mode) {
    setMode(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("veyster.mode", next);
    }
    // Land on the first tab of the new mode if you weren't already in one of its pages
    const inferred = inferModeFromPath(pathname);
    if (inferred !== next) {
      router.push(TABS_BY_MODE[next][0].href);
    }
  }

  const tabs = TABS_BY_MODE[mode];

  return (
    <header className="sticky top-0 z-40 bg-canvas/80 backdrop-blur border-b border-ink-100">
      <div className="mx-auto max-w-3xl px-4">
        <div className="flex items-center justify-between h-16">
          <Link
            href={mode === "researcher" ? "/surveys" : "/feed"}
            className="flex items-center gap-2 font-semibold text-ink-900"
          >
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-brand-gradient shadow-soft">
              <span className="text-white font-bold text-sm">V</span>
            </span>
            {BRAND.name}
          </Link>
          <div className="flex items-center gap-2">
            <ModeSwitcher current={mode} onSwitch={switchMode} />
            {superadmin && (
              <Link
                href="/admin"
                className={clsx(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition",
                  pathname.startsWith("/admin")
                    ? "bg-no-50 text-no-700 border border-no-100"
                    : "text-no-600 hover:bg-no-50",
                )}
                title="Superadmin"
              >
                Admin
              </Link>
            )}
            <Link
              href="/profile"
              className={clsx(
                "px-3 py-1.5 rounded-full text-sm font-medium transition",
                pathname.startsWith("/profile")
                  ? "bg-brand-50 text-brand-700 border border-brand-100"
                  : "text-ink-600 hover:bg-ink-50",
              )}
            >
              Profile
            </Link>
            <form action="/logout" method="post">
              <button
                type="submit"
                className="px-3 py-1.5 rounded-full text-sm text-ink-500 hover:bg-ink-50 transition"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 -mb-px">
          {tabs.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={clsx(
                  "px-4 py-2.5 text-sm font-medium border-b-2 transition",
                  active
                    ? "border-brand-500 text-brand-700"
                    : "border-transparent text-ink-500 hover:text-ink-800",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function ModeSwitcher({ current, onSwitch }: { current: Mode; onSwitch: (m: Mode) => void }) {
  return (
    <div className="inline-flex bg-ink-100 rounded-full p-1 text-xs">
      <button
        type="button"
        onClick={() => onSwitch("respondent")}
        className={clsx(
          "px-3 py-1.5 rounded-full transition font-medium",
          current === "respondent"
            ? "bg-white text-brand-700 shadow-sm"
            : "text-ink-600 hover:text-ink-800",
        )}
      >
        Respondent
      </button>
      <button
        type="button"
        onClick={() => onSwitch("researcher")}
        className={clsx(
          "px-3 py-1.5 rounded-full transition font-medium",
          current === "researcher"
            ? "bg-white text-brand-700 shadow-sm"
            : "text-ink-600 hover:text-ink-800",
        )}
      >
        Researcher
      </button>
    </div>
  );
}
