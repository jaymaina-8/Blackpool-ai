import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadDetailCard } from "@/components/LeadDetailCard";
import { createClient } from "@/lib/supabase/server";
import {
  countActiveVideoJobsForUser,
  countTodaysVideoJobsForUser,
  fetchLeadIdsForUser,
  isDailyVideoLimitExceeded,
} from "@/lib/video/job-limits";
import type { UserVideoBlock } from "@/components/GenerateVideoSection";
import type { Lead, VideoJob } from "@/lib/types/db";

const JOB_SELECT =
  "id, created_at, updated_at, lead_id, status, ltx_job_id, error_message, render_storage_path, prompt_snapshot";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: leadRow, error: leadError } = await supabase
    .from("leads")
    .select(
      "id, created_at, updated_at, created_by, business_name, website_url, category, status",
    )
    .eq("id", id)
    .maybeSingle();

  if (leadError || !leadRow) {
    notFound();
  }

  const lead = leadRow as Lead;

  const { data: logoRows } = await supabase
    .from("assets")
    .select("storage_path")
    .eq("lead_id", id)
    .eq("type", "logo")
    .order("created_at", { ascending: false })
    .limit(1);

  const logoStoragePath = logoRows?.[0]?.storage_path;
  let logoSignedUrl: string | null = null;
  if (logoStoragePath) {
    const { data: signed } = await supabase.storage
      .from("logos")
      .createSignedUrl(logoStoragePath, 3600);
    logoSignedUrl = signed?.signedUrl ?? null;
  }

  const { data: screenshotRows } = await supabase
    .from("assets")
    .select("storage_path, metadata")
    .eq("lead_id", id)
    .eq("type", "screenshot")
    .order("created_at", { ascending: false })
    .limit(1);

  const screenshotStoragePath = screenshotRows?.[0]?.storage_path;
  const screenshotMeta = screenshotRows?.[0]?.metadata as
    | Record<string, unknown>
    | null
    | undefined;
  const screenshotReady = screenshotMeta?.screenshot_quality_checked === true;

  let screenshotSignedUrl: string | null = null;
  if (screenshotStoragePath) {
    const { data: signedShot } = await supabase.storage
      .from("screenshots")
      .createSignedUrl(screenshotStoragePath, 3600);
    screenshotSignedUrl = signedShot?.signedUrl ?? null;
  }

  const { data: latestJobRows } = await supabase
    .from("video_jobs")
    .select(JOB_SELECT)
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestVideoJob =
    (latestJobRows?.[0] as VideoJob | undefined) ?? null;

  const { data: completedJobRows } = await supabase
    .from("video_jobs")
    .select(JOB_SELECT)
    .eq("lead_id", id)
    .eq("status", "completed")
    .not("render_storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestCompletedJob =
    (completedJobRows?.[0] as VideoJob | undefined) ?? null;

  const { data: recentJobRows } = await supabase
    .from("video_jobs")
    .select(JOB_SELECT)
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(8);

  const previousVideoJobs = (recentJobRows ?? []) as VideoJob[];

  let resultVideoSignedUrl: string | null = null;
  if (
    latestCompletedJob?.status === "completed" &&
    latestCompletedJob.render_storage_path
  ) {
    const { data: signedVid } = await supabase.storage
      .from("renders")
      .createSignedUrl(latestCompletedJob.render_storage_path, 3600);
    resultVideoSignedUrl = signedVid?.signedUrl ?? null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userVideoBlock: UserVideoBlock = "none";
  if (user) {
    try {
      const leadIds = await fetchLeadIdsForUser(supabase, user.id);
      const [active, today] = await Promise.all([
        countActiveVideoJobsForUser(supabase, leadIds),
        countTodaysVideoJobsForUser(supabase, leadIds),
      ]);
      if (active > 0) {
        userVideoBlock = "active";
      } else if (isDailyVideoLimitExceeded(today)) {
        userVideoBlock = "daily";
      }
    } catch {
      userVideoBlock = "none";
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/leads"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to leads
        </Link>
      </div>
      <LeadDetailCard
        lead={lead}
        logoSignedUrl={logoSignedUrl}
        screenshotSignedUrl={screenshotSignedUrl}
        screenshotReady={screenshotReady}
        userVideoBlock={userVideoBlock}
        latestVideoJob={latestVideoJob}
        latestCompletedJob={latestCompletedJob}
        previousVideoJobs={previousVideoJobs}
        resultVideoSignedUrl={resultVideoSignedUrl}
      />
    </div>
  );
}
