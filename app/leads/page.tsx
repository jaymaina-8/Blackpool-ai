import Link from "next/link";
import { LeadList } from "@/components/LeadList";
import { createClient } from "@/lib/supabase/server";
import type { Lead } from "@/lib/types/db";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, created_at, updated_at, created_by, business_name, website_url, category, status",
    )
    .order("created_at", { ascending: false });

  const leads = (data ?? []) as Lead[];

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Leads</h1>
        <Link
          href="/leads/new"
          className="inline-flex w-fit items-center justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          New lead
        </Link>
      </div>

      {error ? (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400" role="alert">
          {error.message}
        </p>
      ) : leads.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">No leads yet</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Create your first lead to start generating videos.
          </p>
          <Link
            href="/leads/new"
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            New lead
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <LeadList leads={leads} />
        </div>
      )}
    </div>
  );
}
