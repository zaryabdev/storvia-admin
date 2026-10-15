// Manual orders (created by the merchant in Admin): the extra request fields of
// POST /api/:storeId/orders, the item error text and the form's totals preview.
// Pure, no Prisma client or React, so the "New order" form runs the same rules.
// Pricing, delivery, stock and the money snapshot stay in lib/order-create.ts.
// Rules: DECISIONS.md → Manual order creation.

import { Prisma } from "@prisma/client";

import { resolveDeliveryFee, type DeliverySettings } from "./delivery";
import {
    isPaymentReceivedVia,
    readCheckoutPaymentMethod,
    type CheckoutPaymentMethod,
    type PaymentReceivedViaValue,
} from "./order-payment";

// Same configuration as lib/delivery.ts (100 digits, browser-safe Decimal).
const Money = Prisma.Decimal.clone({ precision: 100 });

export interface ManualOrderRequest {
    paymentMethod: CheckoutPaymentMethod;
    /** Create as CONFIRMED (stock reduced now) instead of DRAFT. */
    confirm: boolean;
    /** "Already paid": how the money was received; bank transfer only. */
    paidVia: PaymentReceivedViaValue | null;
}

// The fields a manual order adds to the /checkout body, checked before the
// shared order checks. Returns the plain-text 400 message on a problem.
// `confirm` omitted = false; `paid` omitted or null = not paid.
export function readManualOrderRequest(body: unknown): { value: ManualOrderRequest } | { error: string } {
    const checked = readCheckoutPaymentMethod(body);
    if ("error" in checked) return checked;

    const input = body as Record<string, unknown>;

    if (input.confirm !== undefined && typeof input.confirm !== "boolean") {
        return { error: "Invalid request body" };
    }

    let paidVia: PaymentReceivedViaValue | null = null;
    if (input.paid !== undefined && input.paid !== null) {
        if (typeof input.paid !== "object" || Array.isArray(input.paid)) {
            return { error: "Invalid request body" };
        }
        // COD orders are never marked paid (same rule as Mark paid).
        if (checked.paymentMethod !== "BANK_TRANSFER") {
            return { error: "Only bank transfer orders can be marked paid." };
        }

        const receivedVia = (input.paid as Record<string, unknown>).receivedVia;
        if (!isPaymentReceivedVia(receivedVia)) {
            return { error: "Choose how you received the money." };
        }
        paidVia = receivedVia;
    }

    return { value: { paymentMethod: checked.paymentMethod, confirm: input.confirm === true, paidVia } };
}

// The 200 body of POST /api/:storeId/orders: the stored order (money as
// decimal strings, dates as ISO strings).
export interface ManualOrderResponse {
    id: string;
    trackingId: string;
    status: "DRAFT" | "CONFIRMED";
    source: "MANUAL";
    paymentMethod: CheckoutPaymentMethod;
    isPaid: boolean;
    paidAt: string | null;
    paymentReceivedVia: PaymentReceivedViaValue | null;
    createdAt: string;
    confirmedAt: string | null;
    customerName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    postalCode: string;
    country: string;
    customerNotes: string;
    items: Array<{
        productId: string;
        name: string;
        size: string | null;
        color: string | null;
        quantity: number;
        unitPrice: string;
        lineTotal: string;
    }>;
    subtotal: string;
    deliveryFee: string;
    total: string;
    currency: string;
}

// "Lawn suit (M, Blue)": the product name with its size value and color name,
// like the WhatsApp item lines; parentheses only when either exists.
export function productLabel(product: {
    name: string;
    size?: { value: string } | null;
    color?: { name: string } | null;
}): string {
    const options = [product.size?.value, product.color?.name].filter(Boolean).join(", ");
    return options ? `${product.name} (${options})` : product.name;
}

export type UnavailableItem = {
    productId: string;
    reason: "NOT_FOUND" | "ARCHIVED" | "INSUFFICIENT_STOCK";
    requested: number;
    available?: number;
};

// The merchant-facing message naming each unavailable item, e.g.
// "Not enough stock for Lawn suit (M, Blue): 2 left, 3 requested."
// An unknown or other-Store product has no name to show.
export function unavailableItemsMessage(
    items: UnavailableItem[],
    labelFor: (productId: string) => string | null,
): string {
    const parts = items.map((item) => {
        const label = labelFor(item.productId);

        if (item.reason === "NOT_FOUND" || !label) return "A product in this order wasn't found in your store";
        if (item.reason === "ARCHIVED") return `${label} is archived`;
        if (!item.available) return `${label} is out of stock`;

        return `Not enough stock for ${label}: ${item.available} left, ${item.requested} requested`;
    });

    return `${Array.from(new Set(parts)).join(". ")}.`;
}

// The form's summary before the order exists: items subtotal from the listed
// prices, the delivery fee from the same rules the server uses
// (resolveDeliveryFee) and the total. Decimal strings; `deliveryFee` and
// `total` are null until a served city is chosen. The server's values win.
export function previewOrderTotals(
    lines: Array<{ price: string; quantity: number }>,
    settings: DeliverySettings,
    cityKey: string | null,
): { subtotal: string; deliveryFee: string | null; total: string | null } {
    const subtotal = lines.reduce((sum, line) => sum.plus(new Money(line.price).times(line.quantity)), new Money(0));
    const deliveryFee = cityKey ? resolveDeliveryFee(settings, cityKey, subtotal.toFixed()) : null;

    return {
        subtotal: subtotal.toFixed(),
        deliveryFee,
        total: deliveryFee === null ? null : subtotal.plus(deliveryFee).toFixed(),
    };
}

// Product search in the form: every whitespace-separated term must appear in
// the name (case-insensitive). A blank query matches everything.
export function matchesProductName(name: string, query: string): boolean {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const haystack = name.toLowerCase();

    return terms.every((term) => haystack.includes(term));
}
