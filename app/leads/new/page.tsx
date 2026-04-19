import Link from "next/link";
import { LeadForm } from "@/components/LeadForm";

export default function NewLeadPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/leads"
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to leads
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">New lead</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Add a business name, website, and category. The lead starts as <span className="font-medium">draft</span>.
      </p>
      <div className="mt-8">
        <LeadForm />
      </div>
    </div>
  );
}
