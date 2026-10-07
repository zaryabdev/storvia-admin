import { formatDeliveryFee } from "@/lib/order-template";
import { formatter } from "@/lib/utils";
import { isStoreEmailDeliveryBlocked } from "@/lib/email/email-delivery";
import { getResendClient } from "@/lib/resend";
import { resolveStoreOwnerEmail as resolveRecipient } from "@/lib/email/resolve-store-owner-email";

type NotificationOrder = {
    storeId: string;
    trackingId: string;
    status: string;
    totalPrice: number;
    /** Decimal snapshot; null on legacy orders. */
    deliveryFee?: unknown;
    createdAt: Date;
    customerName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    postalCode: string;
    country: string;
    customerNotes: string;
    store: { name: string; userId: string };
    orderItems: Array<{
        quantity: number;
        unitPrice: unknown;
        lineTotal: unknown;
        product: {
            name: string;
            price: unknown;
            size: { name: string };
            color: { name: string };
        };
    }>;
};

const escapeHtml = (value: unknown) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const display = (value: string) => value || "—";

export async function sendNewOrderNotification(order: NotificationOrder) {
    // Per-Store kill switch, checked before the provider client is resolved.
    if (await isStoreEmailDeliveryBlocked(order.storeId)) {
        console.info(
            `Order notification skipped: email delivery is blocked for store ${order.storeId}.`,
        );
        return;
    }

    const from = process.env.RESEND_FROM_EMAIL?.trim();
    const resend = getResendClient();

    if (!resend || !from) {
        console.warn(
            "Order notification skipped: RESEND_API_KEY and RESEND_FROM_EMAIL are required.",
        );
        return;
    }

    const recipient = await resolveRecipient(order.store.userId);
    if (!recipient) {
        throw new Error("Store owner has no usable email address");
    }

    const productsText = order.orderItems
        .map(
            ({ product, quantity, lineTotal }) =>
                `${product.name} | Qty: ${quantity} | Size: ${product.size.name} | Color: ${product.color.name} | ${formatter.format(Number(lineTotal))}`,
        )
        .join("\n");

    const address = [
        order.addressLine1,
        order.addressLine2,
        order.city,
        order.postalCode,
        order.country,
    ]
        .filter(Boolean)
        .join(", ");

    // "Rs 200", or "Free" for 0; no line for a legacy order (null).
    const delivery =
        order.deliveryFee == null ? null : formatDeliveryFee(String(order.deliveryFee));

    const rows = [
        ["Store", order.store.name],
        ["Tracking ID", order.trackingId],
        ["Order date", order.createdAt.toLocaleString("en-PK")],
        ["Status", order.status],
        ["Customer name", display(order.customerName)],
        ["Customer phone", display(order.phone)],
        ["Customer email", display(order.email)],
        ["Delivery address", display(address)],
        ["Customer notes", display(order.customerNotes)],
    ];

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><h2>New Order Received</h2><table style="border-collapse:collapse;width:100%;max-width:680px">${rows
        .map(
            ([label, value]) =>
                `<tr><th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;width:180px">${escapeHtml(label)}</th><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}</table><h3>Products</h3><ul>${order.orderItems
        .map(
            ({ product, quantity, lineTotal }) =>
                `<li>${escapeHtml(product.name)} — Qty: ${quantity}, Size: ${escapeHtml(product.size.name)}, Color: ${escapeHtml(product.color.name)}, ${escapeHtml(formatter.format(Number(lineTotal)))}</li>`,
        )
        .join("")}</ul>${delivery === null ? "" : `<p>Delivery: ${escapeHtml(delivery)}</p>`}<p><strong>Order total: ${escapeHtml(formatter.format(order.totalPrice))}</strong></p></body></html>`;

    const text = [
        "New Order Received",
        ...rows.map(([label, value]) => `${label}: ${value}`),
        "",
        "Products:",
        productsText,
        ...(delivery === null ? [] : [`Delivery: ${delivery}`]),
        `Order total: ${formatter.format(order.totalPrice)}`,
    ].join("\n");

    await resend.emails.send({
        from,
        to: recipient,
        subject: `New Order Received — ${order.trackingId}`,
        html,
        text,
    });
}
