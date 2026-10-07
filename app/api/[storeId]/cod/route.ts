import prismadb from "@/lib/prismadb";
import { createTrackingId } from "@/lib/trackingId";
import { NextResponse } from "next/server";
import { sendNewOrderNotification } from "@/lib/email/send-new-order-notification";
import { Decimal } from "@prisma/client/runtime/library";
import { PAKISTANI_MOBILE_MESSAGE, isPakistaniMobile } from "@/lib/phone";
import { PreciseDecimal } from "@/lib/decimal";
import {
    DEFAULT_DELIVERY_SETTINGS,
    deliverySettingsFromStore,
    resolveDeliveryCity,
    resolveDeliveryFee,
} from "@/lib/delivery";
import { cityName } from "@/lib/pakistan-cities";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

type OrderLineInput = {
    productId: string;
    quantity: number;
};

type CreateOrderPayload = {
    items: OrderLineInput[];
    paymentMethod?: "COD";
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

// Trimmed string, or "" for a missing or non-string value.
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// Required customer/shipping fields, checked before any database read. Returns
// the plain-text message the Storefront shows, or null when they are valid.
// Postal code, email, line 2 and notes are optional.
function customerDetailsError(payload: CreateOrderPayload): string | null {
    if (!text(payload.customer?.name)) return "Name is required";
    if (!text(payload.customer?.phone)) return "Phone is required";
    if (!isPakistaniMobile(text(payload.customer?.phone))) return PAKISTANI_MOBILE_MESSAGE;
    if (!text(payload.shipping?.line1)) return "Address line 1 is required";
    if (!text(payload.shipping?.city) && !text(payload.shipping?.cityKey)) return "City is required";

    return null;
}

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

export async function POST(
    req: Request,
    { params }: { params: { storeId: string } },
) {
    try {
        const payload = (await req.json()) as CreateOrderPayload;

        const items = payload?.items ?? [];
        if (!Array.isArray(items) || items.length === 0) {
            return new NextResponse("Items are required", {
                status: 400,
                headers: corsHeaders,
            });
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
                return NextResponse.json(
                    {
                        error: "INVALID_ITEM",
                        message: "Each item requires a valid productId and a positive integer quantity.",
                    },
                    { status: 400, headers: corsHeaders },
                );
            }
        }

        const detailsError = customerDetailsError(payload);
        if (detailsError) {
            return new NextResponse(detailsError, {
                status: 400,
                headers: corsHeaders,
            });
        }

        // Delivery: resolve the checkout city against the Store's current
        // settings. The client never sends a fee; the server's fee wins.
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
        const deliverySettings = store
            ? deliverySettingsFromStore(store, store.deliveryCities)
            : DEFAULT_DELIVERY_SETTINGS;
        const cityKey = resolveDeliveryCity(deliverySettings, {
            cityKey: payload.shipping?.cityKey,
            city: payload.shipping?.city,
        });

        if (!cityKey) {
            return new NextResponse("We don't deliver to this city", {
                status: 400,
                headers: corsHeaders,
            });
        }

        const productIds = items.map((item) => item.productId);

        const products = await prismadb.product.findMany({
            where: { id: { in: productIds }, storeId: params.storeId },
            include: { size: true, color: true },
        });

        const productsById = new Map(products.map((p) => [p.id, p]));

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
            return NextResponse.json(
                {
                    error: "ORDER_NOT_PLACEABLE",
                    message: "One or more items are unavailable in the requested quantity.",
                    items: unavailable,
                },
                { status: 400, headers: corsHeaders },
            );
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
            return new NextResponse("We don't deliver to this city", {
                status: 400,
                headers: corsHeaders,
            });
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
        // confirms the order (see app/api/[storeId]/orders/[orderId]/route.ts).
        const order = await prismadb.order.create({
            data: {
                storeId: params.storeId,
                status: "DRAFT",
                paymentMethod: "COD",
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

                orderItems: {
                    create: calculatedItems.map(({ item, unitPrice, lineTotal }) => ({
                        quantity: item.quantity,
                        unitPrice,
                        lineTotal,
                        product: { connect: { id: item.productId } },
                    })),
                },
                subtotal,
                deliveryFee: new PreciseDecimal(deliveryFee),
                total,
                currency: "PKR",
            },
            include: {
                orderItems: {
                    include: {
                        product: { include: { size: true, color: true } },
                    },
                },
                store: true,
            },
        });

        try {
            await sendNewOrderNotification({
                ...order,
                totalPrice: Number(total),
            });
        } catch (notificationError) {
            console.error("Order notification failed", notificationError);
        }

        return NextResponse.json(
            {
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
            { headers: corsHeaders },
        );
    } catch (error) {
        console.log("[COD_POST]", error);
        return new NextResponse("Internal error", {
            status: 500,
            headers: corsHeaders,
        });
    }
}
