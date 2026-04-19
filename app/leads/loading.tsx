export default function LeadsLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="animate-pulse space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-7 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-10 w-28 rounded-md bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="h-px border-b border-zinc-200 dark:border-zinc-800" />
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-b border-zinc-200 px-4 py-4 last:border-b-0 dark:border-zinc-800"
            >
              <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-4 h-3 w-full max-w-full rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-3 h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        Loading leads…
      </p>
    </div>
  );
}
