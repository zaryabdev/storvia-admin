import { auth } from "@clerk/nextjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

// DELETE /api/stores/:storeId/blocked-phones/:blockedPhoneId -> { id } (unblock).
// Merchant-owned: 401 unauthenticated, 404 unknown Store, 403 Store owned by
// someone else. An unknown id or another Store's → 404 BLOCKED_PHONE_NOT_FOUND.
// Rules: DECISIONS.md → Phone blocklist.
export async function DELETE(
  _req: Request,
  { params }: { params: { storeId: string; blockedPhoneId: string } },
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthenticated", { status: 401 });

    const store = await prismadb.store.findUnique({
      where: { id: params.storeId },
      select: { id: true, userId: true },
    });
    if (!store) return apiError(404, "STORE_NOT_FOUND", "Store not found.");
    if (store.userId !== userId) return new NextResponse("Forbidden", { status: 403 });

    // Store-scoped: a row in another Store behaves like a missing one.
    const deleted = await prismadb.blockedPhone.deleteMany({
      where: { id: params.blockedPhoneId, storeId: store.id },
    });
    if (deleted.count === 0) return apiError(404, "BLOCKED_PHONE_NOT_FOUND", "Blocked number not found.");

    return NextResponse.json({ id: params.blockedPhoneId });
  } catch (error) {
    // Never log a phone: Prisma validation errors echo the query arguments.
    console.error(
      "[BLOCKED_PHONES_DELETE]",
      error instanceof Prisma.PrismaClientValidationError ? error.name : error,
    );
    return new NextResponse("Internal error", { status: 500 });
  }
}
