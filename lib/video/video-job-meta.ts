import type { VideoJob, VideoJobMetadata } from "@/lib/types/db";

/** First line prefix so model/duration work without a `video_jobs.metadata` column. */
const META_LINE_PREFIX = "__VIDEO_JOB_META__:";

/** Persist LTX model + duration alongside the user prompt (survives pre-metadata DBs). */
export function buildVideoJobPromptSnapshot(
  userPrompt: string,
  meta: VideoJobMetadata,
): string {
  return `${META_LINE_PREFIX}${JSON.stringify(meta)}\n${userPrompt}`;
}

export function parseVideoJobMetaFromSnapshot(
  promptSnapshot: string | null | undefined,
): VideoJobMetadata | null {
  if (!promptSnapshot) return null;
  const firstLine = promptSnapshot.split("\n", 1)[0] ?? "";
  if (!firstLine.startsWith(META_LINE_PREFIX)) return null;
  try {
    const j = JSON.parse(
      firstLine.slice(META_LINE_PREFIX.length),
    ) as VideoJobMetadata;
    if (j && typeof j === "object") return j;
  } catch {
    return null;
  }
  return null;
}

/** Prefer `video_jobs.metadata` when the column exists; otherwise parse from `prompt_snapshot`. */
export function resolveVideoJobMeta(
  job: VideoJob | null | undefined,
): VideoJobMetadata | null {
  if (!job) return null;
  const m = job.metadata;
  if (
    m &&
    typeof m === "object" &&
    typeof m.ltx_model_id === "string" &&
    m.ltx_model_id.length > 0
  ) {
    return m;
  }
  return parseVideoJobMetaFromSnapshot(job.prompt_snapshot);
}
