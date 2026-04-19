"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BRAND } from "@/lib/brand";

const tabs = [
  { href: "/feed", label: "Feed" },
  { href: "/surveys", label: "My surveys" },
  { href: "/profile", label: "Profile" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto max-w-3xl flex items-center justify-between px-4 h-14">
        <Link href="/feed" className="text-lg font-bold text-brand-600">
          {BRAND.name}
        </Link>
        <nav className="flex gap-1">
          {tabs.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-sm font-medium",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-100",
                )}
              >
                {t.label}
              </Link>
            );
          })}
          <form action="/logout" method="post">
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
