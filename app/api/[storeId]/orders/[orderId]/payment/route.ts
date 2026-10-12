import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import { planPaymentUpdate } from "@/lib/order-payment";
import { isBankTransferAvailable } from "@/lib/payment-accounts";
import prismadb from "@/lib/prismadb";

const PAYMENT_SELECT = {
    id: true,
    status: true,
    paymentMethod: true,
    isPaid: true,
    paidAt: true,
    paymentReceivedVia: true,
} as const;

// PATCH /api/:storeId/orders/:orderId/payment (merchant, owner only)
// Body { action: "MARK_PAID", receivedVia } | { action: "MARK_UNPAID" } |
//      { action: "CHANGE_METHOD", paymentMethod: "COD" | "BANK_TRANSFER" }
// -> { id, status, paymentMethod, isPaid, paidAt, paymentReceivedVia }
// Payment is separate from status: no stock, status or confirmedAt change.
// Rules in lib/order-payment.ts (planPaymentUpdate). A repeated identical
// request is a no-op (200); a lost compare-and-set race is 409 CONFLICT.
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
            select: { bankTransferEnabled: true, _count: { select: { paymentAccounts: true } } },
        });

        if (!store) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return apiError(400, "INVALID_REQUEST", "Invalid request body.");
        }

        const order = await prismadb.order.findFirst({
            where: { id: params.orderId, storeId: params.storeId },
            select: PAYMENT_SELECT,
        });

        if (!order) {
            return apiError(404, "ORDER_NOT_FOUND", "Order not found.");
        }

        const plan = planPaymentUpdate(order, body, {
            bankTransferAvailable: isBankTransferAvailable(
                store.bankTransferEnabled,
                store._count.paymentAccounts,
            ),
            now: new Date(),
        });

        if (plan.kind === "error") {
            return apiError(plan.status, plan.error, plan.message);
        }

        if (plan.kind === "noop") {
            return NextResponse.json(order);
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
            select: PAYMENT_SELECT,
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.log("[ORDER_PAYMENT_PATCH]", error);
        return apiError(500, "INTERNAL", "Internal error");
    }
}
