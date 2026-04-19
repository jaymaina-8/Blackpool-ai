import Link from "next/link";
import type { Lead } from "@/lib/types/db";

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

export function LeadList({ leads }: { leads: Lead[] }) {
  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
      {leads.map((lead) => (
        <li key={lead.id}>
          <Link
            href={`/leads/${lead.id}`}
            className="block px-4 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {lead.business_name}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {lead.category}
                </p>
              </div>
              <span className="mt-1 inline-flex w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {lead.status}
              </span>
            </div>
            <p className="mt-2 truncate text-sm text-zinc-500 dark:text-zinc-500">
              {lead.website_url}
            </p>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
              Created {formatDate(lead.created_at)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
