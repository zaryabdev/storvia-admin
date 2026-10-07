import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import {
  deliverySettingsFromStore,
  normalizeDeliverySettings,
  toMerchantDeliveryBody,
} from "@/lib/delivery";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

const DELIVERY_SELECT = {
  deliveryArea: true,
  deliveryFee: true,
  freeDeliveryThreshold: true,
  deliveryDaysMin: true,
  deliveryDaysMax: true,
  deliveryCities: { select: { cityKey: true, fee: true } },
} as const;

// Merchant-owned, authenticated. 401 unauthenticated, 404 unknown Store,
// 403 Store owned by someone else. The Storefront reads the public subset
// from GET /api/:storeId/delivery.
async function loadOwnedStore(storeId: string) {
  const { userId } = auth();
  if (!userId) return { store: null, denied: new NextResponse("Unauthenticated", { status: 401 }) };

  const store = await prismadb.store.findUnique({
    where: { id: storeId },
    select: { id: true, userId: true, ...DELIVERY_SELECT },
  });
  if (!store) return { store: null, denied: apiError(404, "STORE_NOT_FOUND", "Store not found.") };
  if (store.userId !== userId) return { store: null, denied: new NextResponse("Forbidden", { status: 403 }) };

  return { store, denied: null };
}

// GET /api/stores/:storeId/delivery-settings
// -> { area, defaultFee, freeDeliveryThreshold, daysMin, daysMax,
//      cities: [{ key, name, selected, fee }] } (all 12; money as strings)
export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { store, denied } = await loadOwnedStore(params.storeId);
    if (denied || !store) return denied;

    return NextResponse.json(toMerchantDeliveryBody(deliverySettingsFromStore(store, store.deliveryCities)));
  } catch (error) {
    console.error("[STORE_DELIVERY_SETTINGS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// PATCH /api/stores/:storeId/delivery-settings
// Body: the full settings object (same shape as GET; `name` is ignored).
// Validated by normalizeDeliverySettings (400 with the message). The Store
// fields and the city rows are replaced in one transaction.
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

    const result = normalizeDeliverySettings(body);
    if ("error" in result) return new NextResponse(result.error, { status: 400 });

    const settings = result.value;

    await prismadb.$transaction([
      prismadb.store.update({
        where: { id: store.id },
        data: {
          deliveryArea: settings.area,
          deliveryFee: settings.defaultFee,
          freeDeliveryThreshold: settings.freeDeliveryThreshold,
          deliveryDaysMin: settings.daysMin,
          deliveryDaysMax: settings.daysMax,
        },
      }),
      prismadb.storeDeliveryCity.deleteMany({ where: { storeId: store.id } }),
      prismadb.storeDeliveryCity.createMany({
        data: settings.cities.map((city) => ({ storeId: store.id, cityKey: city.key, fee: city.fee })),
      }),
    ]);

    return NextResponse.json(toMerchantDeliveryBody(settings));
  } catch (error) {
    console.error("[STORE_DELIVERY_SETTINGS_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
