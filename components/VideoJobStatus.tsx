import { formatVideoFailureDisplay } from "@/lib/video/user-messages";
import { VIDEO_JOB_MAX_AGE_MS } from "@/lib/ltx/constants";

function statusHeading(status: string): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "processing":
      return "Processing";
    case "completed":
      return "Video ready";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function statusDescription(status: string): string {
  switch (status) {
    case "pending":
      return "Your job is queued and will start shortly.";
    case "processing":
      return "Hang tight — this usually finishes within about a minute.";
    case "completed":
      return "Your MP4 is saved. Preview it in step 5.";
    case "failed":
      return "This run did not produce a video.";
    default:
      return "Status was updated.";
  }
}

function statusColor(status: string): string {
  if (status === "completed") {
    return "text-emerald-700 dark:text-emerald-400";
  }
  if (status === "failed") {
    return "text-red-600 dark:text-red-400";
  }
  if (status === "processing" || status === "pending") {
    return "text-amber-700 dark:text-amber-400";
  }
  return "text-zinc-700 dark:text-zinc-300";
}

export function VideoJobStatus({
  status,
  errorMessage,
  createdAt,
}: {
  status: string;
  errorMessage: string | null;
  createdAt: string;
}) {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const active = status === "pending" || status === "processing";
  const looksStale = active && ageMs > VIDEO_JOB_MAX_AGE_MS;

  const failureDisplay =
    status === "failed" ? formatVideoFailureDisplay(errorMessage) : null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Current job
        </p>
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          <span className={`font-semibold ${statusColor(status)}`}>
            {statusHeading(status)}
          </span>
          {status === "failed" ? null : (
            <>
              <span className="text-zinc-500"> — </span>
              {statusDescription(status)}
            </>
          )}
        </p>
      </div>

      {active ? (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Running about {Math.max(1, Math.round(ageMs / 1000))}s
          {looksStale ? (
            <>
              . No update for over {Math.round(VIDEO_JOB_MAX_AGE_MS / 1000)}s —
              tap <strong>Refresh status</strong>. The server may mark this run
              failed so you can retry.
            </>
          ) : (
            <>
              . You can leave this page open; tap <strong>Refresh status</strong>{" "}
              if nothing changes.
            </>
          )}
        </p>
      ) : null}

      {status === "failed" && failureDisplay ? (
        <div
          className="rounded-md border border-red-200 bg-red-50/80 p-3 dark:border-red-900/50 dark:bg-red-950/30"
          role="alert"
          tabIndex={-1}
        >
          <p className="text-sm text-red-900 dark:text-red-100">
            <span className="font-semibold">Reason:</span> {failureDisplay.reason}
          </p>
          {failureDisplay.details ? (
            <>
              <p className="mt-3 text-xs font-medium text-red-800 dark:text-red-200">
                Details
              </p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-sm text-red-900 dark:text-red-100">
                {failureDisplay.details}
              </pre>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
