import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/base-url";

export async function POST() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", await getBaseUrl()));
}
