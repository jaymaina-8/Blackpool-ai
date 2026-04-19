import {
  categorizeVideoError,
  type VideoErrorCategory,
} from "@/lib/video/job-display";

export type VideoFailureDisplay = {
  headline: string;
  reason: string;
  details?: string;
};

function reasonFromCategory(cat: VideoErrorCategory): string {
  switch (cat) {
    case "screenshot":
      return "A valid screenshot is required before generating a video.";
    case "timeout":
      return "The video took too long to generate. Try again.";
    case "storage":
      return "We could not read or save your files. Try again in a moment.";
    case "generation":
      return "The video provider had an issue. Try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

/** Maps API or stored errors to a short headline + reason; keeps raw text as optional details. */
export function formatVideoGenerationFailureMessage(
  raw: string | null | undefined,
  context?: { httpStatus?: number },
): VideoFailureDisplay {
  const headline = "❌ Video generation failed";
  const trimmed = raw?.trim();
  const status = context?.httpStatus;
  const lower = trimmed?.toLowerCase() ?? "";

  if (status === 401) {
    return {
      headline,
      reason: "Sign in to generate a video.",
      details: trimmed || undefined,
    };
  }

  if (status === 404) {
    return {
      headline,
      reason: "We could not find that lead or video job.",
      details: trimmed || undefined,
    };
  }

  if (status === 409) {
    return {
      headline,
      reason: "You already have a video job running. Finish it or wait, then try again.",
      details: trimmed || undefined,
    };
  }

  if (status === 429) {
    return {
      headline,
      reason: "Daily video limit reached. Try again tomorrow.",
      details: trimmed || undefined,
    };
  }

  if (status === 502 || status === 503 || status === 504) {
    return {
      headline,
      reason: "The video provider had an issue. Try again.",
      details: trimmed || undefined,
    };
  }

  if (
    lower.includes("no screenshot") ||
    lower.includes("quality validation") ||
    lower.includes("screenshot found")
  ) {
    return {
      headline,
      reason: "A valid screenshot is required before generating a video.",
      details: trimmed || undefined,
    };
  }

  if (
    lower.includes("timed out") ||
    lower.includes("60s end-to-end") ||
    lower.includes("timeout")
  ) {
    return {
      headline,
      reason: "The video took too long to generate. Try again.",
      details: trimmed || undefined,
    };
  }

  if (
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("bad gateway") ||
    lower.includes("service unavailable") ||
    lower.includes("ltx") ||
    lower.includes("video provider")
  ) {
    return {
      headline,
      reason: "The video provider had an issue. Try again.",
      details: trimmed || undefined,
    };
  }

  const cat = categorizeVideoError(trimmed);
  if (cat === "unknown") {
    if (trimmed) {
      const short = trimmed.length > 180 ? `${trimmed.slice(0, 177)}…` : trimmed;
      return {
        headline,
        reason: short,
        details: trimmed.length > 180 ? trimmed : undefined,
      };
    }
    if (status === 500) {
      return {
        headline,
        reason:
          "The server returned an unexpected error. Check the terminal logs and try again.",
        details: undefined,
      };
    }
  }

  return {
    headline,
    reason: reasonFromCategory(cat),
    details: trimmed || undefined,
  };
}

/** Stored job failures (no HTTP context). */
export function formatVideoFailureDisplay(
  raw: string | null | undefined,
): VideoFailureDisplay {
  return formatVideoGenerationFailureMessage(raw, {});
}
