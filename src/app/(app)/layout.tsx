import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { isSuperadmin } from "@/lib/auth/superadmin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <AppNav superadmin={isSuperadmin(user.email)} />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}
