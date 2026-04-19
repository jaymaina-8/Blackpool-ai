import type { AuthError } from "@supabase/supabase-js";

export type SignInErrorPresentation = {
  title: string;
  message: string;
  hint?: string;
  /** Shown only when useful for debugging (e.g. dev-only for unknown failures). */
  rawDetail?: string;
};

export function signInMissingFieldsError(): SignInErrorPresentation {
  return {
    title: "Missing information",
    message: "Enter your email and password.",
  };
}

export function signInNetworkError(): SignInErrorPresentation {
  return {
    title: "Connection problem",
    message:
      "Check your connection or try disabling extensions that block requests.",
  };
}

/**
 * Maps Supabase sign-in errors to UI copy. Invalid credentials use a normal
 * wrong-password message; the password-reset hint is secondary only.
 */
export function mapSignInError(error: AuthError): SignInErrorPresentation {
  const msg = (error.message ?? "").toLowerCase();
  const status = error.status ?? 0;
  const code = (error.code ?? "").toLowerCase();

  const isInvalidCredentials =
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid credentials") ||
    msg.includes("invalid_credentials");

  if (isInvalidCredentials) {
    return {
      title: "Wrong email or password",
      message: "Check your email and password and try again.",
      hint: "If this account was previously used without a password, reset your password to continue.",
    };
  }

  if (
    msg.includes("email not confirmed") ||
    msg.includes("email_not_confirmed")
  ) {
    return {
      title: "Email not confirmed",
      message:
        "Confirm your email first, or ask your admin to adjust email confirmation in Supabase Auth settings.",
    };
  }

  if (
    status === 429 ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("over_request_rate") ||
    msg.includes("too_many_requests")
  ) {
    return {
      title: "Too many attempts",
      message: "Wait a moment, then try signing in again.",
    };
  }

  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("failed to fetch") ||
    status === 0
  ) {
    return {
      title: "Temporary problem",
      message: "We could not reach the sign-in service. Try again in a moment.",
    };
  }

  return {
    title: "Sign in failed",
    message: "Something went wrong. Try again in a moment.",
    rawDetail:
      process.env.NODE_ENV === "development" && error.message
        ? error.message
        : undefined,
  };
}
