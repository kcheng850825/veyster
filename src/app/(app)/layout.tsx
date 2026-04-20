import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { isSuperadmin } from "@/lib/auth/superadmin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  return (
    <>
      <AppNav superadmin={isSuperadmin(data.user.email)} />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </>
  );
}
