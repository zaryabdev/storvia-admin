import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";

import prismadb from "@/lib/prismadb";
import { PreciseDecimal } from "@/lib/decimal";
import { getLegacyOrderTotals } from "@/lib/store-sales";

export const dynamic = "force-dynamic";

const DEFAULT_CURRENCY = "PKR";
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Malformed or out-of-range values are normalized, never rejected.
const parsePositiveInt = (value: string | null, fallback: number) => {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback;
};

export async function GET(
  req: Request,
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
        "[SUPER_ADMIN_STORE_ORDERS_GET] SUPER_ADMIN_CLERK_USER_ID is not configured; denying all Super Admin access"
      );
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (userId !== superAdminId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(
      parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );

    const store = await prismadb.store.findUnique({
      where: { id: params.storeId },
      select: { id: true },
    });

    if (!store) {
      return new NextResponse("Store not found", { status: 404 });
    }

    const [totalCount, rows] = await Promise.all([
      prismadb.order.count({ where: { storeId: store.id } }),
      prismadb.order.findMany({
        where: { storeId: store.id },
        // id tiebreaker keeps page boundaries stable for equal timestamps.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          trackingId: true,
          createdAt: true,
          status: true,
          paymentMethod: true,
          total: true,
          currency: true,
          _count: { select: { orderItems: true } },
        },
      }),
    ]);

    // Legacy orders (total IS NULL) only: priced from the Products, in one
    // query for the page (shared fallback in lib/store-sales.ts).
    const legacyTotals = await getLegacyOrderTotals(
      rows.filter((r) => r.total === null).map((r) => r.id)
    );

    const orders = rows.map((order) => {
      const total =
        order.total !== null
          ? new PreciseDecimal(order.total)
          : legacyTotals.get(order.id) ?? new PreciseDecimal(0);

      return {
        id: order.id,
        trackingId: order.trackingId,
        createdAt: order.createdAt,
        status: order.status,
        itemCount: order._count.orderItems,
        total: total.toFixed(),
        currency: order.currency ?? DEFAULT_CURRENCY,
        paymentMethod: order.paymentMethod,
      };
    });

    return NextResponse.json({
      orders,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error("[SUPER_ADMIN_STORE_ORDERS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
