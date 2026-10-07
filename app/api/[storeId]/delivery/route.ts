import { NextResponse } from "next/server";

import { deliverySettingsFromStore, formatDeliveryDays, getDeliveryOptions } from "@/lib/delivery";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

// GET /api/:storeId/delivery (public, for the Storefront checkout)
// -> { area, defaultFee, freeDeliveryThreshold, daysMin, daysMax, daysLabel,
//      cities: [{ key, name, fee }], otherCityAllowed, lockedCityKey }
// Money as decimal strings. City fees are before the free-delivery threshold,
// which applies to the items subtotal. Unknown Store: 404 "Not found" (same as
// GET /api/stores/:storeId and the homepage billboard read).
export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  try {
    if (!params.storeId) {
      return new NextResponse("Store id is required", { status: 400 });
    }

    const store = await prismadb.store.findUnique({
      where: { id: params.storeId },
      select: {
        deliveryArea: true,
        deliveryFee: true,
        freeDeliveryThreshold: true,
        deliveryDaysMin: true,
        deliveryDaysMax: true,
        deliveryCities: { select: { cityKey: true, fee: true } },
      },
    });

    if (!store) {
      return new NextResponse("Not found", { status: 404 });
    }

    const settings = deliverySettingsFromStore(store, store.deliveryCities);
    const options = getDeliveryOptions(settings);

    return NextResponse.json({
      area: settings.area,
      defaultFee: settings.defaultFee,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
      daysMin: settings.daysMin,
      daysMax: settings.daysMax,
      daysLabel: formatDeliveryDays(settings.daysMin, settings.daysMax),
      cities: options.cities,
      otherCityAllowed: options.otherCityAllowed,
      lockedCityKey: options.lockedCityKey,
    });
  } catch (error) {
    console.log("[PUBLIC_DELIVERY_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
