export default function LeadDetailLoading() {
  return (
    <div className="animate-pulse space-y-12" aria-busy="true" aria-live="polite">
      <div className="h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-full max-w-md rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
        <div className="sm:pl-12">
          <div className="h-40 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="sm:pl-12">
          <div className="h-32 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading lead…</p>
    </div>
  );
}
