import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = req.nextUrl;

  const isProtected =
    pathname.startsWith("/feed") ||
    pathname.startsWith("/answered") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/surveys") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/s/");

  // If Supabase env vars aren't configured yet, keep the site loadable.
  // Protected routes redirect to a setup-needed page instead of crashing.
  if (!url || !anonKey) {
    if (isProtected) {
      const u = req.nextUrl.clone();
      u.pathname = "/setup-required";
      return NextResponse.redirect(u);
    }
    return res;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options),
        );
      },
    },
  });

  try {
    const { data } = await supabase.auth.getUser();
    if (isProtected && !data.user) {
      const u = req.nextUrl.clone();
      u.pathname = "/login";
      u.searchParams.set("next", pathname);
      return NextResponse.redirect(u);
    }
  } catch {
    // Supabase unreachable / bad keys — let the page render its own error.
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|sw.js).*)",
  ],
};
