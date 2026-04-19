"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  mapSignInError,
  signInMissingFieldsError,
  signInNetworkError,
  type SignInErrorPresentation,
} from "@/lib/auth/map-sign-in-error";
import { createClient } from "@/lib/supabase/client";

function AuthCallbackError() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "auth") return null;
  return (
    <p className="text-sm text-red-600 dark:text-red-400" role="alert">
      Sign-in could not be completed. Please try again.
    </p>
  );
}

function SignInErrorAlert({ error }: { error: SignInErrorPresentation }) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-red-200 bg-red-50 px-3 py-3 dark:border-red-900/50 dark:bg-red-950/40"
    >
      <p className="text-sm font-medium text-red-900 dark:text-red-100">
        {error.title}
      </p>
      <p className="text-sm text-red-800 dark:text-red-200">{error.message}</p>
      {error.hint ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{error.hint}</p>
      ) : null}
      {error.rawDetail ? (
        <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {error.rawDetail}
        </p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInError, setSignInError] =
    useState<SignInErrorPresentation | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSignInError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setSignInError(signInMissingFieldsError());
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setSignInError(mapSignInError(error));
        return;
      }

      router.push("/leads");
      router.refresh();
    } catch {
      setSignInError(signInNetworkError());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to continue.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm">
          <Link
            href="/reset-password"
            className="text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            Forgot your password? Reset it.
          </Link>
        </p>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            Sign up
          </Link>
        </p>

        <Suspense fallback={null}>
          <AuthCallbackError />
        </Suspense>
        {signInError ? <SignInErrorAlert error={signInError} /> : null}
      </div>
    </div>
  );
}
