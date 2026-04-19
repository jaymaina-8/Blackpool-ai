"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  mapSignUpError,
  signUpMissingFieldsError,
  signUpNetworkError,
  signUpPasswordMismatchError,
  signUpWeakPasswordError,
  type SignUpErrorPresentation,
} from "@/lib/auth/map-sign-up-error";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SignUpErrorAlert({ error }: { error: SignUpErrorPresentation }) {
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

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signUpError, setSignUpError] = useState<SignUpErrorPresentation | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSignUpError(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || !confirmPassword) {
      setSignUpError(signUpMissingFieldsError());
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setSignUpError({
        title: "Invalid email",
        message: "Enter a valid email address.",
      });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setSignUpError(signUpWeakPasswordError(MIN_PASSWORD_LENGTH));
      return;
    }
    if (password !== confirmPassword) {
      setSignUpError(signUpPasswordMismatchError());
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/leads")}`;

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { emailRedirectTo },
      });

      if (error) {
        setSignUpError(mapSignUpError(error));
        return;
      }

      if (data.session) {
        router.push("/leads");
        router.refresh();
        return;
      }

      if (data.user) {
        setSuccessMessage(
          "Your account was created. Check your email to confirm your account before signing in.",
        );
        return;
      }

      setSuccessMessage(
        "If a new account can be created for this email, check your inbox to confirm before signing in. If you already have an account, sign in instead.",
      );
    } catch {
      setSignUpError(signUpNetworkError());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sign up with your email and a password.
          </p>
        </div>

        {successMessage ? (
          <p
            className="text-sm text-zinc-700 dark:text-zinc-300"
            role="status"
          >
            {successMessage}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="sign-up-email"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Email
              </label>
              <input
                id="sign-up-email"
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
                htmlFor="sign-up-password"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Password
              </label>
              <input
                id="sign-up-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label
                htmlFor="sign-up-confirm-password"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Confirm password
              </label>
              <input
                id="sign-up-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {loading ? "Creating account…" : "Sign up"}
            </button>
          </form>
        )}

        {signUpError ? <SignUpErrorAlert error={signUpError} /> : null}

        <p className="text-center text-sm">
          <Link
            href="/login"
            className="text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            Already have an account? Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
