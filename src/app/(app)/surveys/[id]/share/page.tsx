import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { getServerSupabase, getCurrentUser } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/base-url";
import { CopyButton } from "@/components/CopyButton";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { data: survey } = await supabase
    .from("surveys")
    .select("id, title, share_slug, owner_id")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!survey) notFound();

  // Whether the survey is *actually* accepting respondents is a function of
  // its versions, not the (legacy) surveys.status column.
  const { data: openVersion } = await supabase
    .from("survey_versions")
    .select("version_number")
    .eq("survey_id", survey.id)
    .eq("status", "open")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const shareUrl = `${await getBaseUrl()}/s/${survey.share_slug}`;
  const qrDataUrl = await QRCode.toDataURL(shareUrl, {
    width: 320,
    margin: 1,
    color: { dark: "#111827", light: "#ffffff" },
  });

  return (
    <div className="max-w-lg mx-auto text-center space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-ink-500">Share</div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{survey.title}</h1>
        {!openVersion ? (
          <p className="mt-2 text-sm text-accent-600 bg-accent-50 border border-accent-100 rounded-2xl p-3">
            No version of this survey is currently open. Publish a version before
            sharing.
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-500">
            Sharing v{openVersion.version_number} (currently open).
          </p>
        )}
      </div>

      <div className="rounded-3xl border border-ink-100 bg-white p-6 inline-block shadow-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR code" width={320} height={320} />
      </div>

      <div className="space-y-2">
        <div className="text-xs text-ink-500">Shareable URL</div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 rounded-2xl border border-ink-200 px-3 py-2 font-mono text-sm bg-ink-50"
          />
          <CopyButton text={shareUrl} />
        </div>
      </div>

      <Link
        href={`/surveys/${survey.id}`}
        className="inline-block text-sm text-ink-500 hover:text-ink-700"
      >
        ← Back to survey
      </Link>
    </div>
  );
}
