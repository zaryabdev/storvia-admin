import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import prismadb from "@/lib/prismadb";
import { STOCK_SETTINGS_SELECT, parseStockSettingsPatch, toStockSettings } from "@/lib/stock";

export const dynamic = "force-dynamic";

// Merchant-owned, authenticated. The public product reads expose only the
// computed `stockDisplay`, never these settings.
// 401 unauthenticated, 404 unknown Store, 403 Store owned by someone else.
async function loadOwnedStore(storeId: string) {
  const { userId } = auth();
  if (!userId) return { store: null, denied: new NextResponse("Unauthenticated", { status: 401 }) };

  const store = await prismadb.store.findUnique({
    where: { id: storeId },
    select: { id: true, userId: true, ...STOCK_SETTINGS_SELECT },
  });
  if (!store) return { store: null, denied: apiError(404, "STORE_NOT_FOUND", "Store not found.") };
  if (store.userId !== userId) return { store: null, denied: new NextResponse("Forbidden", { status: 403 }) };

  return { store, denied: null };
}

// GET /api/stores/:storeId/stock-settings -> { lowStockThreshold, stockDisplayMode }
export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    return NextResponse.json(toStockSettings(store));
  } catch (error) {
    console.error("[STORE_STOCK_SETTINGS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// PATCH /api/stores/:storeId/stock-settings
// Body: { lowStockThreshold?: number | string, stockDisplayMode?: "ALWAYS" | "WHEN_LOW" | "NEVER" }
// Rules in lib/stock.ts (parseStockSettingsPatch). Returns the GET shape.
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

    const result = parseStockSettingsPatch(body, toStockSettings(store));
    if ("error" in result) return new NextResponse(result.error, { status: 400 });

    const updated = await prismadb.store.update({
      where: { id: store.id },
      data: result.value,
      select: STOCK_SETTINGS_SELECT,
    });

    return NextResponse.json(toStockSettings(updated));
  } catch (error) {
    console.error("[STORE_STOCK_SETTINGS_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
