import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs";
import prismadb from "@/lib/prismadb";
import { getStoreSalesByCurrency, singleCurrencySales } from "@/lib/store-sales";

export const dynamic = "force-dynamic";

async function getOwner(userId: string) {
  try {
    const user = await clerkClient.users.getUser(userId);
    const primary = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId
    );

    return {
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null,
    };
  } catch (error) {
    // Owner may be deleted in Clerk; the Store detail should still load.
    console.error("[SUPER_ADMIN_STORE_GET] owner lookup failed", error);
    return { userId, firstName: null, lastName: null, email: null };
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const superAdminId = process.env.SUPER_ADMIN_CLERK_USER_ID?.trim();

    if (!superAdminId) {
      console.error(
        "[SUPER_ADMIN_STORE_GET] SUPER_ADMIN_CLERK_USER_ID is not configured; denying all Super Admin access"
      );
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (userId !== superAdminId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const store = await prismadb.store.findUnique({
      where: { id: params.storeId },
      select: {
        id: true,
        name: true,
        userId: true,
        createdAt: true,
        emailDeliveryBlocked: true,
        _count: { select: { orders: true } },
      },
    });

    if (!store) {
      return new NextResponse("Store not found", { status: 404 });
    }

    const [byCurrency, owner] = await Promise.all([
      getStoreSalesByCurrency(store.id),
      getOwner(store.userId),
    ]);

    // Throws on mixed currencies: never silently sum them.
    const { currency, total: salesTotal } = singleCurrencySales(store.id, byCurrency);

    return NextResponse.json({
      store: {
        id: store.id,
        name: store.name,
        createdAt: store.createdAt,
        emailDeliveryBlocked: store.emailDeliveryBlocked,
        orderCount: store._count.orders,
        salesTotal: salesTotal.toFixed(),
        currency,
        owner,
      },
    });
  } catch (error) {
    console.error("[SUPER_ADMIN_STORE_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
