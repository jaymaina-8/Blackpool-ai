import type { VideoJob } from "@/lib/types/db";
import {
  formatLtxModelLabelForJob,
} from "@/lib/video/job-display";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function statusStyle(status: string) {
  switch (status) {
    case "completed":
      return "text-emerald-700 dark:text-emerald-400";
    case "failed":
      return "text-red-600 dark:text-red-400";
    case "pending":
    case "processing":
      return "text-amber-700 dark:text-amber-400";
    default:
      return "text-zinc-700 dark:text-zinc-300";
  }
}

export function PreviousVideoAttempts({
  jobs,
  latestJobId,
}: {
  jobs: VideoJob[];
  latestJobId: string | null;
}) {
  if (jobs.length <= 1) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/20">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        History
      </h3>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Each run is its own row. Older attempts stay for reference.
      </p>
      <ul className="mt-3 space-y-2">
        {jobs.map((job) => {
          const isLatest = job.id === latestJobId;
          const hasRender =
            job.status === "completed" && Boolean(job.render_storage_path);
          return (
            <li
              key={job.id}
              className="rounded border border-zinc-200 bg-white/80 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {formatWhen(job.created_at)}
                  {isLatest ? (
                    <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                      Latest job
                    </span>
                  ) : null}
                </span>
                <span className={`font-medium ${statusStyle(job.status)}`}>
                  {job.status}
                </span>
              </div>
              <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                Model: {formatLtxModelLabelForJob(job)} · MP4:{" "}
                {hasRender ? "yes" : "no"}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
