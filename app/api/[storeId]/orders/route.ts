import { auth } from "@clerk/nextjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/billing-plan";
import { readManualOrderRequest, type ManualOrderResponse } from "@/lib/manual-order";
import { confirmOrderInTransaction } from "@/lib/order-confirm";
import { createOrder, type CreateOrderPayload, type CreatedOrder } from "@/lib/order-create";
import { planPaymentUpdate } from "@/lib/order-payment";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

const money = (value: Prisma.Decimal | null) => (value === null ? "0" : value.toFixed());

function toResponse(order: CreatedOrder): ManualOrderResponse {
    return {
        id: order.id,
        trackingId: order.trackingId,
        status: order.status as ManualOrderResponse["status"],
        source: "MANUAL",
        paymentMethod: order.paymentMethod as ManualOrderResponse["paymentMethod"],
        isPaid: order.isPaid,
        paidAt: order.paidAt?.toISOString() ?? null,
        paymentReceivedVia: order.paymentReceivedVia,
        createdAt: order.createdAt.toISOString(),
        confirmedAt: order.confirmedAt?.toISOString() ?? null,
        customerName: order.customerName,
        email: order.email,
        phone: order.phone,
        addressLine1: order.addressLine1,
        addressLine2: order.addressLine2,
        city: order.city,
        postalCode: order.postalCode,
        country: order.country,
        customerNotes: order.customerNotes,
        items: order.orderItems.map((item) => ({
            productId: item.productId,
            name: item.product.name,
            size: item.product.size?.value ?? null,
            color: item.product.color?.name ?? null,
            quantity: item.quantity,
            unitPrice: money(item.unitPrice),
            lineTotal: money(item.lineTotal),
        })),
        subtotal: money(order.subtotal),
        deliveryFee: money(order.deliveryFee),
        total: money(order.total),
        currency: order.currency ?? "PKR",
    };
}

// POST /api/:storeId/orders (merchant, owner only): a manual order created in
// Admin. Body = the /checkout body ({ items: [{ productId, quantity }],
// customer, shipping incl. cityKey, notes, paymentMethod: "COD" |
// "BANK_TRANSFER" }) plus `confirm: boolean` and `paid: { receivedVia } | null`.
// Pricing, delivery, stock validation, the money snapshot and the tracking id
// come from the shared engine (lib/order-create.ts), with source MANUAL and no
// new-order email. Creation, "Create as confirmed" (the Mark Confirmed
// transition: stock decrement + confirmedAt, lib/order-confirm.ts) and
// "Already paid" (the Mark paid rule, planPaymentUpdate) run in ONE
// transaction: if any step fails, nothing is created.
// 401 unauthenticated, 404 unknown Store, 403 another owner's Store; a product
// of another Store is 400 like an unknown one; a timed-out creating
// transaction is 503 ORDER_NOT_CREATED (nothing created). Rules: DECISIONS.md → Manual
// order creation. The body (customer details) is never logged.
export async function POST(req: Request, { params }: { params: { storeId: string } }) {
    try {
        const { userId } = auth();
        if (!userId) return new NextResponse("Unauthenticated", { status: 401 });

        const store = await prismadb.store.findUnique({
            where: { id: params.storeId },
            select: { id: true, userId: true },
        });
        if (!store) return apiError(404, "STORE_NOT_FOUND", "Store not found.");
        if (store.userId !== userId) return new NextResponse("Forbidden", { status: 403 });

        // Parse errors echo the body, so they are never logged.
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            body = undefined;
        }

        // Not a JSON object → "Invalid request body"; then the method, confirm and paid.
        const request = readManualOrderRequest(body);
        if ("error" in request) return new NextResponse(request.error, { status: 400 });

        const { paymentMethod, confirm, paidVia } = request.value;

        const result = await createOrder(store.id, body as CreateOrderPayload, paymentMethod, {
            manual: {
                // Inside the creating transaction; a throw rolls the order back.
                afterCreate: async (tx, order) => {
                    if (confirm) {
                        await confirmOrderInTransaction(tx, {
                            orderId: order.id,
                            storeId: store.id,
                            previousStatus: order.status,
                            items: order.orderItems,
                            confirmedAt: new Date(),
                        });
                    }

                    if (paidVia) {
                        // Bank transfer only (checked above and by the plan).
                        const plan = planPaymentUpdate(
                            order,
                            { action: "MARK_PAID", receivedVia: paidVia },
                            { bankTransferAvailable: true, now: new Date() },
                        );
                        if (plan.kind !== "update") throw new Error("Manual order: mark paid not applicable");

                        const claim = await tx.order.updateMany({
                            where: { id: order.id, storeId: store.id, ...plan.where },
                            data: plan.data,
                        });
                        if (claim.count !== 1) throw new Error("Manual order: mark paid lost its claim");
                    }
                },
            },
        });
        if (!result.ok) return result.response;

        return NextResponse.json(toResponse(result.order));
    } catch (error) {
        // The creating transaction timed out or was already closed (P2028,
        // e.g. a slow database connection). It was rolled back, so nothing
        // was created and trying again is safe. Only the code is logged.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028") {
            console.log("[ORDERS_POST]", error.code);
            return apiError(503, "ORDER_NOT_CREATED", "Couldn't create the order. Please try again.");
        }

        // Never log the body (customer details). Prisma validation errors echo
        // the query arguments, so only their name is logged.
        console.log(
            "[ORDERS_POST]",
            error instanceof Prisma.PrismaClientValidationError ? error.name : error,
        );
        return new NextResponse("Internal error", { status: 500 });
    }
}
