/**
 * Limits open redirects after auth callback to same-origin relative paths.
 */
export function safeNextPath(next: string | null, fallback: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next;
}
