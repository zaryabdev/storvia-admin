import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import { cloudinarySignature, parseParamsToSign } from "@/lib/media-sign";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

// Merchant-owned, authenticated.
// 401 unauthenticated, 404 unknown Store, 403 Store owned by someone else.
async function loadOwnedStore(storeId: string) {
  const { userId } = auth();
  if (!userId) return { store: null, denied: new NextResponse("Unauthenticated", { status: 401 }) };

  const store = await prismadb.store.findUnique({
    where: { id: storeId },
    select: { id: true, userId: true },
  });
  if (!store) return { store: null, denied: apiError(404, "STORE_NOT_FOUND", "Store not found.") };
  if (store.userId !== userId) return { store: null, denied: new NextResponse("Forbidden", { status: 403 }) };

  return { store, denied: null };
}

// POST /api/stores/:storeId/media/sign
// Body: { paramsToSign } (sent by CldUploadWidget's signatureEndpoint)
// -> { signature }. Only this Store's widget uploads with the signed preset
// are signed (parseParamsToSign); anything else is 400. The params and the
// secret are never logged.
export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!apiKey || !apiSecret || !uploadPreset) {
      console.error("[MEDIA_SIGN] Cloudinary API key, secret or upload preset is not set");
      return new NextResponse("Internal error", { status: 500 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new NextResponse("Invalid upload request", { status: 400 });
    }

    const paramsToSign = parseParamsToSign(
      body && typeof body === "object" ? (body as { paramsToSign?: unknown }).paramsToSign : undefined,
      { storeId: store.id, uploadPreset, nowSeconds: Math.floor(Date.now() / 1000) },
    );

    if (!paramsToSign) {
      return new NextResponse("Invalid upload request", { status: 400 });
    }

    return NextResponse.json({ signature: cloudinarySignature(paramsToSign, apiSecret) });
  } catch (error) {
    console.error("[MEDIA_SIGN]", error instanceof Error ? error.message : "Unexpected error");
    return new NextResponse("Internal error", { status: 500 });
  }
}
