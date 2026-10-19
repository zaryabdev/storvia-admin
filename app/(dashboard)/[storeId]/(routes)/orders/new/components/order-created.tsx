"use client";

import { CheckCircle2, Copy, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import type { ManualOrderResponse } from "@/lib/manual-order";
import { orderStatusLabel } from "@/lib/order-status";
import { formatDeliveryFee } from "@/lib/order-template";
import type { PublicPaymentAccount } from "@/lib/payment-accounts";
import { formatter } from "@/lib/utils";
import { buildOrderWhatsAppUrl, whatsAppKindFor } from "@/lib/whatsapp-message";

import { PaymentSummary } from "../../components/payment-badge";
import { PrintSlipButton } from "../../components/print-slip-button";
import { WhatsAppButton } from "../../components/whatsapp-button";

// What the WhatsApp message needs from the Store (the Orders page passes the same).
export type WhatsAppContext = {
    storeName: string;
    confirmTemplate: string | null;
    messageTemplate: string | null;
    deliveryDays: string;
    senderName: string | null;
    senderPhone: string | null;
    senderAddress: string | null;
    senderCity: string | null;
    paymentAccounts: PublicPaymentAccount[];
};

// The order's WhatsApp link, built like the Orders page does (from the stored order).
function whatsappUrlFor(order: ManualOrderResponse, context: WhatsAppContext) {
    return buildOrderWhatsAppUrl(
        {
            storeName: context.storeName,
            trackingId: order.trackingId,
            createdAt: order.createdAt,
            status: order.status,
            paymentMethod: order.paymentMethod,
            customerName: order.customerName,
            email: order.email,
            phone: order.phone,
            addressLine1: order.addressLine1,
            addressLine2: order.addressLine2,
            city: order.city,
            postalCode: order.postalCode,
            country: order.country,
            customerNotes: order.customerNotes,
            subtotal: Number(order.subtotal),
            total: Number(order.total),
            items: order.items.map((item) => ({
                name: item.name,
                size: item.size,
                color: item.color,
                quantity: item.quantity,
            })),
            deliveryFee: order.deliveryFee,
            deliveryDays: context.deliveryDays,
            senderName: context.senderName,
            senderPhone: context.senderPhone,
            senderAddress: context.senderAddress,
            senderCity: context.senderCity,
            paymentAccounts: context.paymentAccounts,
        },
        { confirmTemplate: context.confirmTemplate, messageTemplate: context.messageTemplate },
    );
}

interface OrderCreatedProps {
    storeId: string;
    order: ManualOrderResponse;
    whatsapp: WhatsAppContext;
    onCreateAnother: () => void;
}

export function OrderCreated({ storeId, order, whatsapp, onCreateAnother }: OrderCreatedProps) {
    const headingRef = useRef<HTMLHeadingElement>(null);

    // Move focus to the result so keyboard and screen-reader users land on it.
    useEffect(() => {
        headingRef.current?.focus();
    }, []);

    const confirmed = order.status === "CONFIRMED";

    const copyTrackingId = async () => {
        try {
            await navigator.clipboard.writeText(order.trackingId);
            toast.success("Tracking id copied.");
        } catch {
            toast.error("Couldn't copy. Select the id and copy it.");
        }
    };

    return (
        <div className="mx-auto w-full max-w-2xl min-w-0 space-y-5">
            <div className="min-w-0 rounded-2xl border p-4 sm:p-6">
                <div className="flex min-w-0 items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green-600" aria-hidden="true" />
                    <div className="min-w-0">
                        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
                            Order created
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {confirmed
                                ? "Confirmed. Stock has been reduced."
                                : "Saved as a draft. Stock is reduced when you confirm it."}
                        </p>
                    </div>
                </div>

                <div className="mt-5 min-w-0 rounded-xl border p-3">
                    <div className="text-xs text-muted-foreground">Tracking id</div>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                        <span className="break-words font-mono text-lg font-semibold [overflow-wrap:anywhere]">
                            {order.trackingId}
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={copyTrackingId}
                            aria-label={`Copy tracking id ${order.trackingId}`}
                            className="h-11 w-11"
                        >
                            <Copy className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </div>
                </div>

                <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex min-w-0 justify-between gap-4">
                        <dt className="text-muted-foreground">Status</dt>
                        <dd className="text-right font-medium">{orderStatusLabel(order.status)}</dd>
                    </div>
                    <div className="flex min-w-0 justify-between gap-4">
                        <dt className="text-muted-foreground">Payment</dt>
                        <dd className="min-w-0 text-right">
                            <PaymentSummary order={order} className="justify-end" />
                        </dd>
                    </div>
                    <div className="flex min-w-0 justify-between gap-4 border-t pt-2">
                        <dt className="text-muted-foreground">Subtotal</dt>
                        <dd className="text-right">{formatter.format(Number(order.subtotal))}</dd>
                    </div>
                    <div className="flex min-w-0 justify-between gap-4">
                        <dt className="text-muted-foreground">Delivery</dt>
                        <dd className="text-right">{formatDeliveryFee(order.deliveryFee)}</dd>
                    </div>
                    <div className="flex min-w-0 justify-between gap-4 font-semibold">
                        <dt>Total</dt>
                        <dd className="text-right">{formatter.format(Number(order.total))}</dd>
                    </div>
                </dl>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
                <WhatsAppButton
                    order={{ whatsappKind: whatsAppKindFor(order.status), whatsappUrl: whatsappUrlFor(order, whatsapp) }}
                    className="min-h-[44px]"
                />
                <PrintSlipButton order={order} className="min-h-[44px]" />
                <Button asChild variant="outline" className="min-h-[44px] w-full sm:w-auto">
                    <Link href={`/${storeId}/orders`}>View in Orders</Link>
                </Button>
                <Button type="button" onClick={onCreateAnother} className="min-h-[44px] w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Create another order
                </Button>
            </div>
        </div>
    );
}
