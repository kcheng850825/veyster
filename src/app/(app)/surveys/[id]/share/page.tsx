import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { getServerSupabase } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/base-url";
import { CopyButton } from "@/components/CopyButton";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: survey } = await supabase
    .from("surveys")
    .select("id, title, share_slug, status, owner_id")
    .eq("id", id)
    .eq("owner_id", userData.user.id)
    .maybeSingle();

  if (!survey) notFound();

  const shareUrl = `${await getBaseUrl()}/s/${survey.share_slug}`;
  const qrDataUrl = await QRCode.toDataURL(shareUrl, {
    width: 320,
    margin: 1,
    color: { dark: "#111827", light: "#ffffff" },
  });

  return (
    <div className="max-w-lg mx-auto text-center space-y-6">
      <div>
        <div className="text-xs uppercase tracking-wide text-gray-500">Share</div>
        <h1 className="text-2xl font-bold">{survey.title}</h1>
        {survey.status !== "open" && (
          <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            This survey is <strong>{survey.status}</strong>. Open it before sharing.
          </p>
        )}
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 inline-block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="QR code" width={320} height={320} />
      </div>

      <div className="space-y-2">
        <div className="text-xs text-gray-500">Shareable URL</div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 rounded-xl border border-gray-300 px-3 py-2 font-mono text-sm bg-gray-50"
          />
          <CopyButton text={shareUrl} />
        </div>
      </div>

      <Link
        href={`/surveys/${survey.id}`}
        className="inline-block text-sm text-gray-500 hover:text-gray-700"
      >
        ← Back to survey
      </Link>
    </div>
  );
}
