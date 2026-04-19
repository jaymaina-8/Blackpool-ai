import { mapLtxHttpError } from "@/lib/ltx/map-error";
import type { LtxModelId } from "@/lib/ltx/constants";
import {
  LTX_DEFAULT_BASE_URL,
  LTX_DEFAULT_DURATION_SEC,
  LTX_DEFAULT_FPS,
  LTX_DEFAULT_RESOLUTION,
} from "@/lib/ltx/constants";

export type ImageToVideoSuccess = {
  mp4: Buffer;
  requestId: string | null;
};

export type ImageToVideoFailure = {
  status: number;
  message: string;
  rawBody: string;
};

export type ImageToVideoResult = ImageToVideoSuccess | ImageToVideoFailure;

export async function requestImageToVideo(params: {
  baseUrl?: string;
  apiKey: string;
  imageUri: string;
  prompt: string;
  model: LtxModelId;
  durationSec?: number;
  resolution?: string;
  fps?: number;
  signal: AbortSignal;
}): Promise<ImageToVideoSuccess | ImageToVideoFailure> {
  const base = (params.baseUrl ?? LTX_DEFAULT_BASE_URL).replace(/\/$/, "");
  const url = `${base}/v1/image-to-video`;

  const body = JSON.stringify({
    image_uri: params.imageUri,
    prompt: params.prompt,
    model: params.model,
    duration: params.durationSec ?? LTX_DEFAULT_DURATION_SEC,
    resolution: params.resolution ?? LTX_DEFAULT_RESOLUTION,
    fps: params.fps ?? LTX_DEFAULT_FPS,
    generate_audio: true,
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body,
      signal: params.signal,
    });
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.name === "AbortError"
          ? "LTX request was aborted (timeout)."
          : e.message
        : "LTX network error.";
    return { status: 0, message: msg, rawBody: "" };
  }

  const requestId = res.headers.get("x-request-id")?.trim() || null;

  if (res.status === 200) {
    const ct = res.headers.get("content-type") ?? "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (!ct.includes("octet-stream") && !ct.includes("video") && buf.length > 0) {
      const asText = buf.subarray(0, 512).toString("utf8");
      if (asText.trimStart().startsWith("{")) {
        return {
          status: res.status,
          message: mapLtxHttpError(res.status, buf.toString("utf8")),
          rawBody: buf.toString("utf8"),
        };
      }
    }
    if (buf.length < 1024) {
      return {
        status: 502,
        message: "LTX returned an empty or suspiciously small video payload.",
        rawBody: buf.toString("utf8").slice(0, 500),
      };
    }
    return { mp4: buf, requestId };
  }

  const errText = await res.text();
  return {
    status: res.status,
    message: mapLtxHttpError(res.status, errText),
    rawBody: errText.slice(0, 2000),
  };
}
