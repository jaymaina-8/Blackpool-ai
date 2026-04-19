"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);
const MAX_BYTES = 5 * 1024 * 1024;

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return "bin";
  }
}

export function LogoUploader({
  leadId,
  initialSignedUrl,
}: {
  leadId: string;
  initialSignedUrl: string | null;
}) {
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialSignedUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Use a PNG, JPG, GIF, WebP, or SVG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large (max 5 MB).");
      return;
    }

    setUploading(true);
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setUploading(false);
      setError("You must be signed in to upload.");
      return;
    }

    const { data: oldRows, error: listError } = await supabase
      .from("assets")
      .select("id, storage_path")
      .eq("lead_id", leadId)
      .eq("type", "logo");

    if (listError) {
      setUploading(false);
      setError(listError.message);
      return;
    }

    const ext = extensionForMime(file.type);
    const storagePath = `${leadId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { error: insertError } = await supabase.from("assets").insert({
      lead_id: leadId,
      type: "logo",
      storage_bucket: "logos",
      storage_path: storagePath,
      mime_type: file.type,
    });

    if (insertError) {
      await supabase.storage.from("logos").remove([storagePath]);
      setUploading(false);
      setError(insertError.message);
      return;
    }

    if (oldRows?.length) {
      const paths = oldRows.map((r) => r.storage_path);
      await supabase.storage.from("logos").remove(paths);
      await supabase.from("assets").delete().in(
        "id",
        oldRows.map((r) => r.id),
      );
    }

    const { data: signed, error: signError } = await supabase.storage
      .from("logos")
      .createSignedUrl(storagePath, 3600);

    setUploading(false);
    if (signError || !signed?.signedUrl) {
      setError(signError?.message || "Uploaded, but could not load preview.");
      router.refresh();
      return;
    }

    setPreviewUrl(signed.signedUrl);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Logo</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Upload a logo for this lead. Replacing an existing logo updates the preview.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-32 w-full max-w-[200px] items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-950">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Lead logo"
              className="max-h-full max-w-full object-contain p-2"
            />
          ) : (
            <span className="px-2 text-center text-xs text-zinc-500 dark:text-zinc-500">
              No logo yet
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <label className="block">
            <span className="sr-only">Choose logo file</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-800 dark:text-zinc-400 dark:file:bg-zinc-100 dark:file:text-zinc-900 dark:hover:file:bg-white"
            />
          </label>
          {uploading ? (
            <p className="mt-2 text-sm text-zinc-500">Uploading…</p>
          ) : null}
          {error ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
