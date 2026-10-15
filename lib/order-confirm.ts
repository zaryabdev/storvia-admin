// The transition into CONFIRMED (from DRAFT or CANCELED), run inside the
// caller's transaction. Shared by the order status PATCH (Mark Confirmed) and
// manual order creation ("Create as confirmed"). Throws on a lost claim or a
// stock shortfall, so the caller's transaction rolls back everything — never a
// partial confirmation.

import type { OrderStatus, Prisma } from "@prisma/client";

export class InsufficientStockError extends Error {
    items: Array<{ productId: string; requested: number; available: number }>;
    constructor(items: Array<{ productId: string; requested: number; available: number }>) {
        super("Insufficient stock");
        this.items = items;
    }
}

export class TransitionConflictError extends Error {
    constructor() {
        super("Order was updated concurrently");
    }
}

// Atomically claims the status transition (compare-and-set on the previous
// status) and conditionally decrements stock for every line.
//
// confirmedAt is set/overwritten in the same claim write as the status change
// (DRAFT->CONFIRMED and CANCELED->CONFIRMED both land here), so the timestamp
// is authoritative for the latest successful confirmation and can never be
// written by a transition that fails or loses the compare-and-set race.
export async function confirmOrderInTransaction(
    tx: Prisma.TransactionClient,
    {
        orderId,
        storeId,
        previousStatus,
        items,
        confirmedAt,
    }: {
        orderId: string;
        storeId: string;
        previousStatus: OrderStatus;
        items: Array<{ productId: string; quantity: number }>;
        confirmedAt: Date;
    },
): Promise<void> {
    const claim = await tx.order.updateMany({
        where: {
            id: orderId,
            storeId,
            status: previousStatus,
        },
        data: { status: "CONFIRMED", confirmedAt },
    });

    if (claim.count !== 1) {
        throw new TransitionConflictError();
    }

    const failures: Array<{
        productId: string;
        requested: number;
        available: number;
    }> = [];

    for (const item of items) {
        const decremented = await tx.product.updateMany({
            where: {
                id: item.productId,
                storeId,
                isArchived: false,
                quantity: { gte: item.quantity },
            },
            data: { quantity: { decrement: item.quantity } },
        });

        if (decremented.count !== 1) {
            const product = await tx.product.findUnique({
                where: { id: item.productId },
            });
            failures.push({
                productId: item.productId,
                requested: item.quantity,
                available: product?.quantity ?? 0,
            });
        }
    }

    if (failures.length > 0) {
        throw new InsufficientStockError(failures);
    }
}
