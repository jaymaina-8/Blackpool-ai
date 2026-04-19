import { createClient } from "@/lib/supabase/server";
import { buildVideoPrompt } from "@/lib/ltx/prompt-template";
import { requestImageToVideo, type ImageToVideoFailure } from "@/lib/ltx/client";
import {
  LTX_DEFAULT_DURATION_SEC,
  LTX_DEFAULT_RESOLUTION,
  LTX_HTTP_TIMEOUT_MS,
  LTX_MODEL_FAST,
  LTX_MODEL_PRO,
  MAX_VIDEO_JOBS_PER_USER_PER_DAY,
} from "@/lib/ltx/constants";
import {
  countActiveVideoJobsForUser,
  countTodaysVideoJobsForUser,
  fetchLeadIdsForUser,
  isDailyVideoLimitExceeded,
} from "@/lib/video/job-limits";
import { buildVideoJobPromptSnapshot } from "@/lib/video/video-job-meta";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Allow long-running LTX image-to-video on Vercel / similar hosts (seconds). */
export const maxDuration = 300;

const MAX_IMAGE_URI_BYTES = 7 * 1024 * 1024; // LTX docs: 7 MB for images (data URI)

type Body = {
  lead_id?: string;
  model_variant?: string;
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function jobJsonError(status: number, message: string, videoJobId: string) {
  return NextResponse.json(
    { error: message, video_job_id: videoJobId },
    { status },
  );
}

function logLine(
  phase: string,
  details: Record<string, string | number | null | undefined>,
) {
  const safe = Object.entries(details)
    .map(([k, v]) => `${k}=${v ?? ""}`)
    .join(" ");
  console.info(`[generate-video] ${phase} ${safe}`);
}

export async function POST(request: Request) {
  const apiKey = process.env.LTX_API_KEY?.trim();
  const baseUrl = process.env.LTX_API_BASE_URL?.trim();

  if (!apiKey) {
    return jsonError(
      503,
      "Video generation is not configured (missing LTX_API_KEY on the server).",
    );
  }

  try {
    return await runGenerateVideo(request, apiKey, baseUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected server error.";
    console.error("[generate-video] unhandled:", e);
    return jsonError(500, msg);
  }
}

async function runGenerateVideo(
  request: Request,
  apiKey: string,
  baseUrl: string | undefined,
) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const leadId = typeof body.lead_id === "string" ? body.lead_id.trim() : "";
  if (!leadId) {
    return jsonError(400, "lead_id is required.");
  }

  const variant =
    typeof body.model_variant === "string"
      ? body.model_variant.trim().toLowerCase()
      : "";
  const model = variant === "pro" ? LTX_MODEL_PRO : LTX_MODEL_FAST;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError(401, "You must be signed in to generate a video.");
  }

  const userTag = `user_${user.id.slice(0, 8)}`;
  logLine("start", { user: userTag, lead_id: leadId, model });

  let leadIds: string[];
  try {
    leadIds = await fetchLeadIdsForUser(supabase, user.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error.";
    return jsonError(500, msg);
  }

  let activeCount: number;
  let todayCount: number;
  try {
    [activeCount, todayCount] = await Promise.all([
      countActiveVideoJobsForUser(supabase, leadIds),
      countTodaysVideoJobsForUser(supabase, leadIds),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error.";
    return jsonError(500, msg);
  }

  if (activeCount > 0) {
    logLine("blocked_active_job", { user: userTag, active: activeCount });
    return jsonError(
      409,
      "You already have a video generation in progress. Wait for it to finish or use “Refresh status”.",
    );
  }

  if (isDailyVideoLimitExceeded(todayCount)) {
    logLine("blocked_daily_cap", {
      user: userTag,
      today: todayCount,
      cap: MAX_VIDEO_JOBS_PER_USER_PER_DAY,
    });
    return jsonError(
      429,
      `Daily video generation limit reached (${MAX_VIDEO_JOBS_PER_USER_PER_DAY} per day). Try again tomorrow.`,
    );
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, business_name, category, created_by")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError) {
    return jsonError(500, leadError.message || "Could not load this lead.");
  }
  if (!lead || lead.created_by !== user.id) {
    return jsonError(
      404,
      "Lead not found or you do not have permission to access it.",
    );
  }

  const { data: shot, error: shotError } = await supabase
    .from("assets")
    .select("storage_path, metadata")
    .eq("lead_id", leadId)
    .eq("type", "screenshot")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (shotError) {
    return jsonError(500, shotError.message || "Could not load screenshot.");
  }
  if (!shot?.storage_path) {
    return jsonError(
      400,
      "No screenshot found for this lead. Capture a valid screenshot before generating video.",
    );
  }

  const meta = shot.metadata as Record<string, unknown> | null;
  if (meta?.screenshot_quality_checked !== true) {
    return jsonError(
      400,
      "The latest screenshot did not pass quality validation. Capture a new screenshot before generating video.",
    );
  }

  const prompt = buildVideoPrompt();

  const promptSnapshot = buildVideoJobPromptSnapshot(prompt, {
    ltx_model_id: model,
    duration_sec: LTX_DEFAULT_DURATION_SEC,
  });

  const { data: jobRow, error: jobInsertError } = await supabase
    .from("video_jobs")
    .insert({
      lead_id: leadId,
      status: "pending",
      prompt_snapshot: promptSnapshot,
    })
    .select("id")
    .single();

  if (jobInsertError || !jobRow?.id) {
    return jsonError(
      500,
      jobInsertError?.message || "Could not create video job.",
    );
  }

  const videoJobId = jobRow.id as string;
  logLine("job_created", {
    user: userTag,
    lead_id: leadId,
    video_job_id: videoJobId,
  });

  const { error: procErr } = await supabase
    .from("video_jobs")
    .update({ status: "processing", error_message: null })
    .eq("id", videoJobId);

  if (procErr) {
    const msg = procErr.message || "Could not update video job.";
    await supabase
      .from("video_jobs")
      .update({ status: "failed", error_message: msg })
      .eq("id", videoJobId);
    await supabase.from("leads").update({ status: "error" }).eq("id", leadId);
    logLine("job_processing_update_failed", {
      video_job_id: videoJobId,
      err: procErr.message,
    });
    return jobJsonError(500, msg, videoJobId);
  }

  const { data: pngBlob, error: dlErr } = await supabase.storage
    .from("screenshots")
    .download(shot.storage_path);

  if (dlErr || !pngBlob) {
    const msg = `Could not read screenshot from storage: ${dlErr?.message ?? "unknown error"}`;
    await supabase
      .from("video_jobs")
      .update({ status: "failed", error_message: msg })
      .eq("id", videoJobId);
    await supabase.from("leads").update({ status: "error" }).eq("id", leadId);
    logLine("storage_download_failed", { video_job_id: videoJobId });
    return jobJsonError(502, msg, videoJobId);
  }

  const pngBuf = Buffer.from(await pngBlob.arrayBuffer());
  if (pngBuf.length > MAX_IMAGE_URI_BYTES) {
    const msg = "Screenshot file is too large for the video provider (max 7 MB).";
    await supabase
      .from("video_jobs")
      .update({ status: "failed", error_message: msg })
      .eq("id", videoJobId);
    await supabase.from("leads").update({ status: "error" }).eq("id", leadId);
    return jobJsonError(400, msg, videoJobId);
  }

  const imageUri = `data:image/png;base64,${pngBuf.toString("base64")}`;

  const runLtx = () =>
    requestImageToVideo({
      apiKey,
      baseUrl: baseUrl || undefined,
      imageUri,
      prompt,
      model,
      durationSec: LTX_DEFAULT_DURATION_SEC,
      resolution: LTX_DEFAULT_RESOLUTION,
      signal: AbortSignal.timeout(LTX_HTTP_TIMEOUT_MS),
    });

  logLine("ltx_attempt", { video_job_id: videoJobId, attempt: 1 });
  let result = await runLtx();

  const isSuccess = (r: typeof result): r is { mp4: Buffer; requestId: string | null } =>
    Boolean(r && "mp4" in r);

  const failPart = isSuccess(result) ? null : (result as ImageToVideoFailure);

  const retryable = Boolean(
    failPart &&
      (failPart.status === 502 ||
        failPart.status === 503 ||
        failPart.status === 504 ||
        failPart.status === 0),
  );

  let didAutoRetry = false;
  if (retryable) {
    didAutoRetry = true;
    logLine("ltx_retry", { video_job_id: videoJobId, attempt: 2 });
    await new Promise((r) => setTimeout(r, 2000));
    result = await runLtx();
  }

  if (!isSuccess(result)) {
    const fail = result as ImageToVideoFailure | null;
    const detail = fail?.message ?? "LTX request failed.";
    const appended =
      didAutoRetry && fail
        ? `${detail}\n(One automatic retry was attempted.)`
        : detail;
    await supabase
      .from("video_jobs")
      .update({
        status: "failed",
        error_message: appended,
        ltx_job_id: null,
      })
      .eq("id", videoJobId);
    await supabase.from("leads").update({ status: "error" }).eq("id", leadId);
    logLine("ltx_failed", {
      video_job_id: videoJobId,
      status: fail?.status ?? "unknown",
    });
    return jobJsonError(502, appended, videoJobId);
  }

  const success = result;
  const renderPath = `${leadId}/${videoJobId}.mp4`;

  const { error: upErr } = await supabase.storage
    .from("renders")
    .upload(renderPath, success.mp4, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (upErr) {
    const msg = `Could not save video to storage: ${upErr.message}`;
    await supabase
      .from("video_jobs")
      .update({ status: "failed", error_message: msg })
      .eq("id", videoJobId);
    await supabase.from("leads").update({ status: "error" }).eq("id", leadId);
    logLine("render_upload_failed", { video_job_id: videoJobId });
    return jobJsonError(502, msg, videoJobId);
  }

  await supabase
    .from("video_jobs")
    .update({
      status: "completed",
      ltx_job_id: success.requestId,
      render_storage_path: renderPath,
      error_message: null,
    })
    .eq("id", videoJobId);

  await supabase.from("leads").update({ status: "video_ready" }).eq("id", leadId);

  logLine("complete", {
    user: userTag,
    lead_id: leadId,
    video_job_id: videoJobId,
    ltx_request_id: success.requestId,
  });

  return NextResponse.json({
    video_job_id: videoJobId,
    status: "completed",
  });
}
