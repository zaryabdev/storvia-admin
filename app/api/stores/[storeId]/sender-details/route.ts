import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import prismadb from "@/lib/prismadb";
import { parseSenderDetails } from "@/lib/sender-details";

export const dynamic = "force-dynamic";

const SENDER_SELECT = {
  senderName: true,
  senderPhone: true,
  senderAddress: true,
  senderCity: true,
} as const;

// Merchant-owned, authenticated. Sender details are private: they are never
// part of the public Storefront Store read (GET /api/stores/:storeId).
// 401 unauthenticated, 404 unknown Store, 403 Store owned by someone else.
async function loadOwnedStore(storeId: string) {
  const { userId } = auth();
  if (!userId) return { store: null, denied: new NextResponse("Unauthenticated", { status: 401 }) };

  const store = await prismadb.store.findUnique({
    where: { id: storeId },
    select: { id: true, userId: true, ...SENDER_SELECT },
  });
  if (!store) return { store: null, denied: apiError(404, "STORE_NOT_FOUND", "Store not found.") };
  if (store.userId !== userId) return { store: null, denied: new NextResponse("Forbidden", { status: 403 }) };

  return { store, denied: null };
}

const toBody = (store: {
  senderName: string | null;
  senderPhone: string | null;
  senderAddress: string | null;
  senderCity: string | null;
}) => ({
  senderName: store.senderName,
  senderPhone: store.senderPhone,
  senderAddress: store.senderAddress,
  senderCity: store.senderCity,
});

// GET /api/stores/:storeId/sender-details
// -> { senderName, senderPhone, senderAddress, senderCity } (null = not set)
export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    return NextResponse.json(toBody(store));
  } catch (error) {
    console.error("[STORE_SENDER_DETAILS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// PATCH /api/stores/:storeId/sender-details
// Body: all four fields, non-empty after trimming. Name ≤ 100, phone in any
// format with 7–15 digits, address ≤ 200, city ≤ 60. Stored trimmed.
export async function PATCH(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new NextResponse("Invalid request body", { status: 400 });
    }

    const result = parseSenderDetails(body);
    if ("error" in result) return new NextResponse(result.error, { status: 400 });

    const updated = await prismadb.store.update({
      where: { id: store.id },
      data: result.value,
      select: SENDER_SELECT,
    });

    return NextResponse.json(toBody(updated));
  } catch (error) {
    console.error("[STORE_SENDER_DETAILS_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
