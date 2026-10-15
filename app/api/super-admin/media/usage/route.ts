import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import { fetchMediaUsage } from "@/lib/media-usage";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export const dynamic = "force-dynamic";

// GET /api/super-admin/media/usage
// -> { usage, error }: the Cloudinary account usage (lib/media-usage.ts).
// Missing env or a failed/slow Cloudinary call is still 200, with usage null
// and error NOT_CONFIGURED / UNAVAILABLE. The API key and secret are never
// returned or logged.
export async function GET() {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_MEDIA_USAGE_GET");
    if (denied) return denied;

    const result = await fetchMediaUsage({
      cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "[SUPER_ADMIN_MEDIA_USAGE_GET]",
      error instanceof Error ? error.message : "Unexpected error"
    );
    return apiError(500, "INTERNAL_ERROR", "Could not load media usage.");
  }
}
