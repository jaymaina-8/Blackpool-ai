"use client";

import type { VideoJob } from "@/lib/types/db";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const POLL_MS = 6000;

type PollArgs = {
  jobId: string | null | undefined;
  status: string | undefined;
  onUpdate: (job: VideoJob) => void;
};

/**
 * Client-side status refresh while a video job is pending or processing.
 * Stops when the job completes, fails, or the component unmounts.
 */
export function useVideoJobPolling({ jobId, status, onUpdate }: PollArgs) {
  const router = useRouter();
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!jobId) return;
    if (status !== "pending" && status !== "processing") return;

    const tick = async () => {
      try {
        const res = await fetch("/api/video-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_job_id: jobId }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          job?: VideoJob;
        };
        if (res.ok && data.job) {
          onUpdateRef.current(data.job);
          router.refresh();
        }
      } catch {
        /* ignore transient network errors during polling */
      }
    };

    const id = window.setInterval(() => {
      void tick();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [jobId, status, router]);
}
