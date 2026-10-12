"use client";

import { Badge } from "@/components/ui/badge";
import { paymentBadge } from "@/lib/order-payment";
import { cn } from "@/lib/utils";

import type { OrderColumn } from "./columns";

type PaymentFields = Pick<OrderColumn, "paymentMethod" | "isPaid" | "paymentReceivedVia">;

// The payment method as shown in the orders list: "Bank transfer" for bank
// transfer orders; other methods keep their raw value ("COD").
export const paymentMethodText = (paymentMethod: string) =>
    paymentMethod === "BANK_TRANSFER" ? "Bank transfer" : paymentMethod;

// "Awaiting payment" (amber) or "Paid · via JazzCash" (green), bank transfer
// orders only; nothing for COD.
export function PaymentBadge({ order, className }: { order: PaymentFields; className?: string }) {
    const badge = paymentBadge(order);

    if (!badge) return null;

    return (
        <Badge
            className={cn(
                "whitespace-nowrap",
                badge.kind === "paid"
                    ? "border-transparent bg-green-600 text-white hover:bg-green-600/80"
                    : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-50",
                className,
            )}
        >
            {badge.text}
        </Badge>
    );
}

// Method text plus the badge (table cell, phone card).
export function PaymentSummary({ order, className }: { order: PaymentFields; className?: string }) {
    return (
        <div className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", className)}>
            <span>{paymentMethodText(order.paymentMethod)}</span>
            <PaymentBadge order={order} />
        </div>
    );
}
