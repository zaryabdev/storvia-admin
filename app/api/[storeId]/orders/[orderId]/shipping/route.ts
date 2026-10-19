import { auth } from "@clerk/nextjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import { parseShippingPatch, planShippingUpdate } from "@/lib/couriers";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

const SHIPPING_SELECT = {
    id: true,
    courier: true,
    courierName: true,
    trackingNumber: true,
} as const;

// PATCH /api/:storeId/orders/:orderId/shipping (merchant, owner only)
// Body { courier, courierName?, trackingNumber } | { courier: null } (clears all three)
// -> { id, courier, courierName, trackingNumber }
// Setting/editing only while CONFIRMED or DELIVERED; clearing in any status.
// No status, stock, confirmedAt or payment change. Rules in lib/couriers.ts.
// A repeated identical request is a no-op (200); a lost compare-and-set race
// is 409 CONFLICT.
export async function PATCH(
    req: Request,
    { params }: { params: { storeId: string; orderId: string } },
) {
    try {
        const { userId } = auth();

        if (!userId) {
            return new NextResponse("Unauthenticated", { status: 401 });
        }

        const store = await prismadb.store.findFirst({
            where: { id: params.storeId, userId },
            select: { id: true },
        });

        if (!store) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return apiError(400, "INVALID_REQUEST", "Invalid request body");
        }

        const parsed = parseShippingPatch(body);

        if ("error" in parsed) {
            return apiError(400, parsed.error, parsed.message);
        }

        const order = await prismadb.order.findFirst({
            where: { id: params.orderId, storeId: params.storeId },
            select: { ...SHIPPING_SELECT, status: true },
        });

        if (!order) {
            return apiError(404, "ORDER_NOT_FOUND", "Order not found.");
        }

        const plan = planShippingUpdate(order, parsed.value);

        if (plan.kind === "error") {
            return apiError(plan.status, plan.error, plan.message);
        }

        if (plan.kind === "noop") {
            return NextResponse.json({
                id: order.id,
                courier: order.courier,
                courierName: order.courierName,
                trackingNumber: order.trackingNumber,
            });
        }

        const claim = await prismadb.order.updateMany({
            where: { id: params.orderId, storeId: params.storeId, ...plan.where },
            data: plan.data,
        });

        if (claim.count !== 1) {
            return apiError(409, "CONFLICT", "This order was updated concurrently. Please retry.");
        }

        const updated = await prismadb.order.findUniqueOrThrow({
            where: { id: params.orderId },
            select: SHIPPING_SELECT,
        });

        return NextResponse.json(updated);
    } catch (error) {
        // Never log the body. Prisma validation errors echo the query
        // arguments, so only their name is logged.
        console.log("[ORDER_SHIPPING_PATCH]", error instanceof Prisma.PrismaClientValidationError ? error.name : error);
        return apiError(500, "INTERNAL", "Internal error");
    }
}
