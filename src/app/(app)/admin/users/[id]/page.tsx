import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isSuperadmin } from "@/lib/auth/superadmin";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

type SessionRow = {
  id: string;
  started_at: string;
  completed_at: string | null;
  version_id: string;
  survey_id: string;
  survey_versions: {
    version_number: number;
    surveys: { id: string; title: string } | null;
  } | null;
};

type ProfileRow = {
  birth_year: number | null;
  gender: string | null;
  education: string | null;
  country_code: string | null;
  admin1_code: string | null;
  onboarded_at: string | null;
};

async function deleteSession(formData: FormData) {
  "use server";

  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !isSuperadmin(userData.user.email)) {
    throw new Error("Not authorized");
  }

  const sessionId = String(formData.get("sessionId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!sessionId) return;

  const admin = getAdminSupabase();
  const { error } = await admin
    .from("survey_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;

  revalidatePath(`/admin/users/${userId}`);
}

export default async function AdminUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = await params;

  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (!isSuperadmin(currentUser.email)) notFound();

  let user: Awaited<
    ReturnType<ReturnType<typeof getAdminSupabase>["auth"]["admin"]["getUserById"]>
  >["data"]["user"] | null = null;
  let profile: ProfileRow | null = null;
  let sessions: SessionRow[] = [];
  let errorMessage: string | null = null;

  try {
    const admin = getAdminSupabase();
    // The auth lookup, profile, and sessions are all independent — run together.
    const [userRes, profileRes, sessionsRes] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin
        .from("profiles")
        .select("birth_year, gender, education, country_code, admin1_code, onboarded_at")
        .eq("id", userId)
        .maybeSingle<ProfileRow>(),
      admin
        .from("survey_sessions")
        .select(`
          id, started_at, completed_at, version_id, survey_id,
          survey_versions!inner (
            version_number,
            surveys!inner ( id, title )
          )
        `)
        .eq("respondent_id", userId)
        .order("started_at", { ascending: false })
        .returns<SessionRow[]>(),
    ]);
    if (userRes.error) errorMessage = userRes.error.message;
    user = userRes.data.user ?? null;
    profile = profileRes.data ?? null;
    sessions = sessionsRes.data ?? [];
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  if (!user && !errorMessage) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-ink-500 hover:text-ink-700"
        >
          ← All users
        </Link>
        <div className="text-xs uppercase tracking-wide text-ink-500 mt-2">
          Superadmin · User
        </div>
        <h1 className="text-2xl font-bold">{user?.email ?? "—"}</h1>
        <div className="text-xs font-mono text-ink-400 mt-1">{userId}</div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <section className="rounded-xl border border-ink-200 bg-white p-4 text-sm">
        <h2 className="font-semibold mb-2">Profile</h2>
        {profile ? (
          <dl className="grid grid-cols-2 gap-2 text-ink-700">
            <dt className="text-ink-500">Birth year</dt>
            <dd>{profile.birth_year ?? "—"}</dd>
            <dt className="text-ink-500">Gender</dt>
            <dd>{profile.gender ?? "—"}</dd>
            <dt className="text-ink-500">Education</dt>
            <dd>{profile.education ?? "—"}</dd>
            <dt className="text-ink-500">Country</dt>
            <dd>{profile.country_code ?? "—"}</dd>
            <dt className="text-ink-500">State/region</dt>
            <dd>{profile.admin1_code ?? "—"}</dd>
            <dt className="text-ink-500">Onboarded</dt>
            <dd>
              {profile.onboarded_at
                ? new Date(profile.onboarded_at).toLocaleString()
                : "—"}
            </dd>
          </dl>
        ) : (
          <p className="text-ink-500">No profile row.</p>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Sessions</h2>
        <p className="text-xs text-ink-500 mb-3">
          Deleting a session wipes it and all its answers. The user can then
          retake the survey (current open version).
        </p>
        {!sessions || sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-300 p-6 text-center text-ink-500 text-sm">
            No sessions yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => {
              const survey = s.survey_versions?.surveys;
              const vNum = s.survey_versions?.version_number;
              const completed = !!s.completed_at;
              return (
                <li
                  key={s.id}
                  className="rounded-xl border border-ink-200 bg-white p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {survey?.title ?? "(survey deleted)"}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-ink-100">
                        v{vNum ?? "?"}
                      </span>
                      <span>
                        {completed
                          ? `Completed ${new Date(s.completed_at!).toLocaleString()}`
                          : `Started ${new Date(s.started_at).toLocaleString()} · in progress`}
                      </span>
                    </div>
                  </div>
                  <form action={deleteSession}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <input type="hidden" name="userId" value={userId} />
                    <DeleteSessionButton
                      label={
                        completed
                          ? "Delete session"
                          : "Delete in-progress session"
                      }
                    />
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function DeleteSessionButton({ label }: { label: string }) {
  return (
    <ConfirmSubmitButton
      message="Delete this session and all its answers? The user will be able to retake the survey. This can't be undone."
      className="text-xs text-red-600 hover:text-red-800 hover:underline whitespace-nowrap"
    >
      {label}
    </ConfirmSubmitButton>
  );
}
