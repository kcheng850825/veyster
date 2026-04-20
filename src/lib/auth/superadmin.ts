// Hardcoded superadmin allowlist. Add more emails as needed and redeploy.
// Intentionally kept in code (not a DB column) so superadmin status can't
// be escalated via a compromised Supabase key — it requires a commit + deploy.
const SUPERADMIN_EMAILS: readonly string[] = [
  "kcheng850825@gmail.com",
];

const SUPERADMIN_SET = new Set(
  SUPERADMIN_EMAILS.map((e) => e.trim().toLowerCase()),
);

export function isSuperadmin(email: string | null | undefined): boolean {
  return !!email && SUPERADMIN_SET.has(email.trim().toLowerCase());
}
