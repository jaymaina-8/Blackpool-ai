import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_VIDEO_JOBS_PER_USER_PER_DAY } from "@/lib/ltx/constants";

export async function fetchLeadIdsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id")
    .eq("created_by", userId);

  if (error) {
    throw new Error(error.message || "Could not load leads for user.");
  }
  return (data ?? []).map((r) => r.id as string);
}

export async function countActiveVideoJobsForUser(
  supabase: SupabaseClient,
  leadIds: string[],
): Promise<number> {
  if (!leadIds.length) return 0;
  const { count, error } = await supabase
    .from("video_jobs")
    .select("id", { count: "exact", head: true })
    .in("lead_id", leadIds)
    .in("status", ["pending", "processing"]);

  if (error) {
    throw new Error(error.message || "Could not count active video jobs.");
  }
  return count ?? 0;
}

export async function countTodaysVideoJobsForUser(
  supabase: SupabaseClient,
  leadIds: string[],
): Promise<number> {
  if (!leadIds.length) return 0;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("video_jobs")
    .select("id", { count: "exact", head: true })
    .in("lead_id", leadIds)
    .gte("created_at", start.toISOString());

  if (error) {
    throw new Error(error.message || "Could not count daily video jobs.");
  }
  return count ?? 0;
}

export function isDailyVideoLimitExceeded(todayCount: number): boolean {
  return todayCount >= MAX_VIDEO_JOBS_PER_USER_PER_DAY;
}
