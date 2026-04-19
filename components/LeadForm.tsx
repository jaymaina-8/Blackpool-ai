"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function normalizeWebsiteUrl(raw: string): { ok: true; value: string } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false };
  try {
    const withScheme = /:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false };
    return { ok: true, value: u.href };
  } catch {
    return { ok: false };
  }
}

export function LeadForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [category, setCategory] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    business_name?: string;
    website_url?: string;
    category?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const nextErrors: typeof fieldErrors = {};
    if (!businessName.trim()) nextErrors.business_name = "Business name is required.";
    const urlResult = normalizeWebsiteUrl(websiteUrl);
    if (!urlResult.ok) nextErrors.website_url = "Enter a valid http(s) URL.";
    if (!category.trim()) nextErrors.category = "Category is required.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!urlResult.ok) return;

    setSubmitting(true);
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSubmitting(false);
      setSubmitError("You must be signed in to create a lead.");
      return;
    }

    const { data, error } = await supabase
      .from("leads")
      .insert({
        business_name: businessName.trim(),
        website_url: urlResult.value,
        category: category.trim(),
        created_by: user.id,
        status: "draft",
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (error) {
      setSubmitError(error.message || "Could not create lead.");
      return;
    }

    if (data?.id) {
      router.push(`/leads/${data.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label
          htmlFor="business_name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Business name
        </label>
        <input
          id="business_name"
          name="business_name"
          type="text"
          autoComplete="organization"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        {fieldErrors.business_name ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fieldErrors.business_name}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="website_url"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Website URL
        </label>
        <input
          id="website_url"
          name="website_url"
          type="url"
          inputMode="url"
          placeholder="https://example.com"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        {fieldErrors.website_url ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {fieldErrors.website_url}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="category"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Category
        </label>
        <input
          id="category"
          name="category"
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
        {fieldErrors.category ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.category}</p>
        ) : null}
      </div>

      {submitError ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {submitting ? "Creating…" : "Create lead"}
        </button>
      </div>
    </form>
  );
}
