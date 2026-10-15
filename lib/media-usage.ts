// Cloudinary account usage for the Super Admin media monitor (DECISIONS.md
// "Media monitoring (Super Admin)"). Plain module, no Next.js or Prisma
// imports. One read-only call to Cloudinary's Admin API usage endpoint with
// Basic auth; the API key and secret are never returned or logged.

export type MediaUsageStatus = "OK" | "WATCH" | "CRITICAL";

export type MediaUsage = {
  plan: string | null;
  lastUpdated: string | null;
  credits: {
    used: number | null;
    limit: number | null;
    usedPercent: number | null;
  };
  storageBytes: number | null;
  bandwidthBytes: number | null;
  transformations: number | null;
  resources: number | null;
  derivedResources: number | null;
  status: MediaUsageStatus | null;
};

export type MediaUsageResult = {
  usage: MediaUsage | null;
  error: null | "NOT_CONFIGURED" | "UNAVAILABLE";
};

export const MEDIA_USAGE_TIMEOUT_MS = 5000;

const WATCH_PERCENT = 60;
const CRITICAL_PERCENT = 85;

// OK below 60% of credits used, WATCH from 60 to below 85, CRITICAL from 85.
export function mediaUsageStatus(usedPercent: number): MediaUsageStatus {
  if (usedPercent >= CRITICAL_PERCENT) return "CRITICAL";
  if (usedPercent >= WATCH_PERCENT) return "WATCH";
  return "OK";
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

// Maps the fields Cloudinary's usage response has (checked against this
// account on 2026-10-15): plan, last_updated, credits.{usage, limit,
// used_percent}, storage.usage, bandwidth.usage, transformations.usage,
// resources, derived_resources. A missing field is null. Without a positive
// credit limit and a used percentage there is no status.
export function mapCloudinaryUsage(body: unknown): MediaUsage | null {
  const data = record(body);
  if (!data) return null;

  const credits = record(data.credits);
  const used = num(credits?.usage);
  const limit = num(credits?.limit);
  const usedPercent = num(credits?.used_percent);

  return {
    plan: str(data.plan),
    lastUpdated: str(data.last_updated),
    credits: { used, limit, usedPercent },
    storageBytes: num(record(data.storage)?.usage),
    bandwidthBytes: num(record(data.bandwidth)?.usage),
    transformations: num(record(data.transformations)?.usage),
    resources: num(data.resources),
    derivedResources: num(data.derived_resources),
    status:
      limit !== null && limit > 0 && usedPercent !== null
        ? mediaUsageStatus(usedPercent)
        : null,
  };
}

type FetchMediaUsageOptions = {
  cloudName: string | undefined;
  apiKey: string | undefined;
  apiSecret: string | undefined;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

const UNAVAILABLE: MediaUsageResult = { usage: null, error: "UNAVAILABLE" };

export async function fetchMediaUsage({
  cloudName,
  apiKey,
  apiSecret,
  timeoutMs = MEDIA_USAGE_TIMEOUT_MS,
  fetchImpl = fetch,
}: FetchMediaUsageOptions): Promise<MediaUsageResult> {
  if (!cloudName || !apiKey || !apiSecret) {
    console.error("[MEDIA_USAGE] Cloudinary cloud name, API key or secret is not set");
    return { usage: null, error: "NOT_CONFIGURED" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/usage`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
        },
        cache: "no-store",
        signal: controller.signal,
      }
    );

    if (response.status !== 200) {
      console.error(`[MEDIA_USAGE] Cloudinary usage request failed with status ${response.status}`);
      return UNAVAILABLE;
    }

    const usage = mapCloudinaryUsage(await response.json());

    if (!usage) {
      console.error("[MEDIA_USAGE] Cloudinary usage response was not an object");
      return UNAVAILABLE;
    }

    return { usage, error: null };
  } catch (error) {
    // Never log the error object: keep the request (and its headers) out of logs.
    console.error(
      controller.signal.aborted
        ? `[MEDIA_USAGE] Cloudinary usage request timed out after ${timeoutMs} ms`
        : "[MEDIA_USAGE] Cloudinary usage request failed (network or invalid response)"
    );
    return UNAVAILABLE;
  } finally {
    clearTimeout(timer);
  }
}
