import { createClient } from "@/lib/supabase/server";
import { VIDEO_JOB_MAX_AGE_MS } from "@/lib/ltx/constants";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  video_job_id?: string;
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function logLine(
  phase: string,
  details: Record<string, string | number | null | undefined>,
) {
  const safe = Object.entries(details)
    .map(([k, v]) => `${k}=${v ?? ""}`)
    .join(" ");
  console.info(`[video-status] ${phase} ${safe}`);
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const videoJobId =
    typeof body.video_job_id === "string" ? body.video_job_id.trim() : "";
  if (!videoJobId) {
    return jsonError(400, "video_job_id is required.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError(401, "You must be signed in.");
  }

  const userTag = `user_${user.id.slice(0, 8)}`;
  logLine("start", { user: userTag, video_job_id: videoJobId });

  const { data: job, error: jobError } = await supabase
    .from("video_jobs")
    .select(
      "id, created_at, updated_at, lead_id, status, ltx_job_id, error_message, render_storage_path, prompt_snapshot",
    )
    .eq("id", videoJobId)
    .maybeSingle();

  if (jobError) {
    return jsonError(500, jobError.message || "Could not load video job.");
  }
  if (!job) {
    return jsonError(404, "Video job not found.");
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, created_by")
    .eq("id", job.lead_id)
    .maybeSingle();

  if (leadError || !lead || lead.created_by !== user.id) {
    return jsonError(404, "Video job not found or access denied.");
  }

  const ageMs = Date.now() - new Date(job.created_at).getTime();
  const stuck =
    (job.status === "pending" || job.status === "processing") &&
    ageMs > VIDEO_JOB_MAX_AGE_MS;

  let effectiveJob = job;

  if (stuck) {
    const msg =
      "Timed out waiting for video generation (60s end-to-end). Retry manually.";
    await supabase
      .from("video_jobs")
      .update({ status: "failed", error_message: msg })
      .eq("id", videoJobId);
    await supabase.from("leads").update({ status: "error" }).eq("id", job.lead_id);
    logLine("marked_stale_failed", { video_job_id: videoJobId, age_ms: ageMs });
    const { data: refreshed } = await supabase
      .from("video_jobs")
      .select(
        "id, created_at, updated_at, lead_id, status, ltx_job_id, error_message, render_storage_path, prompt_snapshot",
      )
      .eq("id", videoJobId)
      .maybeSingle();
    if (refreshed) {
      effectiveJob = refreshed;
    }
  }

  let render_signed_url: string | null = null;
  if (effectiveJob.status === "completed" && effectiveJob.render_storage_path) {
    const { data: signed, error: signErr } = await supabase.storage
      .from("renders")
      .createSignedUrl(effectiveJob.render_storage_path, 3600);
    if (signErr) {
      logLine("signed_url_failed", {
        video_job_id: videoJobId,
        err: signErr.message,
      });
    } else {
      render_signed_url = signed?.signedUrl ?? null;
    }
  }

  logLine("done", {
    user: userTag,
    video_job_id: videoJobId,
    status: effectiveJob.status,
  });

  return NextResponse.json({
    job: effectiveJob,
    render_signed_url,
  });
}
