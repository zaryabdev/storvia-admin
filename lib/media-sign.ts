// Server only (node:crypto): validation and signing for
// POST /api/stores/:storeId/media/sign. Rules: DECISIONS.md → Image delivery
// and uploads.

import { createHash } from "node:crypto";

import { MEDIA_FOLDERS, mediaFolder } from "@/lib/media";

// Exactly what the Upload Widget (next-cloudinary CldUploadWidget,
// signatureEndpoint) sends for our options: no tags, context, public id,
// cropping or metadata, so those keys never get a signature.
export const SIGNABLE_KEYS = ["folder", "source", "timestamp", "upload_preset"] as const;

export const MAX_TIMESTAMP_SKEW_SECONDS = 10 * 60;

export type ParamsToSign = Record<string, string | number>;

// Cloudinary's documented scheme: "key=value" pairs sorted by key, joined by
// "&", the API secret appended, SHA-1 hex (the account default).
export function cloudinarySignature(params: ParamsToSign, apiSecret: string): string {
  const serialized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(serialized + apiSecret).digest("hex");
}

// The params to sign, or null when they are not one of this Store's widget
// uploads: only SIGNABLE_KEYS, the configured preset, one of this Store's
// folders, source "uw" (if sent) and a timestamp within ±10 minutes.
export function parseParamsToSign(
  raw: unknown,
  { storeId, uploadPreset, nowSeconds }: { storeId: string; uploadPreset: string; nowSeconds: number },
): ParamsToSign | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const params = raw as Record<string, unknown>;

  if (Object.keys(params).some((key) => !(SIGNABLE_KEYS as readonly string[]).includes(key))) return null;

  const { folder, source, timestamp, upload_preset } = params;

  if (upload_preset !== uploadPreset) return null;

  if (typeof folder !== "string" || !MEDIA_FOLDERS.some((kind) => folder === mediaFolder(storeId, kind))) {
    return null;
  }

  if (source !== undefined && source !== "uw") return null;

  const seconds =
    typeof timestamp === "number" && Number.isInteger(timestamp)
      ? timestamp
      : typeof timestamp === "string" && /^\d{1,12}$/.test(timestamp)
        ? Number(timestamp)
        : null;

  if (seconds === null || Math.abs(nowSeconds - seconds) > MAX_TIMESTAMP_SKEW_SECONDS) return null;

  // Signed exactly as sent (the widget posts these same values to Cloudinary).
  return { folder, timestamp, upload_preset, ...(source !== undefined && { source }) } as ParamsToSign;
}
