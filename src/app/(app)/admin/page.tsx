import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isSuperadmin } from "@/lib/auth/superadmin";
import { DeleteUserButton } from "@/components/DeleteUserButton";

type ProfileRow = {
  id: string;
  birth_year: number | null;
  gender: string | null;
  country_code: string | null;
  onboarded_at: string | null;
};

async function deleteUser(formData: FormData) {
  "use server";

  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isSuperadmin(userData.user.email)) {
    throw new Error("Not authorized");
  }

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  if (userId === userData.user.id) {
    throw new Error("Refusing to delete yourself.");
  }

  const admin = getAdminSupabase();
  // Deleting the auth.users row cascades to profiles → survey_sessions →
  // answers via the ON DELETE CASCADE FKs in the schema.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;

  revalidatePath("/admin");
}

export default async function AdminPage() {
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  if (!isSuperadmin(userData.user.email)) notFound();

  let users: Awaited<ReturnType<ReturnType<typeof getAdminSupabase>["auth"]["admin"]["listUsers"]>>["data"] | null = null;
  let fatalError: string | null = null;
  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) fatalError = error.message;
    users = data ?? null;
  } catch (e) {
    fatalError = e instanceof Error ? e.message : String(e);
  }

  // Fetch profile data to show demographics next to each user.
  let profilesById = new Map<string, ProfileRow>();
  if (users) {
    try {
      const admin = getAdminSupabase();
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, birth_year, gender, country_code, onboarded_at")
        .in("id", users.users.map((u) => u.id).concat(["00000000-0000-0000-0000-000000000000"]));
      profilesById = new Map((profiles ?? []).map((p) => [p.id, p as ProfileRow]));
    } catch {
      // Non-fatal — we can still list users without their profile details.
    }
  }

  // Answer counts per user, so you can see who's "spamming".
  let sessionCountByUser = new Map<string, number>();
  if (users) {
    try {
      const admin = getAdminSupabase();
      const { data: sessions } = await admin
        .from("survey_sessions")
        .select("respondent_id");
      (sessions ?? []).forEach((s) => {
        const rid = s.respondent_id as string;
        sessionCountByUser.set(rid, (sessionCountByUser.get(rid) ?? 0) + 1);
      });
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500">Superadmin</div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-gray-500 mt-1">
          Deleting a user removes their account, profile, all survey sessions, and
          all answers. This cannot be undone.
        </p>
      </div>

      {fatalError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 whitespace-pre-wrap">
          {fatalError}
        </div>
      )}

      {users && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 text-left">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Country</th>
                <th className="p-3">Birth year</th>
                <th className="p-3">Onboarded</th>
                <th className="p-3 text-right">Sessions</th>
                <th className="p-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {users.users.map((u) => {
                const profile = profilesById.get(u.id);
                const isSelf = u.id === userData.user!.id;
                const isAdmin = isSuperadmin(u.email);
                return (
                  <tr key={u.id} className="border-t border-gray-100 align-middle">
                    <td className="p-3">
                      <div className="font-medium">{u.email ?? <em>no email</em>}</div>
                      {isAdmin && (
                        <span className="inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
                          superadmin
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-gray-600">{profile?.country_code ?? "—"}</td>
                    <td className="p-3 text-gray-600">{profile?.birth_year ?? "—"}</td>
                    <td className="p-3 text-gray-600">
                      {profile?.onboarded_at
                        ? new Date(profile.onboarded_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-3 text-right text-gray-600">
                      {sessionCountByUser.get(u.id) ?? 0}
                    </td>
                    <td className="p-3 text-right">
                      {isSelf ? (
                        <span className="text-xs text-gray-400">you</span>
                      ) : (
                        <form action={deleteUser}>
                          <input type="hidden" name="userId" value={u.id} />
                          <DeleteUserButton email={u.email ?? null} />
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
