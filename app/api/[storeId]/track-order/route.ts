import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { publicCourier } from "@/lib/couriers";
import { PreciseDecimal } from "@/lib/decimal";
import { formatDeliveryDays } from "@/lib/delivery";
import { MAX_TRACKING_ID_LENGTH, phonesMatch, trackingIdCandidates } from "@/lib/order-tracking";
import { loadPublicPaymentAccounts } from "@/lib/payment-settings";
import prismadb from "@/lib/prismadb";

export const dynamic = "force-dynamic";

// Same CORS as POST /api/:storeId/cod, on every response.
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const headers = { ...corsHeaders, "Cache-Control": "no-store" };

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

const invalidRequest = () =>
    NextResponse.json(
        { error: "INVALID_REQUEST", message: "Enter your order number and phone number." },
        { status: 400, headers },
    );

// One response for an unknown Store, an unknown id, another Store's order and a
// wrong phone, so a caller never learns which part failed.
const orderNotFound = () =>
    NextResponse.json(
        { error: "ORDER_NOT_FOUND", message: "We couldn't find an order with these details." },
        { status: 404, headers },
    );

const money = (value: Prisma.Decimal.Value) => new PreciseDecimal(value.toString());

// POST /api/:storeId/track-order (public, guest order tracking)
// Body { trackingId, phone } -> { order: { trackingId, status, createdAt,
//   confirmedAt, items: [{ name, size, color, quantity, unitPrice, lineTotal }],
//   subtotal, deliveryFee, total, currency, city, deliveryDays, paymentMethod,
//   isPaid, paymentAccounts, courier } }
// Money as decimal strings. No customer details, payment dates/channels or
// internal ids. paymentAccounts: the Store's live accounts (public shape) for an
// unpaid, not canceled BANK_TRANSFER order, else null. courier: { name,
// trackingNumber } for a CONFIRMED / DELIVERED order with both set, else null
// (never the courier key). Rules: DECISIONS.md → Guest order tracking.
export async function POST(req: Request, { params }: { params: { storeId: string } }) {
    try {
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return invalidRequest();
        }

        if (!body || typeof body !== "object") return invalidRequest();

        const { trackingId: rawTrackingId, phone: rawPhone } = body as Record<string, unknown>;
        if (typeof rawTrackingId !== "string" || typeof rawPhone !== "string") return invalidRequest();

        const trackingId = rawTrackingId.trim();
        const phone = rawPhone.trim();
        if (!trackingId || !phone) return invalidRequest();

        if (trackingId.length > MAX_TRACKING_ID_LENGTH) return orderNotFound();

        const order = await prismadb.order.findFirst({
            where: { storeId: params.storeId, trackingId: { in: trackingIdCandidates(trackingId) } },
            include: {
                orderItems: {
                    include: {
                        product: {
                            select: { name: true, price: true, size: { select: { value: true } }, color: { select: { name: true } } },
                        },
                    },
                },
                store: { select: { deliveryDaysMin: true, deliveryDaysMax: true } },
            },
        });

        if (!order || !phonesMatch(order.phone, phone)) return orderNotFound();

        // Snapshot money where present; legacy rows fall back to the live price
        // (same fallback as the packing slip and the orders page).
        const lines = order.orderItems.map((item) => {
            const unitPrice = money(item.unitPrice ?? item.product.price);
            const lineTotal = item.lineTotal != null ? money(item.lineTotal) : unitPrice.times(item.quantity);

            return { item, unitPrice, lineTotal };
        });
        const itemsSum = lines.reduce((sum, { lineTotal }) => sum.plus(lineTotal), new PreciseDecimal(0));
        const subtotal = order.subtotal != null ? money(order.subtotal) : itemsSum;
        // Snapshot total already includes delivery; a legacy order has neither.
        const total = order.total != null ? money(order.total) : subtotal;
        const confirmed = order.status === "CONFIRMED" || order.status === "DELIVERED";
        // Where to pay, while a bank transfer is still due (live accounts, even
        // if bank transfer was switched off since; may be []).
        const paymentAccounts =
            order.paymentMethod === "BANK_TRANSFER" && !order.isPaid && order.status !== "CANCELED"
                ? await loadPublicPaymentAccounts(order.storeId)
                : null;

        return NextResponse.json(
            {
                order: {
                    trackingId: order.trackingId,
                    status: order.status,
                    createdAt: order.createdAt,
                    confirmedAt: confirmed ? order.confirmedAt : null,
                    items: lines.map(({ item, unitPrice, lineTotal }) => ({
                        name: item.product.name,
                        size: item.product.size?.value ?? null,
                        color: item.product.color?.name ?? null,
                        quantity: item.quantity,
                        unitPrice: unitPrice.toFixed(),
                        lineTotal: lineTotal.toFixed(),
                    })),
                    subtotal: subtotal.toFixed(),
                    deliveryFee: order.deliveryFee != null ? money(order.deliveryFee).toFixed() : null,
                    total: total.toFixed(),
                    currency: order.currency ?? "PKR",
                    city: order.city,
                    deliveryDays: formatDeliveryDays(order.store.deliveryDaysMin, order.store.deliveryDaysMax),
                    paymentMethod: order.paymentMethod,
                    isPaid: order.isPaid,
                    paymentAccounts,
                    courier: publicCourier(order),
                },
            },
            { headers },
        );
    } catch (error) {
        // Never log the body (phones, tracking ids). Prisma validation errors
        // echo the query arguments, so only their name is logged.
        console.log("[TRACK_ORDER]", error instanceof Prisma.PrismaClientValidationError ? error.name : error);
        return NextResponse.json(
            { error: "INTERNAL", message: "Something went wrong. Please try again." },
            { status: 500, headers },
        );
    }
}
