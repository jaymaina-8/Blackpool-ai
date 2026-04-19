import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

export function AppNav() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/leads"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Blackpool AI
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link
              href="/leads"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Leads
            </Link>
            <Link
              href="/leads/new"
              className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              New lead
            </Link>
          </nav>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
