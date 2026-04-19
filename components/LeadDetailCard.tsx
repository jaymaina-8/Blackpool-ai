import type { Lead, VideoJob } from "@/lib/types/db";
import {
  GenerateVideoSection,
  type UserVideoBlock,
} from "@/components/GenerateVideoSection";
import { LeadWorkflowStep } from "@/components/LeadWorkflowStep";
import { LogoUploader } from "@/components/LogoUploader";
import { PreviousVideoAttempts } from "@/components/PreviousVideoAttempts";
import { ScreenshotCapture } from "@/components/ScreenshotCapture";
import { VideoResultCard } from "@/components/VideoResultCard";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function LeadDetailCard({
  lead,
  logoSignedUrl,
  screenshotSignedUrl,
  screenshotReady,
  userVideoBlock,
  latestVideoJob,
  latestCompletedJob,
  previousVideoJobs,
  resultVideoSignedUrl,
}: {
  lead: Lead;
  logoSignedUrl: string | null;
  screenshotSignedUrl: string | null;
  screenshotReady: boolean;
  userVideoBlock: UserVideoBlock;
  latestVideoJob: VideoJob | null;
  latestCompletedJob: VideoJob | null;
  previousVideoJobs: VideoJob[];
  resultVideoSignedUrl: string | null;
}) {
  return (
    <div className="space-y-12">
      <LeadWorkflowStep
        step={1}
        title="Step 1: Lead Info"
        description="Business details used in prompts and labeling."
      >
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {lead.business_name}
          </h1>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Website
              </dt>
              <dd className="mt-1">
                <a
                  href={lead.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-sm text-zinc-900 underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-900 dark:text-zinc-100 dark:hover:decoration-zinc-100"
                >
                  {lead.website_url}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Category
              </dt>
              <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                {lead.category}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Pipeline status
              </dt>
              <dd className="mt-1">
                <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-sm font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  {lead.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Created
              </dt>
              <dd className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                {formatDate(lead.created_at)}
              </dd>
            </div>
          </dl>
        </div>
      </LeadWorkflowStep>

      <LeadWorkflowStep
        step={2}
        title="Step 2: Logo"
        description="Optional brand mark for richer inputs."
      >
        <LogoUploader leadId={lead.id} initialSignedUrl={logoSignedUrl} />
      </LeadWorkflowStep>

      <LeadWorkflowStep
        step={3}
        title="Step 3: Screenshot"
        description="Required for video — capture must pass quality checks."
      >
        <ScreenshotCapture
          leadId={lead.id}
          initialSignedUrl={screenshotSignedUrl}
        />
      </LeadWorkflowStep>

      <LeadWorkflowStep
        step={4}
        title="Step 4: Generate Video"
        description="Runs on the server from your validated screenshot. One active job per user."
      >
        <div className="space-y-4">
          <GenerateVideoSection
            leadId={lead.id}
            screenshotReady={screenshotReady}
            userVideoBlock={userVideoBlock}
            initialLatestJob={latestVideoJob}
          />
          <PreviousVideoAttempts
            jobs={previousVideoJobs}
            latestJobId={latestVideoJob?.id ?? null}
          />
        </div>
      </LeadWorkflowStep>

      <LeadWorkflowStep
        step={5}
        title="Step 5: Result"
        description="Preview and download the latest successful MP4."
      >
        <VideoResultCard
          latestCompletedJob={latestCompletedJob}
          initialVideoSignedUrl={resultVideoSignedUrl}
        />
      </LeadWorkflowStep>
    </div>
  );
}
