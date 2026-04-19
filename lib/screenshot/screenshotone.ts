/**
 * Builds ScreenshotOne "take" URL (desktop viewport, 1440×900, network idle when supported).
 * Server-only: import only from API routes or other server code, not from client components.
 * @see https://screenshotone.com/docs/
 */
export function buildScreenshotOneTakeUrl(
  websiteUrl: string,
  accessKey: string,
): string {
  const u = new URL("https://api.screenshotone.com/take");
  u.searchParams.set("access_key", accessKey);
  u.searchParams.set("url", websiteUrl);
  u.searchParams.set("viewport_width", "1440");
  u.searchParams.set("viewport_height", "900");
  u.searchParams.set("device_scale_factor", "1");
  u.searchParams.set("format", "png");
  u.searchParams.set("full_page", "false");
  u.searchParams.set("wait_until", "networkidle2");
  /** Seconds to wait after load before capture (helps heavy / slow pages). */
  u.searchParams.set("delay", "3");
  u.searchParams.set("timeout", "17");
  u.searchParams.set("block_ads", "true");
  u.searchParams.set("block_trackers", "true");
  u.searchParams.set("cache", "false");
  return u.toString();
}
