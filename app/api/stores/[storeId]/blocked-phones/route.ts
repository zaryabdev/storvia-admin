import { auth } from "@clerk/nextjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import {
  BLOCKED_PHONES_LIMIT_ERROR,
  MAX_BLOCKED_PHONES,
  parseBlockedPhoneInput,
  toBlockedPhoneItem,
} from "@/lib/blocked-phones";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

const ITEM_SELECT = { id: true, phone: true, note: true, createdAt: true } as const;

// Merchant-owned, authenticated. Rules: DECISIONS.md → Phone blocklist.
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

// Never log a phone: Prisma validation errors echo the query arguments, so only their name.
const loggable = (error: unknown) =>
  error instanceof Prisma.PrismaClientValidationError ? error.name : error;

// GET /api/stores/:storeId/blocked-phones -> { items: [{ id, phone, note, createdAt }] }, newest first.
export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    const rows = await prismadb.blockedPhone.findMany({
      where: { storeId: store.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: ITEM_SELECT,
    });

    return NextResponse.json({ items: rows.map(toBlockedPhoneItem) });
  } catch (error) {
    console.error("[BLOCKED_PHONES_GET]", loggable(error));
    return new NextResponse("Internal error", { status: 500 });
  }
}

// POST /api/stores/:storeId/blocked-phones  Body: { phone, note? } -> the item.
// Only Pakistani mobiles (parseBlockedPhoneInput). A number already blocked
// (same key, any format) → 200 with the existing item, note unchanged. At most
// 1,000 per Store. The body is never logged.
export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    // Parse errors echo the body, so they are never logged.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new NextResponse("Invalid request body", { status: 400 });
    }

    const result = parseBlockedPhoneInput(body);
    if ("error" in result) return new NextResponse(result.error, { status: 400 });

    const { phoneKey, phone, note } = result.value;
    const where = { storeId_phoneKey: { storeId: store.id, phoneKey } };

    const existing = await prismadb.blockedPhone.findUnique({ where, select: ITEM_SELECT });
    if (existing) return NextResponse.json(toBlockedPhoneItem(existing));

    const count = await prismadb.blockedPhone.count({ where: { storeId: store.id } });
    if (count >= MAX_BLOCKED_PHONES) return new NextResponse(BLOCKED_PHONES_LIMIT_ERROR, { status: 400 });

    try {
      const created = await prismadb.blockedPhone.create({
        data: { storeId: store.id, phoneKey, phone, note },
        select: ITEM_SELECT,
      });
      return NextResponse.json(toBlockedPhoneItem(created));
    } catch (error) {
      // Blocked by a parallel request in the meantime: same as already blocked.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const row = await prismadb.blockedPhone.findUniqueOrThrow({ where, select: ITEM_SELECT });
        return NextResponse.json(toBlockedPhoneItem(row));
      }
      throw error;
    }
  } catch (error) {
    console.error("[BLOCKED_PHONES_POST]", loggable(error));
    return new NextResponse("Internal error", { status: 500 });
  }
}
