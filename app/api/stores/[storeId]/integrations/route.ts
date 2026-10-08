import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import {
  INTEGRATION_COLUMNS,
  parseIntegrationPatch,
  toIntegrationsBody,
} from "@/lib/integrations";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

// Only the integration columns: Store has Decimal columns, never return a full row.
const INTEGRATION_SELECT = {
  metaPixelId: true,
  metaPixelEnabled: true,
  tiktokPixelId: true,
  tiktokPixelEnabled: true,
} as const;

// Merchant-owned, authenticated. The enabled flags are private; the public
// Store GET exposes a pixel id only while its integration is active.
// 401 unauthenticated, 404 unknown Store, 403 Store owned by someone else.
async function loadOwnedStore(storeId: string) {
  const { userId } = auth();
  if (!userId) return { store: null, denied: new NextResponse("Unauthenticated", { status: 401 }) };

  const store = await prismadb.store.findUnique({
    where: { id: storeId },
    select: { id: true, userId: true, ...INTEGRATION_SELECT },
  });
  if (!store) return { store: null, denied: apiError(404, "STORE_NOT_FOUND", "Store not found.") };
  if (store.userId !== userId) return { store: null, denied: new NextResponse("Forbidden", { status: 403 }) };

  return { store, denied: null };
}

// GET /api/stores/:storeId/integrations
// -> { meta: { pixelId, enabled }, tiktok: { pixelId, enabled } } (pixelId null = not connected)
export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    return NextResponse.json(toIntegrationsBody(store));
  } catch (error) {
    console.error("[STORE_INTEGRATIONS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// PATCH /api/stores/:storeId/integrations
// Body: { provider: "meta" | "tiktok", pixelId?: string | null, enabled?: boolean }
// Rules in lib/integrations.ts (parseIntegrationPatch). Returns the GET shape.
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

    const result = parseIntegrationPatch(body, toIntegrationsBody(store));
    if ("error" in result) return new NextResponse(result.error, { status: 400 });

    const { provider, next } = result.value;
    const columns = INTEGRATION_COLUMNS[provider];

    const updated = await prismadb.store.update({
      where: { id: store.id },
      data: { [columns.id]: next.pixelId, [columns.enabled]: next.enabled },
      select: INTEGRATION_SELECT,
    });

    return NextResponse.json(toIntegrationsBody(updated));
  } catch (error) {
    console.error("[STORE_INTEGRATIONS_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
