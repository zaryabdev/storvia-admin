import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import prismadb from "@/lib/prismadb";
import { getSalesByStore, singleCurrencySales } from "@/lib/store-sales";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const superAdminId = process.env.SUPER_ADMIN_CLERK_USER_ID?.trim();

    if (!superAdminId) {
      console.error(
        "[SUPER_ADMIN_STORES_GET] SUPER_ADMIN_CLERK_USER_ID is not configured; denying all Super Admin access"
      );
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (userId !== superAdminId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Constant number of queries however many Stores: the Stores, then the
    // shared sales helper's two (lib/store-sales.ts).
    const [stores, salesByStore] = await Promise.all([
      prismadb.store.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      getSalesByStore(),
    ]);

    const result = stores.map((store) => {
      // Throws on mixed currencies: never silently sum them.
      const { currency, total } = singleCurrencySales(store.id, salesByStore.get(store.id));

      return {
        id: store.id,
        name: store.name,
        createdAt: store.createdAt,
        orderCount: store._count.orders,
        salesTotal: total.toFixed(),
        currency,
      };
    });

    return NextResponse.json({ stores: result });
  } catch (error) {
    console.error("[SUPER_ADMIN_STORES_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
