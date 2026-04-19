"use client";

import { VideoJobStatus } from "@/components/VideoJobStatus";
import { useVideoJobPolling } from "@/hooks/useVideoJobPolling";
import type { VideoJob } from "@/lib/types/db";
import { formatVideoGenerationFailureMessage } from "@/lib/video/user-messages";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type UserVideoBlock = "none" | "active" | "daily";

type Props = {
  leadId: string;
  screenshotReady: boolean;
  userVideoBlock: UserVideoBlock;
  initialLatestJob: VideoJob | null;
};

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? ""}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function scrollToVideoResult() {
  const el = document.getElementById("lead-video-result");
  el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  window.dispatchEvent(new CustomEvent("lead-video-ready"));
}

export function GenerateVideoSection({
  leadId,
  screenshotReady,
  userVideoBlock,
  initialLatestJob,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [checkBusy, setCheckBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usePro, setUsePro] = useState(false);
  const [latestJob, setLatestJob] = useState<VideoJob | null>(initialLatestJob);

  const prevStatusRef = useRef<string | null>(null);
  const primedRef = useRef(false);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const generationInProgressRef = useRef(false);

  useEffect(() => {
    setLatestJob(initialLatestJob);
  }, [initialLatestJob]);

  const activeHere =
    latestJob?.status === "pending" || latestJob?.status === "processing";
  const globalBlock =
    userVideoBlock === "active" || userVideoBlock === "daily";

  useVideoJobPolling({
    jobId: latestJob?.id,
    status: latestJob?.status,
    onUpdate: (job) => {
      setLatestJob(job);
    },
  });

  useEffect(() => {
    const s = latestJob?.status ?? null;
    if (!primedRef.current) {
      primedRef.current = true;
      prevStatusRef.current = s;
      return;
    }
    const prev = prevStatusRef.current;
    if (
      s === "completed" &&
      (prev === "pending" || prev === "processing")
    ) {
      scrollToVideoResult();
    }
    prevStatusRef.current = s;
  }, [latestJob?.status]);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.focus();
  }, [error]);

  async function pollJobOnce(videoJobId: string): Promise<VideoJob | null> {
    const res = await fetch("/api/video-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_job_id: videoJobId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      job?: VideoJob;
    };
    if (!res.ok) return null;
    return data.job ?? null;
  }

  async function loadJobFromApi(
    videoJobId: string,
    opts?: { scrollIfCompleted?: boolean },
  ) {
    const job = await pollJobOnce(videoJobId);
    if (job) {
      setLatestJob(job);
      if (
        opts?.scrollIfCompleted &&
        job.status === "completed" &&
        generationInProgressRef.current
      ) {
        scrollToVideoResult();
      }
      router.refresh();
    }
  }

  async function refreshStatus() {
    if (!latestJob?.id) return;
    setError(null);
    setCheckBusy(true);
    try {
      const res = await fetch("/api/video-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_job_id: latestJob.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        job?: VideoJob;
      };
      if (!res.ok) {
        const formatted = formatVideoGenerationFailureMessage(
          data.error || "Could not refresh video status.",
          { httpStatus: res.status },
        );
        setError(
          `${formatted.headline}\nReason: ${formatted.reason}` +
            (formatted.details
              ? `\n\nDetails (optional):\n${formatted.details}`
              : ""),
        );
        return;
      }
      if (data.job) {
        setLatestJob(data.job);
      }
      router.refresh();
    } catch {
      const formatted = formatVideoGenerationFailureMessage(
        "Network error while checking status.",
      );
      setError(
        `${formatted.headline}\nReason: ${formatted.reason}` +
          (formatted.details
            ? `\n\nDetails (optional):\n${formatted.details}`
            : ""),
      );
    } finally {
      setCheckBusy(false);
    }
  }

  async function generate() {
    setError(null);
    setBusy(true);
    generationInProgressRef.current = true;
    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          model_variant: usePro ? "pro" : "fast",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        video_job_id?: string;
        status?: string;
      };

      if (!res.ok) {
        if (data.video_job_id) {
          await loadJobFromApi(data.video_job_id);
          // Failure is stored on video_jobs.error_message — avoid duplicating in the alert above.
          setError(null);
        } else {
          const rawError =
            data.error?.trim() ||
            data.message?.trim() ||
            (res.status ? `Request failed (HTTP ${res.status}).` : undefined);
          const formatted = formatVideoGenerationFailureMessage(rawError, {
            httpStatus: res.status,
          });
          setError(
            `${formatted.headline}\nReason: ${formatted.reason}` +
              (formatted.details
                ? `\n\nDetails (optional):\n${formatted.details}`
                : ""),
          );
        }
        setBusy(false);
        generationInProgressRef.current = false;
        router.refresh();
        return;
      }

      if (data.video_job_id) {
        await loadJobFromApi(data.video_job_id, { scrollIfCompleted: true });
      }
      setBusy(false);
      generationInProgressRef.current = false;
      router.refresh();
    } catch {
      setBusy(false);
      generationInProgressRef.current = false;
      const formatted = formatVideoGenerationFailureMessage(
        "Network error while generating. Check your connection and retry.",
      );
      setError(
        `${formatted.headline}\nReason: ${formatted.reason}` +
          (formatted.details
            ? `\n\nDetails (optional):\n${formatted.details}`
            : ""),
      );
    }
  }

  const canAttempt =
    screenshotReady && !globalBlock && !activeHere && !busy;

  const blockMessage =
    userVideoBlock === "active" && !activeHere
      ? "You already have a video job in progress on another lead. Open that lead or wait until it finishes."
      : userVideoBlock === "daily"
        ? "Daily video generation limit reached. Try again tomorrow."
        : null;

  const primaryLabel = (() => {
    if (busy) return "Generating video…";
    if (!screenshotReady) return "Generate Video (screenshot required)";
    if (userVideoBlock === "daily") return "Generate Video (daily limit reached)";
    if (userVideoBlock === "active" && !activeHere) {
      return "Generate Video (job in progress)";
    }
    if (activeHere) return "Generate Video (job in progress)";
    if (latestJob?.status === "failed") return "Retry Generation";
    return "Generate Video";
  })();

  return (
    <div
      id="lead-generate-video"
      className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <p className="mt-0 text-sm text-zinc-600 dark:text-zinc-400">
        Creates a short vertical promo from your validated screenshot. Each run
        is a new job; previous attempts stay in history.
      </p>

      <div className="mt-4 space-y-4">
        <div
          className={`rounded-md border p-3 text-sm ${
            screenshotReady
              ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
              : "border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20"
          }`}
          role="status"
        >
          <p className="font-medium text-zinc-900 dark:text-zinc-100">
            Screenshot
          </p>
          <p className="mt-1 text-zinc-700 dark:text-zinc-300">
            {screenshotReady ? (
              <>Validated screenshot ready — you can generate a video.</>
            ) : (
              <>
                Add a <strong>validated</strong> screenshot in step 3 before
                generating a video.
              </>
            )}
          </p>
        </div>

        {blockMessage ? (
          <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
            {blockMessage}
          </p>
        ) : null}

        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={usePro}
            onChange={(e) => setUsePro(e.target.checked)}
            disabled={busy || activeHere}
            className="rounded border-zinc-300 dark:border-zinc-600"
          />
          Pro model (higher quality, slower)
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!canAttempt}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? (
              <Spinner className="h-4 w-4 text-white dark:text-zinc-900" />
            ) : null}
            <span>{primaryLabel}</span>
          </button>
          {latestJob?.id ? (
            <button
              type="button"
              onClick={() => void refreshStatus()}
              disabled={checkBusy}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {checkBusy ? (
                <>
                  <Spinner className="mr-2 h-4 w-4 text-zinc-700 dark:text-zinc-200" />
                  Refreshing…
                </>
              ) : (
                "Refresh status"
              )}
            </button>
          ) : null}
        </div>

        {activeHere ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Generating your video… Status updates every few seconds. You can also
            use <strong>Refresh status</strong> anytime.
          </p>
        ) : null}

        {error ? (
          <div
            ref={errorRef}
            tabIndex={-1}
            className="rounded-md border border-red-200 bg-red-50/90 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
            role="alert"
          >
            <p className="whitespace-pre-wrap font-medium">{error}</p>
          </div>
        ) : null}

        {latestJob ? (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
            <VideoJobStatus
              status={latestJob.status}
              errorMessage={latestJob.error_message}
              createdAt={latestJob.created_at}
            />
            {latestJob.status === "failed" ? (
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                Fix the issue if needed, then use <strong>Retry Generation</strong>{" "}
                — a new job is created; this row stays in history.
              </p>
            ) : null}
          </div>
        ) : (
          <div
            className="rounded-md border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-300"
            role="status"
          >
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              No video generated yet
            </p>
            <p className="mt-1">
              Generate a video to preview your business content. When you start
              a run, live status appears here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
