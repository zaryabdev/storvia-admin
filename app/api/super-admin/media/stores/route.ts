import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import { getStoreMedia } from "@/lib/media-stores";
import prismadb from "@/lib/prismadb";
import { requireSuperAdmin } from "@/lib/super-admin-auth";

export const dynamic = "force-dynamic";

// GET /api/super-admin/media/stores
// -> { stores: [{ storeId, name, productImages, billboardImages,
//    brandingImages, paymentQrImages, totalImages, imagesLast30Days,
//    lastImageAt, productCount, archivedProductCount }] }, every Store, sorted
// by totalImages desc then name. Database only (lib/media-stores.ts).
export async function GET() {
  try {
    const denied = requireSuperAdmin("SUPER_ADMIN_MEDIA_STORES_GET");
    if (denied) return denied;

    return NextResponse.json({ stores: await getStoreMedia(prismadb) });
  } catch (error) {
    console.error("[SUPER_ADMIN_MEDIA_STORES_GET]", error);
    return apiError(500, "INTERNAL_ERROR", "Could not load media by Store.");
  }
}
