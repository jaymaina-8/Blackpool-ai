import type { Lead } from "@/lib/types/db";

/**
 * Deterministic prompt (blueprint order):
 * 1. business context
 * 2. visual instruction
 * 3. motion instruction
 * 4. style constraint
 * 5. negative constraints
 */
export function buildVideoPrompt(lead: Pick<Lead, "business_name" | "category">) {
  const name = (lead.business_name ?? "").trim() || "this business";
  const category = (lead.category ?? "").trim() || "general";

  return [
    `Create a clean vertical promotional video for a ${category} business named ${name}.`,
    "Use the provided website screenshot as the base visual; keep branding and layout recognizable.",
    "Add subtle camera motion and smooth, restrained transitions—nothing flashy.",
    "Maintain a modern, professional, business-focused aesthetic suitable for outreach.",
    "Avoid distortions, unrealistic effects, unreadable text, warped logos, or chaotic motion.",
  ].join("\n");
}
