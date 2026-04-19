import type { AuthError } from "@supabase/supabase-js";
import type { SignInErrorPresentation } from "@/lib/auth/map-sign-in-error";

export type SignUpErrorPresentation = SignInErrorPresentation;

export function signUpMissingFieldsError(): SignUpErrorPresentation {
  return {
    title: "Missing information",
    message: "Enter your email, password, and password confirmation.",
  };
}

export function signUpPasswordMismatchError(): SignUpErrorPresentation {
  return {
    title: "Passwords do not match",
    message: "Re-enter your password so both fields match.",
  };
}

export function signUpWeakPasswordError(minLength: number): SignUpErrorPresentation {
  return {
    title: "Password too short",
    message: `Use at least ${minLength} characters for your password.`,
  };
}

export function signUpNetworkError(): SignUpErrorPresentation {
  return {
    title: "Connection problem",
    message:
      "Check your connection or try disabling extensions that block requests.",
  };
}

/**
 * Maps Supabase sign-up errors to UI copy.
 */
export function mapSignUpError(error: AuthError): SignUpErrorPresentation {
  const msg = (error.message ?? "").toLowerCase();
  const status = error.status ?? 0;
  const code = (error.code ?? "").toLowerCase();

  const isDuplicate =
    code === "user_already_exists" ||
    code === "email_exists" ||
    msg.includes("user already registered") ||
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("email address is already") ||
    msg.includes("duplicate key") ||
    msg.includes("unique constraint");

  if (isDuplicate) {
    return {
      title: "Email already in use",
      message:
        "An account with this email already exists. Sign in or use a different email.",
    };
  }

  const isWeakPassword =
    code === "weak_password" ||
    msg.includes("password should be at least") ||
    msg.includes("password is too short") ||
    msg.includes("password does not meet") ||
    msg.includes("password strength") ||
    msg.includes("weak password") ||
    msg.includes("invalid password");

  if (isWeakPassword) {
    return {
      title: "Password not accepted",
      message:
        "Choose a stronger password (longer mix of characters), or meet your project’s password rules in Supabase.",
    };
  }

  if (
    msg.includes("invalid email") ||
    msg.includes("email address is invalid") ||
    code === "email_address_invalid"
  ) {
    return {
      title: "Invalid email",
      message: "Enter a valid email address.",
    };
  }

  if (
    msg.includes("signup not allowed") ||
    msg.includes("signups not allowed") ||
    msg.includes("signup_disabled")
  ) {
    return {
      title: "Sign-up disabled",
      message:
        "New sign-ups are turned off for this project. Ask an administrator to enable sign-ups in Supabase Auth settings.",
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
      message: "Wait a moment, then try again.",
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
      message: "We could not reach the sign-up service. Try again in a moment.",
    };
  }

  return {
    title: "Sign-up failed",
    message: "Something went wrong. Try again in a moment.",
    rawDetail:
      process.env.NODE_ENV === "development" && error.message
        ? error.message
        : undefined,
  };
}
