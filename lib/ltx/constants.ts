/** Vertical 9:16 — LTX-2.3 models only (LTX-2 is landscape-only per docs). */
export const LTX_DEFAULT_BASE_URL = "https://api.ltx.video";

export const LTX_MODEL_FAST = "ltx-2-3-fast" as const;
export const LTX_MODEL_PRO = "ltx-2-3-pro" as const;

export type LtxModelId = typeof LTX_MODEL_FAST | typeof LTX_MODEL_PRO;

/** MVP: 8s within blueprint 6–8s max guidance. */
export const LTX_DEFAULT_DURATION_SEC = 8;

export const LTX_DEFAULT_RESOLUTION = "1080x1920";

export const LTX_DEFAULT_FPS = 24;

/**
 * In-route wait for LTX to return the MP4. Image-to-video often exceeds 30s;
 * keep below route `maxDuration` on hosts like Vercel (typically 60–300s).
 */
export const LTX_HTTP_TIMEOUT_MS = 180_000;

/**
 * Jobs stuck in pending/processing longer than this are failed by `/api/video-status`.
 * Must exceed {@link LTX_HTTP_TIMEOUT_MS} so in-flight generations are not killed by polling.
 */
export const VIDEO_JOB_MAX_AGE_MS = 300_000;

export const MAX_VIDEO_JOBS_PER_USER_PER_DAY = 5;
