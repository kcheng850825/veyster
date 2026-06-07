import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase, getCurrentUser } from "@/lib/supabase/server";
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
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!isSuperadmin(currentUser.email)) notFound();

  let users: Awaited<ReturnType<ReturnType<typeof getAdminSupabase>["auth"]["admin"]["listUsers"]>>["data"] | null = null;
  let profilesById = new Map<string, ProfileRow>();
  const sessionCountByUser = new Map<string, number>();
  let fatalError: string | null = null;

  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;
    users = data ?? null;

    if (users && users.users.length > 0) {
      const userIds = users.users.map((u) => u.id);
      // Profiles and session counts are independent — fetch together.
      const [profilesRes, sessionsRes] = await Promise.all([
        admin
          .from("profiles")
          .select("id, birth_year, gender, country_code, onboarded_at")
          .in("id", userIds),
        admin
          .from("survey_sessions")
          .select("respondent_id")
          .in("respondent_id", userIds),
      ]);
      profilesById = new Map(
        (profilesRes.data ?? []).map((p) => [p.id, p as ProfileRow]),
      );
      (sessionsRes.data ?? []).forEach((s) => {
        const rid = s.respondent_id as string;
        sessionCountByUser.set(rid, (sessionCountByUser.get(rid) ?? 0) + 1);
      });
    }
  } catch (e) {
    fatalError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-ink-500">Superadmin</div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-ink-500 mt-1">
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
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-xs text-ink-500 text-left">
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
                const isSelf = u.id === currentUser.id;
                const isAdmin = isSuperadmin(u.email);
                return (
                  <tr key={u.id} className="border-t border-ink-100 align-middle">
                    <td className="p-3">
                      <div className="font-medium">{u.email ?? <em>no email</em>}</div>
                      {isAdmin && (
                        <span className="inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
                          superadmin
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-ink-600">{profile?.country_code ?? "—"}</td>
                    <td className="p-3 text-ink-600">{profile?.birth_year ?? "—"}</td>
                    <td className="p-3 text-ink-600">
                      {profile?.onboarded_at
                        ? new Date(profile.onboarded_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-3 text-right text-ink-600">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="hover:text-brand-700 hover:underline"
                      >
                        {sessionCountByUser.get(u.id) ?? 0}
                      </Link>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="text-xs text-brand-600 hover:text-brand-800 hover:underline"
                        >
                          Sessions
                        </Link>
                        {isSelf ? (
                          <span className="text-xs text-ink-400">you</span>
                        ) : (
                          <form action={deleteUser}>
                            <input type="hidden" name="userId" value={u.id} />
                            <DeleteUserButton email={u.email ?? null} />
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-ink-500">
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
