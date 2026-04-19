import {
  LTX_MODEL_FAST,
  LTX_MODEL_PRO,
  LTX_DEFAULT_DURATION_SEC,
} from "@/lib/ltx/constants";
import type { VideoJob, VideoJobMetadata } from "@/lib/types/db";
import { resolveVideoJobMeta } from "@/lib/video/video-job-meta";

export type VideoErrorCategory =
  | "screenshot"
  | "generation"
  | "timeout"
  | "storage"
  | "unknown";

/** Maps backend messages to a short category for user-facing copy. */
export function categorizeVideoError(
  errorMessage: string | null | undefined,
): VideoErrorCategory {
  if (!errorMessage?.trim()) return "unknown";
  const m = errorMessage.toLowerCase();
  if (
    m.includes("no screenshot") ||
    m.includes("quality validation") ||
    m.includes("screenshot found")
  ) {
    return "screenshot";
  }
  if (m.includes("timed out") || m.includes("60s end-to-end")) {
    return "timeout";
  }
  if (
    m.includes("could not read screenshot from storage") ||
    m.includes("could not save video to storage") ||
    m.includes("storage:")
  ) {
    return "storage";
  }
  if (m.includes("ltx") || m.includes("video provider")) {
    return "generation";
  }
  return "unknown";
}

export function errorCategoryLabel(cat: VideoErrorCategory): string {
  switch (cat) {
    case "screenshot":
      return "Screenshot issue";
    case "timeout":
      return "Timeout or stale job";
    case "storage":
      return "Storage or upload";
    case "generation":
      return "Video provider / generation";
    default:
      return "Other";
  }
}

export function formatLtxModelLabel(meta: VideoJobMetadata | null | undefined): string {
  if (!meta?.ltx_model_id) return "—";
  const id = meta.ltx_model_id;
  if (id === LTX_MODEL_PRO) return "Pro — ltx-2-3-pro";
  if (id === LTX_MODEL_FAST) return "Fast — ltx-2-3-fast";
  return id;
}

export function formatDurationLabel(
  meta: VideoJobMetadata | null | undefined,
): string {
  const sec = meta?.duration_sec ?? LTX_DEFAULT_DURATION_SEC;
  return `${sec} seconds`;
}

export function formatLtxModelLabelForJob(
  job: VideoJob | null | undefined,
): string {
  return formatLtxModelLabel(resolveVideoJobMeta(job));
}

export function formatDurationLabelForJob(
  job: VideoJob | null | undefined,
): string {
  return formatDurationLabel(resolveVideoJobMeta(job));
}
