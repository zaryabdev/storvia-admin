// Order creation for the public checkout routes: POST /api/:storeId/cod (always
// COD, kept for older Storefronts) and POST /api/:storeId/checkout (COD or
// BANK_TRANSFER), and for manual orders created by the merchant in Admin
// (POST /api/:storeId/orders, `options.manual`). Pricing, delivery, stock
// validation, the DRAFT status and the new-order email are identical for both
// methods. /cod and /checkout refuse a phone on the Store's blocklist
// (lib/blocked-phones.ts); manual orders never do. Early failures come back as
// ready responses carrying the CORS headers (not for manual orders);
// unexpected errors are thrown to the route, which logs them under its own
// prefix.

import { NextResponse } from "next/server";
import { Prisma, type OrderStatus, type PaymentMethod, type PaymentReceivedVia } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import prismadb from "@/lib/prismadb";
import { createTrackingId } from "@/lib/trackingId";
import { sendNewOrderNotification } from "@/lib/email/send-new-order-notification";
import { customerDetailsError } from "@/lib/order-customer";
import { BLOCKED_ORDER_MESSAGE, blockedPhoneKey } from "@/lib/blocked-phones";
import { InsufficientStockError } from "@/lib/order-confirm";
import { productLabel, unavailableItemsMessage } from "@/lib/manual-order";
import { PreciseDecimal } from "@/lib/decimal";
import {
    DEFAULT_DELIVERY_SETTINGS,
    deliverySettingsFromStore,
    resolveDeliveryCity,
    resolveDeliveryFee,
} from "@/lib/delivery";
import { cityName } from "@/lib/pakistan-cities";
import type { CheckoutPaymentMethod } from "@/lib/order-payment";
import type { PublicPaymentAccount } from "@/lib/payment-accounts";
import { loadBankTransferOption } from "@/lib/payment-settings";

export const ORDER_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const corsHeaders = ORDER_CORS_HEADERS;

type OrderLineInput = {
    productId: string;
    quantity: number;
};

export type CreateOrderPayload = {
    items: OrderLineInput[];
    /** Read by /checkout only; /cod is always COD. */
    paymentMethod?: unknown;
    customer?: {
        name?: string;
        phone?: string;
        email?: string;
    };
    shipping?: {
        line1?: string;
        line2?: string;
        city?: string;
        /** lib/pakistan-cities.ts key ("other" included); older clients omit it. */
        cityKey?: string;
        postalCode?: string;
        country?: string; // "PK"
        notes?: string;
    };
    notes?: string;
};

// What every successful creation reads back (also the order passed to the route).
const CREATED_ORDER_INCLUDE = Prisma.validator<Prisma.OrderInclude>()({
    orderItems: {
        include: {
            product: { include: { size: true, color: true } },
        },
    },
    store: true,
});

export type CreatedOrder = Prisma.OrderGetPayload<{ include: typeof CREATED_ORDER_INCLUDE }>;

export type CreateOrderOptions = {
    /**
     * A manual order (POST /api/:storeId/orders, merchant only). Omitted by
     * /cod and /checkout, which behave exactly as before. A manual order is
     * stored with source MANUAL, inserted inside one transaction that also
     * runs `afterCreate` (confirm, mark paid; a throw there rolls the order
     * back, and a stock shortfall becomes a 409 naming the items), sends no
     * new-order email, and its failures carry no CORS headers and name the
     * unavailable items.
     */
    manual?: {
        afterCreate: (
            tx: Prisma.TransactionClient,
            order: {
                id: string;
                status: OrderStatus;
                paymentMethod: PaymentMethod;
                isPaid: boolean;
                paidAt: Date | null;
                paymentReceivedVia: PaymentReceivedVia | null;
                orderItems: Array<{ productId: string; quantity: number }>;
            },
        ) => Promise<void>;
    };
};

export type CreateOrderResult =
    | { ok: false; response: NextResponse }
    | {
          ok: true;
          /** The /cod response body, unchanged. */
          body: Record<string, unknown>;
          /** The Store's accounts (public shape) for BANK_TRANSFER, else null. */
          paymentAccounts: PublicPaymentAccount[] | null;
          /** The stored order as read back (after `afterCreate` for a manual order). */
          order: CreatedOrder;
      };

// Trimmed string, or "" for a missing or non-string value.
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

function buildAddressString(payload: CreateOrderPayload) {
    const parts: string[] = [];
    const s = payload.shipping;

    if (s?.line1) parts.push(s.line1);
    if (s?.line2) parts.push(s.line2);

    const cityLine = [s?.city, s?.postalCode].filter(Boolean).join(" ");
    if (cityLine) parts.push(cityLine);

    if (s?.country) parts.push(s.country);

    return parts.join(", ");
}

// One indexed lookup by { storeId, phoneKey }. Fails open: if the lookup
// throws, the order is allowed (a blocklist outage must never stop real
// sales); only the error name is logged, never the phone.
async function isPhoneBlocked(storeId: string, phone: unknown): Promise<boolean> {
    const phoneKey = blockedPhoneKey(phone);
    if (!phoneKey) return false;

    try {
        const blocked = await prismadb.blockedPhone.findUnique({
            where: { storeId_phoneKey: { storeId, phoneKey } },
            select: { id: true },
        });
        return blocked !== null;
    } catch (error) {
        console.log("[BLOCKLIST]", error instanceof Error ? error.name : "Unknown error");
        return false;
    }
}

export async function createOrder(
    storeId: string,
    payload: CreateOrderPayload,
    paymentMethod: CheckoutPaymentMethod,
    options: CreateOrderOptions = {},
): Promise<CreateOrderResult> {
    // Public checkout responses carry the CORS headers; the merchant route doesn't.
    const headers = options.manual ? undefined : corsHeaders;
    const failText = (message: string): CreateOrderResult => ({
        ok: false,
        response: new NextResponse(message, { status: 400, headers }),
    });

    const items = payload?.items ?? [];
    if (!Array.isArray(items) || items.length === 0) {
        return failText("Items are required");
    }

    for (const item of items) {
        if (
            !item ||
            typeof item.productId !== "string" ||
            !item.productId ||
            typeof item.quantity !== "number" ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1
        ) {
            return {
                ok: false,
                response: NextResponse.json(
                    {
                        error: "INVALID_ITEM",
                        message: "Each item requires a valid productId and a positive integer quantity.",
                    },
                    { status: 400, headers },
                ),
            };
        }
    }

    const detailsError = customerDetailsError(payload);
    if (detailsError) {
        return failText(detailsError);
    }

    // Phone blocklist: website checkout only (a manual order is never blocked),
    // before any other database read. Nothing is created and no email is sent.
    if (!options.manual && (await isPhoneBlocked(storeId, payload.customer?.phone))) {
        console.log("[ORDER_BLOCKED]", `Store ${storeId}`);
        return failText(BLOCKED_ORDER_MESSAGE);
    }

    // Bank transfer only while the Store offers it (enabled + at least one account).
    let paymentAccounts: PublicPaymentAccount[] | null = null;
    if (paymentMethod === "BANK_TRANSFER") {
        const bankTransfer = await loadBankTransferOption(storeId);
        if (!bankTransfer.available) {
            return failText("Bank transfer isn't available for this store");
        }
        paymentAccounts = bankTransfer.accounts;
    }

    // Delivery: resolve the checkout city against the Store's current
    // settings. The client never sends a fee; the server's fee wins.
    const store = await prismadb.store.findUnique({
        where: { id: storeId },
        select: {
            deliveryArea: true,
            deliveryFee: true,
            freeDeliveryThreshold: true,
            deliveryDaysMin: true,
            deliveryDaysMax: true,
            deliveryCities: { select: { cityKey: true, fee: true } },
        },
    });
    const deliverySettings = store
        ? deliverySettingsFromStore(store, store.deliveryCities)
        : DEFAULT_DELIVERY_SETTINGS;
    const cityKey = resolveDeliveryCity(deliverySettings, {
        cityKey: payload.shipping?.cityKey,
        city: payload.shipping?.city,
    });

    if (!cityKey) {
        return failText("We don't deliver to this city");
    }

    const productIds = items.map((item) => item.productId);

    const products = await prismadb.product.findMany({
        where: { id: { in: productIds }, storeId },
        include: { size: true, color: true },
    });

    const productsById = new Map(products.map((p) => [p.id, p]));
    const labelFor = (productId: string) => {
        const product = productsById.get(productId);
        return product ? productLabel(product) : null;
    };

    const unavailable: Array<{
        productId: string;
        reason: "NOT_FOUND" | "ARCHIVED" | "INSUFFICIENT_STOCK";
        requested: number;
        available?: number;
    }> = [];

    for (const item of items) {
        const product = productsById.get(item.productId);

        if (!product) {
            unavailable.push({
                productId: item.productId,
                reason: "NOT_FOUND",
                requested: item.quantity,
            });
            continue;
        }

        if (product.isArchived) {
            unavailable.push({
                productId: item.productId,
                reason: "ARCHIVED",
                requested: item.quantity,
            });
            continue;
        }

        if (item.quantity > product.quantity) {
            unavailable.push({
                productId: item.productId,
                reason: "INSUFFICIENT_STOCK",
                requested: item.quantity,
                available: product.quantity,
            });
        }
    }

    if (unavailable.length > 0) {
        return {
            ok: false,
            response: NextResponse.json(
                {
                    error: "ORDER_NOT_PLACEABLE",
                    message: options.manual
                        ? unavailableItemsMessage(unavailable, labelFor)
                        : "One or more items are unavailable in the requested quantity.",
                    items: unavailable,
                },
                { status: 400, headers },
            ),
        };
    }

    const calculatedItems = items.map((item) => {
        const product = productsById.get(item.productId)!;
        const unitPrice = new Decimal(product.price);
        const lineTotal = unitPrice.mul(item.quantity);
        return { item, unitPrice, lineTotal };
    });
    const subtotal = calculatedItems.reduce(
        (sum, item) => sum.add(item.lineTotal),
        new Decimal(0),
    );
    const deliveryFee = resolveDeliveryFee(deliverySettings, cityKey, subtotal.toFixed());

    if (deliveryFee === null) {
        return failText("We don't deliver to this city");
    }

    const total = new PreciseDecimal(subtotal).plus(deliveryFee);

    const trackingId = createTrackingId();

    // ✅ normalize + fallbacks
    const customerName = text(payload.customer?.name);
    const email = payload.customer?.email?.trim() ?? "";
    const phone = text(payload.customer?.phone);

    const addressLine1 = text(payload.shipping?.line1);
    const addressLine2 = payload.shipping?.line2?.trim() ?? "";
    // The canonical city name ("Other city" for any other town).
    const city = cityName(cityKey) ?? "";
    // Optional; the column is non-nullable, so a missing value is "".
    const postalCode = text(payload.shipping?.postalCode);
    const country = (payload.shipping?.country?.trim() ?? "PK") || "PK";

    const customerNotes = (
        payload.shipping?.notes ??
        payload.notes ??
        ""
    ).trim();

    // keep this for backward compatibility / display
    const address = buildAddressString(payload);

    // Order creation only records the request — it never adjusts
    // Product.quantity. Stock is committed atomically when an Admin
    // confirms the order (see app/api/[storeId]/orders/[orderId]/route.ts),
    // or by a manual order's `afterCreate` in the same transaction.
    // Every order starts unpaid; only the merchant marks a bank transfer paid.
    // The order's columns; the two inserts below differ only in how the lines
    // are written and what is read back.
    const orderData: Omit<Prisma.OrderUncheckedCreateInput, "orderItems"> = {
        storeId,
        status: "DRAFT",
        paymentMethod,
        trackingId,
        isPaid: false,

        // ✅ NEW: persist to actual columns
        customerName,
        email,
        phone,

        addressLine1,
        addressLine2,
        city,
        postalCode,
        country,
        customerNotes,

        // optional legacy display field
        address,

        subtotal,
        deliveryFee: new PreciseDecimal(deliveryFee),
        total,
        currency: "PKR",
        // Manual orders only; checkout orders keep the column default (WEBSITE).
        ...(options.manual ? { source: "MANUAL" as const } : {}),
    };

    let order: CreatedOrder;

    if (!options.manual) {
        order = await prismadb.order.create({
            data: {
                ...orderData,
                orderItems: {
                    create: calculatedItems.map(({ item, unitPrice, lineTotal }) => ({
                        quantity: item.quantity,
                        unitPrice,
                        lineTotal,
                        product: { connect: { id: item.productId } },
                    })),
                },
            },
            include: CREATED_ORDER_INCLUDE,
        });
    } else {
        // Insert + afterCreate (confirm, mark paid) + read-back commit together
        // or not at all. Every read that doesn't need the transaction (Store,
        // delivery, products, prices) ran above; the stock guarantee is the
        // conditional decrement in afterCreate (lib/order-confirm.ts), which
        // re-checks every line inside the transaction.
        const { afterCreate } = options.manual;
        try {
            order = await prismadb.$transaction(
                async (tx) => {
                    // One INSERT for all lines, and no read-back here: the
                    // full order is read once, after afterCreate.
                    const created = await tx.order.create({
                        data: {
                            ...orderData,
                            orderItems: {
                                createMany: {
                                    data: calculatedItems.map(({ item, unitPrice, lineTotal }) => ({
                                        productId: item.productId,
                                        quantity: item.quantity,
                                        unitPrice,
                                        lineTotal,
                                    })),
                                },
                            },
                        },
                        select: {
                            id: true,
                            status: true,
                            paymentMethod: true,
                            isPaid: true,
                            paidAt: true,
                            paymentReceivedVia: true,
                        },
                    });
                    await afterCreate(tx, {
                        ...created,
                        orderItems: items.map(({ productId, quantity }) => ({ productId, quantity })),
                    });
                    return tx.order.findUniqueOrThrow({
                        where: { id: created.id },
                        include: CREATED_ORDER_INCLUDE,
                    });
                },
                // Each query is one round trip to the database. A 5-line
                // confirmed order is ~15 queries: milliseconds in production,
                // but several seconds from a far-away dev machine, past
                // Prisma's defaults (2 s to start, 5 s to finish → P2028).
                // The bounds still end a stuck transaction, which holds the
                // product rows it decremented.
                { maxWait: 10_000, timeout: 20_000 },
            );
        } catch (error) {
            // Stock ran out between the check above and the confirmation:
            // nothing was created.
            if (error instanceof InsufficientStockError) {
                return {
                    ok: false,
                    response: NextResponse.json(
                        {
                            error: "INSUFFICIENT_STOCK",
                            message: unavailableItemsMessage(
                                error.items.map((item) => ({ ...item, reason: "INSUFFICIENT_STOCK" as const })),
                                labelFor,
                            ),
                            items: error.items,
                        },
                        { status: 409 },
                    ),
                };
            }
            throw error;
        }
    }

    // No new-order email for a manual order: the merchant created it.
    if (!options.manual) {
        try {
            await sendNewOrderNotification({
                ...order,
                totalPrice: Number(total),
            });
        } catch (notificationError) {
            console.error("Order notification failed", notificationError);
        }
    }

    return {
        ok: true,
        paymentAccounts,
        order,
        body: {
            orderId: order.id,
            trackingId,
            status: order.status,
            paymentMethod: order.paymentMethod,

            // ✅ return the structured fields too
            customerName: order.customerName,
            email: order.email,
            phone: order.phone,

            addressLine1: order.addressLine1,
            addressLine2: order.addressLine2,
            city: order.city,
            postalCode: order.postalCode,
            country: order.country,
            customerNotes: order.customerNotes,

            // keep old one if your UI still uses it
            address: order.address,

            products: order.orderItems.map((item) => ({
                id: item.product.id,
                name: item.product.name,
                price: item.product.price,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
                size: item.product.size,
                color: item.product.color,
            })),
            subtotal: order.subtotal,
            deliveryFee,
            total: order.total,
            currency: order.currency,
            totalPrice: Number(total),
            store: { id: order.store.id, name: order.store.name },
        },
    };
}
