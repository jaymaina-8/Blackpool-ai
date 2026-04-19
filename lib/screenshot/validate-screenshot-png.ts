import { PNG } from "pngjs";

/** Temporarily lowered for debugging pipeline (raise again once stable). */
const MIN_BYTES = 10 * 1024;

export type ScreenshotPngValidation =
  | { ok: true; width: number; height: number }
  | { ok: false; reason: string };

/**
 * MVP quality gate: min size, valid PNG, sane dimensions, and a coarse
 * luminance spread check to reject obviously flat/blank captures.
 */
export function validateScreenshotPng(buffer: Buffer): ScreenshotPngValidation {
  console.log("PNG size:", buffer.length);

  if (buffer.length < MIN_BYTES) {
    console.warn(
      "Screenshot rejected: buffer too small",
      buffer.length,
      "min",
      MIN_BYTES,
    );
    return {
      ok: false,
      reason:
        "Screenshot is too small (under 10 KB). The capture may be empty or incomplete.",
    };
  }

  let png: PNG;
  try {
    png = PNG.sync.read(buffer);
  } catch (e) {
    console.warn("Screenshot rejected: invalid PNG", e);
    return { ok: false, reason: "Screenshot is not a valid PNG image." };
  }

  const { width, height } = png;
  console.log("PNG width:", width);
  console.log("PNG height:", height);

  if (width < 150 || height < 150) {
    console.warn("Screenshot rejected: dimensions too small", width, height);
    return {
      ok: false,
      reason: "Screenshot dimensions are too small to be usable.",
    };
  }

  const data = png.data;
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 2500)));
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  let minL = 255;
  let maxL = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (width * y + x) << 2;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += l;
      sumSq += l * l;
      count += 1;
      minL = Math.min(minL, l);
      maxL = Math.max(maxL, l);
    }
  }

  if (count === 0) {
    console.warn("Screenshot rejected: no pixels sampled");
    return { ok: false, reason: "Could not sample screenshot pixels." };
  }

  const mean = sum / count;
  const variance = Math.max(0, sumSq / count - mean * mean);
  const range = maxL - minL;

  /** Relaxed vs production thresholds — fewer false “blank” rejections while debugging. */
  const mostlyWhite = mean > 251 && minL > 244;
  const mostlyBlack = mean < 8 && maxL < 14;
  const flat = range < 4 && variance < 28;

  if (mostlyWhite || mostlyBlack || flat) {
    console.warn("Screenshot rejected: blank or uniform", {
      mostlyWhite,
      mostlyBlack,
      flat,
      mean,
      minL,
      maxL,
      range,
      variance,
    });
    return {
      ok: false,
      reason:
        "Screenshot looks blank or nearly uniform (no meaningful page content detected).",
    };
  }

  return { ok: true, width, height };
}
