"use client";

import type { VideoJob } from "@/lib/types/db";
import {
  formatDurationLabelForJob,
  formatLtxModelLabelForJob,
} from "@/lib/video/job-display";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

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

type Props = {
  latestCompletedJob: VideoJob | null;
  initialVideoSignedUrl: string | null;
};

export function VideoResultCard({
  latestCompletedJob,
  initialVideoSignedUrl,
}: Props) {
  const router = useRouter();
  const [videoSignedUrl, setVideoSignedUrl] = useState<string | null>(
    initialVideoSignedUrl,
  );
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsManualRefresh, setNeedsManualRefresh] = useState(false);
  const [autoRecovering, setAutoRecovering] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const autoRecoverAttempted = useRef(false);
  const didInitialUrlFetch = useRef<string | null>(null);

  useEffect(() => {
    setVideoSignedUrl(initialVideoSignedUrl);
  }, [initialVideoSignedUrl]);

  useEffect(() => {
    autoRecoverAttempted.current = false;
  }, [videoSignedUrl]);

  useEffect(() => {
    const onReady = () => setHighlight(true);
    window.addEventListener("lead-video-ready", onReady);
    return () => window.removeEventListener("lead-video-ready", onReady);
  }, []);

  useEffect(() => {
    if (!highlight) return;
    const t = window.setTimeout(() => setHighlight(false), 4000);
    return () => window.clearTimeout(t);
  }, [highlight]);

  const refreshSignedUrl = useCallback(async (): Promise<boolean> => {
    const jobId = latestCompletedJob?.id;
    if (!jobId) return false;
    setError(null);
    setRefreshBusy(true);
    try {
      const res = await fetch("/api/video-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_job_id: jobId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        render_signed_url?: string | null;
      };
      if (!res.ok) {
        setError(data.error || "Could not refresh the preview link.");
        setNeedsManualRefresh(true);
        return false;
      }
      if (data.render_signed_url) {
        setVideoSignedUrl(data.render_signed_url);
        setNeedsManualRefresh(false);
        router.refresh();
        return true;
      }
      setError(
        "No new link returned. Refresh the page if playback still fails.",
      );
      setNeedsManualRefresh(true);
      return false;
    } catch {
      setError("Network error while refreshing the preview link.");
      setNeedsManualRefresh(true);
      return false;
    } finally {
      setRefreshBusy(false);
    }
  }, [latestCompletedJob?.id, router]);

  const hasRender =
    latestCompletedJob?.status === "completed" &&
    Boolean(latestCompletedJob.render_storage_path);

  useEffect(() => {
    const jobId = latestCompletedJob?.id;
    if (!jobId || !hasRender) return;
    if (initialVideoSignedUrl) return;
    if (didInitialUrlFetch.current === jobId) return;
    didInitialUrlFetch.current = jobId;
    void refreshSignedUrl();
  }, [hasRender, initialVideoSignedUrl, latestCompletedJob?.id, refreshSignedUrl]);

  async function handleVideoError() {
    if (!latestCompletedJob?.id) {
      setNeedsManualRefresh(true);
      return;
    }
    if (!videoSignedUrl) {
      setNeedsManualRefresh(true);
      return;
    }
    if (autoRecoverAttempted.current) {
      setNeedsManualRefresh(true);
      return;
    }
    autoRecoverAttempted.current = true;
    setAutoRecovering(true);
    const ok = await refreshSignedUrl();
    setAutoRecovering(false);
    if (!ok) setNeedsManualRefresh(true);
  }

  const previewLoading = refreshBusy || autoRecovering;

  if (!hasRender) {
    return (
      <div
        className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center dark:border-zinc-600 dark:bg-zinc-900/30"
        role="status"
      >
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          No video generated yet
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Generate a video to preview your business content. When a run succeeds,
          the MP4 appears here.
        </p>
      </div>
    );
  }

  return (
    <div
      id="lead-video-result"
      className={`rounded-lg border border-zinc-200 bg-white p-4 transition-shadow duration-500 dark:border-zinc-800 dark:bg-zinc-950 ${
        highlight
          ? "ring-2 ring-emerald-400/80 ring-offset-2 ring-offset-white dark:ring-emerald-500/60 dark:ring-offset-zinc-950"
          : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Latest render
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Most recent successful MP4 for this lead.
          </p>
          {highlight ? (
            <p
              className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"
              role="status"
            >
              ✅ Video ready
            </p>
          ) : null}
        </div>
        {needsManualRefresh ? (
          <button
            type="button"
            onClick={() => void refreshSignedUrl()}
            disabled={refreshBusy}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200"
          >
            {refreshBusy ? (
              <Spinner className="h-4 w-4 text-zinc-700 dark:text-zinc-200" />
            ) : null}
            Refresh preview
          </button>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-2 text-xs text-zinc-600 dark:text-zinc-400 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-zinc-500 dark:text-zinc-500">
            Created
          </dt>
          <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">
            {formatWhen(latestCompletedJob.created_at)}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500 dark:text-zinc-500">
            Model
          </dt>
          <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">
            {formatLtxModelLabelForJob(latestCompletedJob)}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500 dark:text-zinc-500">
            Duration (requested)
          </dt>
          <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">
            {formatDurationLabelForJob(latestCompletedJob)}
          </dd>
        </div>
      </dl>

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {previewLoading ? (
        <div
          className="mt-4 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400"
          role="status"
          aria-live="polite"
        >
          <Spinner className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
          Loading preview…
        </div>
      ) : null}

      {videoSignedUrl ? (
        <div className={`mt-4 space-y-3 ${previewLoading ? "opacity-60" : ""}`}>
          <video
            key={videoSignedUrl}
            src={videoSignedUrl}
            controls
            playsInline
            className="max-h-[min(480px,70vh)] w-full rounded-md border border-zinc-200 bg-black dark:border-zinc-700"
            onError={() => void handleVideoError()}
          />
          <a
            href={videoSignedUrl}
            download
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Download MP4
          </a>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Preview links expire after about an hour. If playback stops, we refresh
            the link automatically once; use <strong>Refresh preview</strong> if it
            still fails.
          </p>
        </div>
      ) : !previewLoading ? (
        <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">
          {needsManualRefresh
            ? "Could not load a preview link. Tap Refresh preview to try again."
            : "Preparing preview…"}
        </p>
      ) : null}
    </div>
  );
}
