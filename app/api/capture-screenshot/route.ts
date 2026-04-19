import { createClient } from "@/lib/supabase/server";
import { buildScreenshotOneTakeUrl } from "@/lib/screenshot/screenshotone";
import { validateScreenshotPng } from "@/lib/screenshot/validate-screenshot-png";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FETCH_DEADLINE_MS = 20_000;

type Body = {
  lead_id?: string;
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "development") {
    console.log("ENV LOADED:", !!process.env.SCREENSHOTONE_ACCESS_KEY);
  }

  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY?.trim();
  if (!accessKey) {
    return NextResponse.json(
      { error: "Missing SCREENSHOTONE_ACCESS_KEY" },
      { status: 503 },
    );
  }

  try {

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return jsonError(400, "Invalid JSON body.");
    }

    const leadId = typeof body.lead_id === "string" ? body.lead_id.trim() : "";
    if (!leadId) {
      return jsonError(400, "lead_id is required.");
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonError(401, "You must be signed in to capture a screenshot.");
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, website_url")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) {
      return jsonError(500, leadError.message || "Could not load this lead.");
    }
    if (!lead) {
      return jsonError(
        404,
        "Lead not found or you do not have permission to access it.",
      );
    }

    const websiteUrl = lead.website_url?.trim();
    if (!websiteUrl) {
      return jsonError(400, "This lead has no website URL to capture.");
    }

    let screenshotUrl: string;
    try {
      screenshotUrl = buildScreenshotOneTakeUrl(websiteUrl, accessKey);
    } catch {
      return jsonError(400, "Website URL is not valid for screenshot capture.");
    }

    let providerResponse: Response;
    try {
      providerResponse = await fetch(screenshotUrl, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_DEADLINE_MS),
      });
    } catch (e) {
      console.error("ScreenshotOne fetch error:", e);
      const msg =
        e instanceof Error && e.name === "TimeoutError"
          ? "Screenshot capture timed out (20s limit). Try again or check the website."
          : "Could not reach the screenshot service. Try again later.";
      return jsonError(502, msg);
    }

    console.log("ScreenshotOne status:", providerResponse.status);

    if (!providerResponse.ok) {
      const text = await providerResponse.text();
      console.error("ScreenshotOne error response:", text);
      throw new Error(`ScreenshotOne failed: ${providerResponse.status}`);
    }

    const providerBuf = Buffer.from(await providerResponse.arrayBuffer());
    const ct = providerResponse.headers.get("content-type") ?? "";

    if (
      !ct.includes("png") &&
      !providerBuf
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      console.error(
        "ScreenshotOne returned non-PNG body; content-type:",
        ct,
        "bytes:",
        providerBuf.length,
      );
      return jsonError(
        502,
        "Screenshot provider did not return a PNG image. Try again later.",
      );
    }

    console.log("Screenshot buffer size:", providerBuf.length);

    const validation = validateScreenshotPng(providerBuf);
    if (!validation.ok) {
      console.warn("PNG validation rejected:", validation.reason);
      return jsonError(422, validation.reason);
    }

    const storagePath = `${leadId}/${crypto.randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("screenshots")
      .upload(storagePath, providerBuf, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      console.error("Screenshot storage upload failed:", uploadError.message);
      return jsonError(
        502,
        `Could not save screenshot to storage: ${uploadError.message}`,
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from("assets")
      .insert({
        lead_id: leadId,
        type: "screenshot",
        storage_bucket: "screenshots",
        storage_path: storagePath,
        mime_type: "image/png",
        metadata: {
          width: validation.width,
          height: validation.height,
          screenshot_quality_checked: true,
          viewport_width: 1440,
          viewport_height: 900,
          provider: "screenshotone",
        },
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      await supabase.storage.from("screenshots").remove([storagePath]);
      console.error("Screenshot asset insert failed:", insertError?.message);
      return jsonError(
        500,
        insertError?.message ||
          "Screenshot uploaded but the asset record could not be created.",
      );
    }

    const newAssetId = inserted.id as string;

    const { data: oldRows, error: listOldError } = await supabase
      .from("assets")
      .select("id, storage_path")
      .eq("lead_id", leadId)
      .eq("type", "screenshot");

    if (!listOldError && oldRows?.length) {
      const stale = oldRows.filter((r) => r.id !== newAssetId);
      if (stale.length) {
        const paths = stale.map((r) => r.storage_path);
        await supabase.storage.from("screenshots").remove(paths);
        await supabase
          .from("assets")
          .delete()
          .in(
            "id",
            stale.map((r) => r.id),
          );
      }
    }

    return NextResponse.json({
      asset_id: newAssetId,
      storage_path: storagePath,
    });
  } catch (error) {
    console.error("Screenshot capture error:", error);

    return NextResponse.json(
      {
        error: "Screenshot capture failed",
        debug:
          process.env.NODE_ENV === "development"
            ? String(error)
            : undefined,
      },
      { status: 500 },
    );
  }
}
