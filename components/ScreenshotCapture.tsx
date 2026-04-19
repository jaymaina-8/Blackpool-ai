"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  leadId: string;
  initialSignedUrl: string | null;
};

export function ScreenshotCapture({ leadId, initialSignedUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const awaitingFreshUrl = useRef(false);
  const signedUrlBeforeCapture = useRef<string | null>(null);

  useEffect(() => {
    if (!awaitingFreshUrl.current) return;
    if (initialSignedUrl !== signedUrlBeforeCapture.current) {
      awaitingFreshUrl.current = false;
      setBusy(false);
    }
  }, [initialSignedUrl]);

  async function capture() {
    setError(null);
    setBusy(true);
    signedUrlBeforeCapture.current = initialSignedUrl;
    try {
      const res = await fetch("/api/capture-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        /** Present in development only (server sends for uncaught errors). */
        debug?: string;
      };

      if (!res.ok) {
        setBusy(false);
        const base =
          data.error ||
          (res.status === 401
            ? "You must be signed in."
            : "Screenshot capture failed.");
        setError(data.debug ? `${base} — ${data.debug}` : base);
        return;
      }

      awaitingFreshUrl.current = true;
      router.refresh();
      window.setTimeout(() => {
        if (!awaitingFreshUrl.current) return;
        awaitingFreshUrl.current = false;
        setBusy(false);
      }, 15_000);
    } catch {
      setBusy(false);
      setError("Network error while capturing. Check your connection and retry.");
    }
  }

  const hasPreview = Boolean(initialSignedUrl);
  const primaryLabel = hasPreview ? "Retake screenshot" : "Capture screenshot";

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Desktop capture (1440×900). Invalid or empty shots are rejected — you can
        retry anytime.
      </p>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void capture()}
            disabled={busy}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? (
              <Spinner className="h-4 w-4 text-white dark:text-zinc-900" />
            ) : null}
            {busy ? "Capturing…" : primaryLabel}
          </button>
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            {busy ? (
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                Working…
              </span>
            ) : error ? (
              <span className="font-medium text-red-600 dark:text-red-400">
                Failed
              </span>
            ) : hasPreview ? (
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                Ready
              </span>
            ) : (
              <span className="font-medium text-zinc-600 dark:text-zinc-400">
                No screenshot yet
              </span>
            )}
          </span>
        </div>

        {busy ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400" role="status">
            Capturing your site — usually under 10 seconds…
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {hasPreview ? (
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={initialSignedUrl!}
              alt="Website screenshot preview"
              className="max-h-[480px] w-full object-contain object-top"
            />
          </div>
        ) : (
          <div
            className="rounded-md border border-dashed border-zinc-300 bg-white/60 p-6 text-center dark:border-zinc-600 dark:bg-zinc-950/40"
            role="status"
          >
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              No screenshot yet
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Capture a screenshot to unlock video generation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
